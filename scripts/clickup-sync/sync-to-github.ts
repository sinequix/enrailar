import { AGENT_PLAN } from "./agent.ts";
import { postInitialPlanRequest } from "./agent-run.ts";
import { statusesFor, type SyncContext } from "./context.ts";
import type { GithubIssue } from "./github.ts";
import { labelsForNewIssue } from "./labels.ts";
import { parseClickupTaskId } from "./marker.ts";
import {
  buildIssueBody,
  indexIssuesByTaskId,
  issueTitle,
  orderParentsFirst,
  upsertSubtaskSection,
} from "./plan.ts";
import { isAuthFailure, isMissing, reconcileLinkedTask } from "./reconcile.ts";
import { initialGithubClose } from "./state.ts";
import { githubLoginFor } from "./users.ts";

type Summary = { id: string; parentId: string | null };

export async function syncClickupToGithub(ctx: SyncContext): Promise<void> {
  const lists = await ctx.clickup.listsInSpace(ctx.spaceId);
  ctx.statusByList = new Map(
    lists.map((list) => [list.id, list.statuses]),
  );
  const summaries: Summary[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const task of await ctx.clickup.taskIdsInList(list.id)) {
      if (seen.has(task.id)) continue;
      seen.add(task.id);
      summaries.push(task);
    }
  }

  const index = indexIssuesByTaskId(await ctx.github.listIssues());
  const failures: string[] = [];
  for (const summary of orderParentsFirst(summaries)) {
    try {
      await ensureIssue(ctx, summary, index);
    } catch (error) {
      if (isAuthFailure(error)) throw error;
      if (isMissing(error)) {
        console.warn(`task=${summary.id} no está`);
        continue;
      }
      failures.push(summary.id);
      console.error(`task=${summary.id} error`);
    }
  }

  failures.push(...await linkSubtasks(ctx, summaries, index));

  for (const summary of summaries) {
    const issue = index.get(summary.id);
    if (!issue || issue.number === 0) continue;
    try {
      const task = await ctx.clickup.getTask(summary.id);
      const fresh = await ctx.github.getIssue(issue.number);
      await reconcileLinkedTask({
        clickup: ctx.clickup,
        github: ctx.github,
        users: ctx.users,
        task,
        issue: fresh,
        availableStatuses: await statusesFor(ctx, task.listId),
      });
    } catch (error) {
      if (isAuthFailure(error)) throw error;
      if (isMissing(error)) {
        console.warn(`task=${summary.id} no está`);
        continue;
      }
      failures.push(summary.id);
      console.error(`task=${summary.id} error`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Falló la sync de ${failures.length} tareas: ${failures.join(", ")}`,
    );
  }
}

async function ensureIssue(
  ctx: SyncContext,
  summary: Summary,
  index: Map<string, GithubIssue>,
): Promise<void> {
  if (index.has(summary.id)) return;
  const task = await ctx.clickup.getTask(summary.id);
  if (ctx.dryRun) {
    console.log(`dry-run task=${task.id} action=create-issue`);
    return;
  }
  const assignees = task.assignees.flatMap((person) => {
    const login = githubLoginFor(ctx.users, person);
    if (login) return [login];
    console.warn(`task=${task.id} sin par para clickupUserId=${person.id}`);
    return [];
  });
  const close = initialGithubClose(task.status, task.statusType);
  const labels = labelsForNewIssue(task.tags, task.priority);
  if (close === "open") labels.push(AGENT_PLAN);
  let issue = await ctx.github.createIssue({
    title: issueTitle(task.name, task.id),
    body: buildIssueBody({
      taskId: task.id,
      taskUrl: task.url,
      markdown: task.markdown,
    }),
    labels,
    assignees,
  });
  if (close !== "open") {
    const stateReason = close === "not_planned" ? "not_planned" : "completed";
    await ctx.github.updateIssue(issue.number, {
      state: "closed",
      stateReason,
    });
    issue = { ...issue, state: "closed", stateReason };
  }
  if (parseClickupTaskId(issue.body) !== task.id) {
    throw new Error(`el issue #${issue.number} no guardó el marcador`);
  }
  index.set(task.id, issue);
  console.log(`task=${task.id} issue=#${issue.number} action=created`);
  if (issue.state === "open" && issue.number > 0) {
    await postInitialPlanRequest(issue.number, ctx.repo, ctx.dryRun);
  }
}

async function linkSubtasks(
  ctx: SyncContext,
  summaries: readonly Summary[],
  index: Map<string, GithubIssue>,
): Promise<string[]> {
  const children = new Map<string, Summary[]>();
  for (const summary of summaries) {
    if (!summary.parentId) continue;
    const list = children.get(summary.parentId) ?? [];
    list.push(summary);
    children.set(summary.parentId, list);
  }

  const failed: string[] = [];
  let subIssues = true;
  for (const [parentId, kids] of children) {
    const parent = index.get(parentId);
    if (!parent || parent.number === 0) continue;
    const linked = kids.flatMap((kid) => {
      const issue = index.get(kid.id);
      if (!issue || issue.number === 0) return [];
      return [{ taskId: kid.id, issue }];
    });
    if (linked.length === 0) continue;

    if (subIssues) {
      const result = await linkChildren(
        (issueId) => ctx.github.addSubIssue(parent.number, issueId),
        linked.map(({ taskId, issue }) => ({ taskId, issueId: issue.id })),
      );
      failed.push(...result.failed);
      if (result.mode === "sub-issues") continue;
      subIssues = false;
      console.warn("GitHub no aceptó sub-issues. Se usa un checklist.");
    }

    try {
      const body = upsertSubtaskSection(
        parent.body,
        linked.map(({ issue }) => ({
          number: issue.number,
          done: issue.state === "closed",
        })),
      );
      if (body === parent.body) continue;
      await ctx.github.updateIssue(parent.number, { body });
      parent.body = body;
      console.log(`issue=#${parent.number} action=checklist-subtasks`);
    } catch (error) {
      if (isAuthFailure(error)) throw error;
      failed.push(parentId);
      const detail = error instanceof Error ? error.message : "error";
      console.error(`task=${parentId} error al vincular subtareas: ${detail}`);
    }
  }
  return failed;
}

export async function linkChildren(
  add: (issueId: number) => Promise<"ok" | "unsupported">,
  children: readonly { taskId: string; issueId: number }[],
): Promise<{ mode: "sub-issues" | "unsupported"; failed: string[] }> {
  const failed: string[] = [];
  for (const child of children) {
    try {
      const result = await add(child.issueId);
      if (result === "unsupported") return { mode: "unsupported", failed };
    } catch (error) {
      if (isAuthFailure(error)) throw error;
      failed.push(child.taskId);
      const detail = error instanceof Error ? error.message : "error";
      console.error(
        `task=${child.taskId} error al vincular subtarea: ${detail}`,
      );
    }
  }
  return { mode: "sub-issues", failed };
}
