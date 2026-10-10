import { clickupMarker, parseClickupTaskId } from "./marker.ts";

const ISSUE_BODY_LIMIT = 65_000;
const SUBTASK_START = "<!-- clickup-subtasks:start -->";
const SUBTASK_END = "<!-- clickup-subtasks:end -->";
const SUBTASK_BLOCK =
  /<!-- clickup-subtasks:start -->[\s\S]*?<!-- clickup-subtasks:end -->/g;
const CLICKUP_LINK_LINE = /^Tarea en ClickUp:.*$/gm;
const GITHUB_FOOTER =
  /\n*---\nGitHub: https:\/\/github\.com\/\S+(?:\n<!-- github-issue:https:\/\/github\.com\/\S+ -->)?\s*$/g;

export const SYNC_COMMENT_MARKER = "clickup-sync:github";
export const DRIFT_COMMENT_MARKER = "clickup-sync:drift";

export type TaskNode = {
  id: string;
  parentId: string | null;
};

export type ExistingIssue = {
  body: string;
};

export function indexIssuesByTaskId<T extends ExistingIssue>(
  issues: readonly T[],
): Map<string, T> {
  const index = new Map<string, T>();
  for (const issue of issues) {
    const taskId = parseClickupTaskId(issue.body);
    if (!taskId || index.has(taskId)) continue;
    index.set(taskId, issue);
  }
  return index;
}

export function creationPlan(
  taskIds: readonly string[],
  issues: readonly ExistingIssue[],
): { create: string[]; existing: string[] } {
  const index = indexIssuesByTaskId(issues);
  const seen = new Set<string>();
  const create: string[] = [];
  const existing: string[] = [];
  for (const taskId of taskIds) {
    if (index.has(taskId) || seen.has(taskId)) {
      existing.push(taskId);
      seen.add(taskId);
      continue;
    }
    create.push(taskId);
    seen.add(taskId);
  }
  return { create, existing };
}

export function orderParentsFirst<T extends TaskNode>(
  tasks: readonly T[],
): T[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const visited = new Set<string>();
  const ordered: T[] = [];

  const visit = (task: T): void => {
    if (visited.has(task.id)) return;
    visited.add(task.id);
    if (task.parentId) {
      const parent = byId.get(task.parentId);
      if (parent) visit(parent);
    }
    ordered.push(task);
  };

  for (const task of tasks) visit(task);
  return ordered;
}

export function issueTitle(name: string, taskId: string): string {
  const trimmed = name.trim();
  const title = trimmed.length > 0 ? trimmed : `Tarea ${taskId}`;
  return title.slice(0, 256);
}

export function buildIssueBody(
  input: { taskId: string; taskUrl: string; markdown: string },
): string {
  const marker = clickupMarker(input.taskId);
  const link = `Tarea en ClickUp: ${input.taskUrl}`;
  const suffix = `\n\n${link}\n\n${marker}\n`;
  const room = Math.max(ISSUE_BODY_LIMIT - suffix.length, 0);
  const description = input.markdown.trim().slice(0, room);
  if (description.length === 0) return `${link}\n\n${marker}\n`;
  return `${description}${suffix}`;
}

export function withGithubLink(
  markdown: string,
  issueUrl: string,
): { markdown: string; changed: boolean } {
  if (markdown.includes(issueUrl)) return { markdown, changed: false };
  const footer = `\n\n---\nGitHub: ${issueUrl}\n`;
  return { markdown: `${markdown.trimEnd()}${footer}`, changed: true };
}

export function titlesDiffer(
  clickupTitle: string,
  issueTitleText: string,
): boolean {
  return canonical(clickupTitle).slice(0, 256) !==
    canonical(issueTitleText).slice(0, 256);
}

export function descriptionsDiffer(
  clickupMarkdown: string,
  issueBody: string,
): boolean {
  return clickupDescriptionForCompare(clickupMarkdown) !==
    issueDescriptionForCompare(issueBody);
}

export function hasDrift(
  clickup: { id: string; name: string; markdown: string },
  issue: { title: string; body: string },
): boolean {
  return titlesDiffer(issueTitle(clickup.name, clickup.id), issue.title) ||
    descriptionsDiffer(clickup.markdown, issue.body);
}

export function clickupDescriptionForCompare(markdown: string): string {
  return canonical(markdown.replace(GITHUB_FOOTER, ""));
}

export function issueDescriptionForCompare(body: string): string {
  const withoutBlock = body.replace(SUBTASK_BLOCK, "");
  const withoutMarker = withoutBlock.replace(
    /<!--\s*clickup:[A-Za-z0-9_-]+\s*-->/g,
    "",
  );
  const withoutLink = withoutMarker.replace(CLICKUP_LINK_LINE, "");
  return canonical(withoutLink);
}

export function upsertSubtaskSection(
  body: string,
  items: readonly { number: number; done: boolean }[],
): string {
  const lines = items.map((item) =>
    `- [${item.done ? "x" : " "}] #${item.number}`
  );
  const section = `${SUBTASK_START}\n${lines.join("\n")}\n${SUBTASK_END}`;
  if (body.includes(SUBTASK_START) && body.includes(SUBTASK_END)) {
    return body.replace(SUBTASK_BLOCK, section);
  }
  return `${body.trimEnd()}\n\n${section}\n`;
}

export function syncCommentText(input: {
  issueUrl: string;
  appliedStatus: string | null;
  missing: readonly string[] | null;
  pullRequests: readonly {
    number: number;
    state: "open" | "closed";
    merged: boolean;
    url: string;
  }[];
  unmappedLogins: readonly string[];
}): string {
  const lines = [SYNC_COMMENT_MARKER, `Issue: ${input.issueUrl}`];
  if (input.appliedStatus) {
    lines.push(`Estado: ${input.appliedStatus}`);
  } else if (input.missing && input.missing.length > 0) {
    lines.push(
      `Estado deseado no está en la lista. Faltan: ${
        input.missing.join(", ")
      }.`,
    );
  }
  if (input.pullRequests.length === 0) {
    lines.push("PRs: ninguna");
  } else {
    lines.push("PRs:");
    for (const pullRequest of input.pullRequests) {
      const state = pullRequest.merged
        ? "mergeada"
        : pullRequest.state === "open"
        ? "abierta"
        : "cerrada";
      lines.push(`- #${pullRequest.number} ${state} ${pullRequest.url}`);
    }
  }
  if (input.unmappedLogins.length > 0) {
    lines.push(`Sin par ClickUp para: ${input.unmappedLogins.join(", ")}`);
  }
  return lines.join("\n");
}

export function driftCommentText(issueUrl: string): string {
  return [
    DRIFT_COMMENT_MARKER,
    "El título o la descripción de esta tarea no coinciden con el issue.",
    "Esos cambios hechos en ClickUp no pisan GitHub: el issue es la fuente de verdad.",
    `Issue: ${issueUrl}`,
  ].join("\n");
}

export function tagPatch(
  current: readonly string[],
  desired: readonly string[],
): { add: string[]; rem: string[] } {
  const normalize = (value: string) => value.trim().toLowerCase();
  const desiredSet = new Set(desired.map(normalize));
  const currentSet = new Set(current.map(normalize));
  return {
    add: desired.filter((tag) => !currentSet.has(normalize(tag))),
    rem: current.filter((tag) => !desiredSet.has(normalize(tag))),
  };
}

function canonical(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(
    /\n{3,}/g,
    "\n\n",
  ).trim();
}
