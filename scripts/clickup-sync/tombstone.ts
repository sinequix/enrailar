import { asArray, asRecord, asString, idString } from "./json.ts";
import type { RepositoryName } from "./references.ts";

export const TOMBSTONE_MARKER = "clickup-sync:tombstone";

const TASK_ID = /^[A-Za-z0-9_-]+$/;
const ISSUE_URL =
  /https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/issues\/(\d+)\b/gi;

export function tombstoneComment(issueUrl: string): string {
  return `${TOMBSTONE_MARKER}\nIssue: ${issueUrl}`;
}

export function issueUrlFor(repo: RepositoryName, number: number): string {
  return `https://github.com/${repo.owner}/${repo.name}/issues/${number}`;
}

export function linkedIssueNumbers(
  text: string,
  repo: RepositoryName,
): number[] {
  const found = new Set<number>();
  const pattern = new RegExp(ISSUE_URL.source, "gi");
  for (const match of text.matchAll(pattern)) {
    const owner = match[1];
    const name = match[2];
    const number = Number(match[3]);
    if (!owner || !name) continue;
    if (owner.toLowerCase() !== repo.owner.toLowerCase()) continue;
    if (name.toLowerCase() !== repo.name.toLowerCase()) continue;
    if (!Number.isInteger(number) || number <= 0) continue;
    found.add(number);
  }
  return [...found];
}

export function tombstonesFromConfig(config: unknown): Map<string, number> {
  const links = new Map<string, number>();
  for (const raw of asArray(asRecord(config)?.links)) {
    const record = asRecord(raw);
    const taskId = asString(record?.taskId)?.trim() ?? "";
    const issue = positiveIssue(record?.issue);
    if (!TASK_ID.test(taskId) || issue === null) continue;
    links.set(taskId, issue);
  }
  return links;
}

export async function loadTombstones(): Promise<Map<string, number>> {
  const text = await Deno.readTextFile(
    new URL("./tombstones.json", import.meta.url),
  );
  return tombstonesFromConfig(JSON.parse(text));
}

function positiveIssue(value: unknown): number | null {
  const id = idString(value);
  if (!id || !/^\d+$/.test(id)) return null;
  const number = Number(id);
  if (!Number.isSafeInteger(number) || number <= 0) return null;
  return number;
}
