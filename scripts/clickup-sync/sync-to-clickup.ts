import { statusesFor, type SyncContext } from "./context.ts";
import { asRecord, asString, idString } from "./json.ts";
import { parseClickupTaskId } from "./marker.ts";
import { referencedIssueNumbers } from "./references.ts";
import { isAuthFailure, isMissing, reconcileLinkedTask } from "./reconcile.ts";
import type { PullRequestRef } from "./state.ts";

export async function syncGithubToClickup(ctx: SyncContext): Promise<void> {
  const eventName = Deno.env.get("GITHUB_EVENT_NAME") ?? "";
  const eventPath = Deno.env.get("GITHUB_EVENT_PATH");
  if (
    !eventPath || eventName.length === 0 || eventName === "workflow_dispatch" ||
    eventName === "schedule"
  ) {
    return;
  }
  const event = JSON.parse(await Deno.readTextFile(eventPath)) as unknown;
  if (eventName === "issues") {
    await syncIssueEvent(ctx, event);
    return;
  }
  if (eventName === "pull_request") {
    await syncPullRequestEvent(ctx, event);
    return;
  }
  console.log(`evento ${eventName} ignorado`);
}

async function syncIssueEvent(ctx: SyncContext, event: unknown): Promise<void> {
  const record = asRecord(event);
  const issue = asRecord(record?.issue);
  if (issue?.pull_request) return;
  const number = positiveNumber(issue?.number);
  if (number === null) return;
  await reconcileIssue(ctx, number, []);
}

async function syncPullRequestEvent(
  ctx: SyncContext,
  event: unknown,
): Promise<void> {
  const pullRequest = asRecord(asRecord(event)?.pull_request);
  const number = positiveNumber(pullRequest?.number);
  if (!pullRequest || number === null) return;
  const ref: PullRequestRef = {
    number,
    state: pullRequest.state === "closed" ? "closed" : "open",
    merged: pullRequest.merged === true,
    draft: pullRequest.draft === true,
    url: asString(pullRequest.html_url) ??
      `https://github.com/${ctx.repo.owner}/${ctx.repo.name}/pull/${number}`,
  };
  ctx.github.rememberPullRequest(ref);
  const text = `${asString(pullRequest.title) ?? ""}\n${
    asString(pullRequest.body) ?? ""
  }`;
  const numbers = new Set(referencedIssueNumbers(text, ctx.repo));
  try {
    for (const closing of await ctx.github.closingIssueNumbers(number)) {
      numbers.add(closing);
    }
  } catch (error) {
    if (isAuthFailure(error)) throw error;
    console.warn(`pr=#${number} no se pudieron leer las issues de cierre`);
  }
  let matched = 0;
  for (const issueNumber of numbers) {
    const updated = await reconcileIssue(ctx, issueNumber, [ref], true);
    if (updated) matched += 1;
  }
  if (matched === 0) {
    console.log(`pr=#${number} no referencia issues de ClickUp`);
  }
}

async function reconcileIssue(
  ctx: SyncContext,
  issueNumber: number,
  extraPullRequests: readonly PullRequestRef[],
  quiet = false,
): Promise<boolean> {
  let issue;
  try {
    issue = await ctx.github.getIssue(issueNumber);
  } catch (error) {
    if (isAuthFailure(error)) throw error;
    console.warn(`issue=#${issueNumber} no se pudo leer`);
    return false;
  }
  const taskId = parseClickupTaskId(issue.body);
  if (!taskId) {
    if (!quiet) console.log(`issue=#${issueNumber} sin marcador de ClickUp`);
    return false;
  }
  try {
    const task = await ctx.clickup.getTask(taskId);
    await reconcileLinkedTask({
      clickup: ctx.clickup,
      github: ctx.github,
      users: ctx.users,
      task,
      issue,
      availableStatuses: await statusesFor(ctx, task.listId),
      extraPullRequests,
    });
  } catch (error) {
    if (isAuthFailure(error)) throw error;
    if (isMissing(error)) {
      console.warn(`task=${taskId} no está`);
      return false;
    }
    console.error(`task=${taskId} error`);
    throw new Error(`Falló la sync de la tarea ${taskId}`);
  }
  return true;
}

function positiveNumber(value: unknown): number | null {
  const id = idString(value);
  if (!id || !/^\d+$/.test(id)) return null;
  const number = Number(id);
  if (!Number.isSafeInteger(number) || number <= 0) return null;
  return number;
}
