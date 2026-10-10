import {
  type ClickupClient,
  type ClickupTask,
  fieldCanStoreUrl,
  githubField,
} from "./clickup.ts";
import type { GithubClient, GithubIssue } from "./github.ts";
import { HttpStatusError } from "./http.ts";
import { priorityFromLabels, tagsFromLabels } from "./labels.ts";
import {
  DRIFT_COMMENT_MARKER,
  driftCommentText,
  hasDrift,
  SYNC_COMMENT_MARKER,
  syncCommentText,
  tagPatch,
  withGithubLink,
} from "./plan.ts";
import { type PullRequestRef, resolveClickupStatus } from "./state.ts";
import { assigneePatch, type UserLink } from "./users.ts";

export async function reconcileLinkedTask(input: {
  clickup: ClickupClient;
  github: GithubClient;
  users: readonly UserLink[];
  task: ClickupTask;
  issue: GithubIssue;
  availableStatuses: readonly string[];
  extraPullRequests?: readonly PullRequestRef[];
}): Promise<void> {
  const fromTimeline = await input.github.linkedPullRequests(
    input.issue.number,
  );
  const pullRequests = mergePullRequests(
    fromTimeline,
    input.extraPullRequests ?? [],
  );
  const resolution = resolveClickupStatus(
    {
      issueState: input.issue.state,
      stateReason: input.issue.stateReason,
      pullRequests,
    },
    input.availableStatuses,
  );
  const applied = resolution.kind === "status" ? resolution.status : null;
  const missing = resolution.kind === "missing" ? resolution.wanted : null;
  console.log(
    `task=${input.task.id} issue=#${input.issue.number} bucket=${resolution.bucket} status=${
      applied ?? "missing"
    }`,
  );

  const assignees = assigneePatch(
    input.users,
    input.task.assignees,
    input.issue.assignees,
  );
  for (const login of assignees.unmapped) {
    console.warn(`task=${input.task.id} sin par para githubLogin=${login}`);
  }
  const tags = tagPatch(input.task.tags, tagsFromLabels(input.issue.labels));
  const priority = priorityFromLabels(input.issue.labels);
  const field = githubField(input.task);
  const useField = field !== null && fieldCanStoreUrl(field);
  const description = useField
    ? null
    : withGithubLink(input.task.markdown, input.issue.htmlUrl);

  await input.clickup.updateTask(input.task.id, {
    status: applied !== null && applied !== input.task.status
      ? applied
      : undefined,
    priority: priority !== null && priority !== input.task.priority
      ? priority
      : undefined,
    markdown: description?.changed ? description.markdown : undefined,
    assignees: { add: assignees.add, rem: assignees.rem },
  });

  if (useField && field.value !== input.issue.htmlUrl) {
    await input.clickup.setCustomField(
      input.task.id,
      field.id,
      input.issue.htmlUrl,
    );
  }

  for (const tag of tags.add) await input.clickup.addTag(input.task.id, tag);
  for (const tag of tags.rem) await input.clickup.removeTag(input.task.id, tag);

  const comment = syncCommentText({
    issueUrl: input.issue.htmlUrl,
    appliedStatus: applied,
    missing,
    pullRequests,
    unmappedLogins: assignees.unmapped,
  });
  const drift = hasDrift(
    { id: input.task.id, name: input.task.name, markdown: input.task.markdown },
    { title: input.issue.title, body: input.issue.body },
  );
  await syncComments(
    input.clickup,
    input.task.id,
    comment,
    drift ? driftCommentText(input.issue.htmlUrl) : null,
  );
}

async function syncComments(
  clickup: ClickupClient,
  taskId: string,
  syncText: string,
  driftText: string | null,
): Promise<void> {
  const comments = await clickup.comments(taskId);
  await upsertComment(clickup, taskId, comments, SYNC_COMMENT_MARKER, syncText);
  if (driftText) {
    await upsertComment(
      clickup,
      taskId,
      comments,
      DRIFT_COMMENT_MARKER,
      driftText,
    );
    return;
  }
  for (const comment of comments) {
    if (!comment.text.includes(DRIFT_COMMENT_MARKER)) continue;
    await clickup.deleteComment(comment.id);
  }
}

async function upsertComment(
  clickup: ClickupClient,
  taskId: string,
  comments: readonly { id: string; text: string }[],
  marker: string,
  text: string,
): Promise<void> {
  const matches = comments.filter((comment) => comment.text.includes(marker));
  const first = matches[0];
  if (!first) {
    await clickup.createComment(taskId, text);
  } else if (first.text !== text) {
    await clickup.updateComment(first.id, text);
  }
  for (const extra of matches.slice(1)) {
    await clickup.deleteComment(extra.id);
  }
}

function mergePullRequests(
  fromApi: readonly PullRequestRef[],
  extra: readonly PullRequestRef[],
): PullRequestRef[] {
  const byNumber = new Map<number, PullRequestRef>();
  for (const pullRequest of fromApi) {
    byNumber.set(pullRequest.number, pullRequest);
  }
  for (const pullRequest of extra) {
    byNumber.set(pullRequest.number, pullRequest);
  }
  return [...byNumber.values()];
}

export function isAuthFailure(error: unknown): boolean {
  return error instanceof HttpStatusError && error.status === 401;
}

export function isMissing(error: unknown): boolean {
  return error instanceof HttpStatusError && error.status === 404;
}
