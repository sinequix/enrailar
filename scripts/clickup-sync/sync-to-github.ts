import { AGENT_PLAN } from "./agent.ts";
import { postInitialPlanRequest } from "./agent-run.ts";
import type { ClickupTask } from "./clickup.ts";
import { loadLists, statusesFor, type SyncContext } from "./context.ts";
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
import {
  classifyTask,
  emptySkips,
  formatSkips,
  listGate,
  preferSkip,
  type SkipReason,
  spacePrivacy,
  subjectOf,
} from "./privacy.ts";
import { isAuthFailure, isMissing, reconcileLinkedTask } from "./reconcile.ts";
import { initialGithubClose } from "./state.ts";
import {
  issueUrlFor,
  linkedIssueNumbers,
  TOMBSTONE_MARKER,
  tombstoneComment,
} from "./tombstone.ts";
import { githubLoginFor } from "./users.ts";

type Summary = { id: string; parentId: string | null };

export async function syncClickupToGithub(ctx: SyncContext): Promise<void> {
  const lists = await loadLists(ctx);
  const space = spacePrivacy(lists, ctx.policy);
  const skipped = emptySkips();
  const blocked = new Map<string, SkipReason>();
  const pending = new Map<string, Summary>();
  for (const list of lists) {
    const reason = listGate(list, space);
    for (const task of await ctx.clickup.taskIdsInList(list.id)) {
      if (reason) {
        blocked.set(task.id, preferSkip(blocked.get(task.id), reason));
        pending.delete(task.id);
        continue;
      }
      if (blocked.has(task.id) || pending.has(task.id)) continue;
      pending.set(task.id, task);
    }
  }
  for (const reason of blocked.values()) skipped[reason] += 1;

  const index = indexIssuesByTaskId(await ctx.github.listIssues());
  const failures: string[] = [];
  const publish: Summary[] = [];
  for (const summary of orderParentsFirst([...pending.values()])) {
    try {
      const task = await ctx.clickup.getTask(summary.id);
      const decision = classifyTask(subjectOf(task), space);
      if (decision.action === "skip") {
        skipped[decision.reason] += 1;
        logSkip(summary.id, decision.reason);
        continue;
      }
      const ensured = await ensureIssue(ctx, task, index);
      if (ensured === "tombstone") {
        skipped.tombstone += 1;
        continue;
      }
      publish.push(summary);
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

  failures.push(...await linkSubtasks(ctx, publish, index));

  for (const summary of publish) {
    const issue = index.get(summary.id);
    if (!issue || issue.number === 0) continue;
    try {
      const task = await ctx.clickup.getTask(summary.id);
      const decision = classifyTask(subjectOf(task), space);
      if (decision.action === "skip") {
        skipped[decision.reason] += 1;
        logSkip(summary.id, decision.reason);
        continue;
      }
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

  console.log(formatSkips(skipped));
  if (failures.length > 0) {
    throw new Error(
      `Falló la sync de ${failures.length} tareas: ${failures.join(", ")}`,
    );
  }
}

function logSkip(taskId: string, reason: SkipReason): void {
  if (
    reason !== "deny-task" && reason !== "deny-content" &&
    reason !== "tombstone"
  ) {
    return;
  }
  console.log(`task=${taskId} skipped reason=${reason}`);
}

async function ensureIssue(
  ctx: SyncContext,
  task: ClickupTask,
  index: Map<string, GithubIssue>,
): Promise<"ready" | "tombstone"> {
  if (index.has(task.id)) return "ready";
  const persisted = await persistedLink(ctx, task, index);
  if (persisted === "tombstone") return "tombstone";
  if (persisted === "existing") return "ready";
  if (ctx.dryRun) {
    console.log(`dry-run task=${task.id} action=create-issue`);
    return "ready";
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
  if (issue.number > 0) {
    const url = issue.htmlUrl || issueUrlFor(ctx.repo, issue.number);
    await ctx.clickup.createComment(task.id, tombstoneComment(url));
  }
  if (issue.state === "open" && issue.number > 0) {
    await postInitialPlanRequest(issue.number, ctx.repo, ctx.dryRun);
  }
  return "ready";
}

async function persistedLink(
  ctx: SyncContext,
  task: ClickupTask,
  index: Map<string, GithubIssue>,
): Promise<"create" | "existing" | "tombstone"> {
  if (ctx.tombstones.has(task.id)) {
    console.log(`task=${task.id} skipped reason=tombstone`);
    return "tombstone";
  }
  const comments = await ctx.clickup.comments(task.id);
  const numbers = new Set<number>();
  let marked = false;
  const chunks = [
    task.markdown,
    ...task.customFields.map((field) => field.value ?? ""),
    ...comments.map((comment) => comment.text),
  ];
  for (const chunk of chunks) {
    if (chunk.includes(TOMBSTONE_MARKER)) marked = true;
    for (const number of linkedIssueNumbers(chunk, ctx.repo)) {
      numbers.add(number);
    }
  }
  if (numbers.size === 0) {
    if (!marked) return "create";
    console.log(`task=${task.id} skipped reason=tombstone`);
    return "tombstone";
  }
  let blocked = marked;
  for (const number of numbers) {
    try {
      const issue = await ctx.github.getIssue(number);
      if (parseClickupTaskId(issue.body) === task.id) {
        index.set(task.id, issue);
        return "existing";
      }
      blocked = true;
    } catch (error) {
      if (isAuthFailure(error)) throw error;
      if (isMissing(error)) {
        blocked = true;
        continue;
      }
      throw error;
    }
  }
  if (!blocked) return "create";
  console.log(`task=${task.id} skipped reason=tombstone`);
  return "tombstone";
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
      console.error(`task=${parentId} error`);
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
      console.error(`task=${child.taskId} error`);
    }
  }
  return { mode: "sub-issues", failed };
}
