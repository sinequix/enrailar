import type { ClickupList, ClickupTask } from "./clickup.ts";
import { asArray, asRecord, asString, idString } from "./json.ts";

/** Listas del CRM. El id gana sobre cualquier allowlist, env o nombre. */
export const CRM_LISTS = [
  { id: "901717736443", name: "Cuentas" },
  { id: "901717736444", name: "Contactos" },
  { id: "901717736445", name: "Alianzas y sponsors" },
  { id: "901717736446", name: "Voluntarios y Hackatrain" },
] as const;

const DENY_TAGS = new Set(["voluntario", "contacto", "lead"]);
const FUENTE_TAGS = new Set(["fuente-sumate", "fuente-email", "fuente-hola"]);
const FUENTE_FIELDS = new Set(["fuente", "source"]);

/**
 * Tarea retirada de GitHub. El id de lista no quedó en el issue; se niega
 * igual en cualquier lista.
 */
export const DENIED_TASK_IDS = ["86e3nbvhz"] as const;

const DENIED_PLACE_NAMES = new Set(["contactos", "contactos y contexto"]);
const INTERNAL_DOMAINS = ["enrailar.com", "sinequix.com"] as const;
const EMAIL = /[a-z0-9._%+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi;

export type SkipReason =
  | "deny-list"
  | "deny-folder"
  | "deny-task"
  | "deny-tag"
  | "deny-fuente"
  | "deny-content"
  | "tombstone"
  | "not-allowlisted";

export type PrivacyDecision =
  | { action: "sync" }
  | { action: "skip"; reason: SkipReason };

export type SkipCounts = Record<SkipReason, number>;

export type SyncPolicy = {
  allowListIds: ReadonlySet<string>;
  allowFolderIds: ReadonlySet<string>;
  allowNames: ReadonlySet<string>;
  denyListIds: ReadonlySet<string>;
  denyFolderIds: ReadonlySet<string>;
};

export type SpacePrivacy = {
  policy: SyncPolicy;
  denyFolderIds: ReadonlySet<string>;
};

export type PrivacySubject = {
  taskId?: string;
  name?: string;
  text?: string;
  listId: string;
  listName: string;
  folderId: string | null;
  folderName: string | null;
  tags: readonly string[];
  fuente: string | null;
};

type AllowEnv = {
  CLICKUP_SYNC_ALLOWLIST?: string;
  CLICKUP_SYNC_ALLOW_FOLDERS?: string;
};

export function emptySkips(): SkipCounts {
  return {
    "deny-list": 0,
    "deny-folder": 0,
    "deny-task": 0,
    "deny-tag": 0,
    "deny-fuente": 0,
    "deny-content": 0,
    "tombstone": 0,
    "not-allowlisted": 0,
  };
}

export function formatSkips(counts: SkipCounts): string {
  return [
    "skipped",
    `deny-list=${counts["deny-list"]}`,
    `deny-folder=${counts["deny-folder"]}`,
    `deny-task=${counts["deny-task"]}`,
    `deny-tag=${counts["deny-tag"]}`,
    `deny-fuente=${counts["deny-fuente"]}`,
    `deny-content=${counts["deny-content"]}`,
    `tombstone=${counts["tombstone"]}`,
    `not-allowlisted=${counts["not-allowlisted"]}`,
  ].join(" ");
}

export function normalizeLabel(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[·•∙↔—–\-_/|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isCrmFolderName(name: string | null | undefined): boolean {
  if (!name) return false;
  const key = normalizeLabel(name);
  return key === "crm" || key.startsWith("crm ") || key.endsWith(" crm") ||
    key.includes(" crm ");
}

export function fuenteOf(task: ClickupTask): string | null {
  for (const field of task.customFields) {
    if (!FUENTE_FIELDS.has(field.name.trim().toLowerCase())) continue;
    const value = field.value?.trim();
    if (value) return value;
  }
  return null;
}

export function subjectOf(
  task: ClickupTask,
  list?: Pick<ClickupList, "id" | "name" | "folderId" | "folderName"> | null,
): PrivacySubject {
  return {
    taskId: task.id,
    name: task.name,
    text: task.markdown,
    listId: task.listId || list?.id || "",
    listName: task.listName || list?.name || "",
    folderId: task.folderId || list?.folderId || null,
    folderName: task.folderName || list?.folderName || null,
    tags: task.tags,
    fuente: fuenteOf(task),
  };
}

export function policyFromConfig(
  config: unknown,
  env: AllowEnv = {},
): SyncPolicy {
  const record = asRecord(config);
  const allowListIds = new Set<string>();
  const allowFolderIds = new Set<string>();
  const allowNames = new Set<string>();
  collectEntries(record?.lists, allowListIds, allowNames);
  collectEntries(record?.folders, allowFolderIds, allowNames);
  for (const id of splitIds(env.CLICKUP_SYNC_ALLOWLIST)) allowListIds.add(id);
  for (const id of splitIds(env.CLICKUP_SYNC_ALLOW_FOLDERS)) {
    allowFolderIds.add(id);
  }
  const denyListIds = new Set<string>(CRM_LISTS.map((list) => list.id));
  for (const id of denyListIds) allowListIds.delete(id);
  const denyFolderIds = new Set<string>();
  collectIds(record?.denyFolders, denyFolderIds);
  return {
    allowListIds,
    allowFolderIds,
    allowNames,
    denyListIds,
    denyFolderIds,
  };
}

export async function loadSyncPolicy(env?: AllowEnv): Promise<SyncPolicy> {
  const text = await Deno.readTextFile(
    new URL("./allowlist.json", import.meta.url),
  );
  const resolved = env ?? {
    CLICKUP_SYNC_ALLOWLIST: Deno.env.get("CLICKUP_SYNC_ALLOWLIST"),
    CLICKUP_SYNC_ALLOW_FOLDERS: Deno.env.get("CLICKUP_SYNC_ALLOW_FOLDERS"),
  };
  return policyFromConfig(JSON.parse(text), resolved);
}

export function spacePrivacy(
  lists: readonly ClickupList[],
  policy: SyncPolicy,
): SpacePrivacy {
  const denyFolderIds = new Set(policy.denyFolderIds);
  for (const list of lists) {
    if (!list.folderId) continue;
    if (
      policy.denyListIds.has(list.id) || isCrmFolderName(list.folderName) ||
      deniedPlace(null, list.folderName) === "deny-folder"
    ) {
      denyFolderIds.add(list.folderId);
    }
  }
  return { policy, denyFolderIds };
}

export function listGate(
  list: ClickupList,
  space: SpacePrivacy,
): SkipReason | null {
  if (space.policy.denyListIds.has(list.id)) return "deny-list";
  if (list.folderId && space.denyFolderIds.has(list.folderId)) {
    return "deny-folder";
  }
  if (isCrmFolderName(list.folderName)) return "deny-folder";
  const named = deniedPlace(list.name, list.folderName);
  if (named) return named;
  if (isListed(list.id, list.name, list.folderId, list.folderName, space)) {
    return null;
  }
  return "not-allowlisted";
}

export function classifyTask(
  subject: PrivacySubject,
  space: SpacePrivacy,
): PrivacyDecision {
  if (deniedTask(subject.taskId)) {
    return { action: "skip", reason: "deny-task" };
  }
  if (space.policy.denyListIds.has(subject.listId)) {
    return { action: "skip", reason: "deny-list" };
  }
  if (subject.folderId && space.denyFolderIds.has(subject.folderId)) {
    return { action: "skip", reason: "deny-folder" };
  }
  if (isCrmFolderName(subject.folderName)) {
    return { action: "skip", reason: "deny-folder" };
  }
  const named = deniedPlace(subject.listName, subject.folderName);
  if (named) return { action: "skip", reason: named };
  const tag = deniedTag(subject.tags);
  if (tag === "deny-tag") return { action: "skip", reason: "deny-tag" };
  if (tag === "deny-fuente" || deniedFuente(subject.fuente)) {
    return { action: "skip", reason: "deny-fuente" };
  }
  if (
    isListed(
      subject.listId,
      subject.listName,
      subject.folderId,
      subject.folderName,
      space,
    )
  ) {
    if (deniedContent(subject.name ?? "", subject.text ?? "")) {
      return { action: "skip", reason: "deny-content" };
    }
    return { action: "sync" };
  }
  return { action: "skip", reason: "not-allowlisted" };
}

export function preferSkip(
  current: SkipReason | undefined,
  next: SkipReason,
): SkipReason {
  if (!current) return next;
  return rank(current) >= rank(next) ? current : next;
}

function rank(reason: SkipReason): number {
  switch (reason) {
    case "deny-task":
      return 8;
    case "deny-list":
      return 7;
    case "deny-folder":
      return 6;
    case "deny-tag":
      return 5;
    case "deny-fuente":
      return 4;
    case "deny-content":
      return 3;
    case "tombstone":
      return 2;
    case "not-allowlisted":
      return 1;
    default: {
      const unexpected: never = reason;
      return unexpected;
    }
  }
}

function isListed(
  listId: string,
  listName: string,
  folderId: string | null,
  folderName: string | null,
  space: SpacePrivacy,
): boolean {
  const { policy } = space;
  if (listId.length > 0 && policy.allowListIds.has(listId)) return true;
  if (folderId && policy.allowFolderIds.has(folderId)) return true;
  if (listName && policy.allowNames.has(normalizeLabel(listName))) return true;
  if (folderName && policy.allowNames.has(normalizeLabel(folderName))) {
    return true;
  }
  return false;
}

function deniedTask(taskId: string | undefined): boolean {
  if (!taskId) return false;
  return (DENIED_TASK_IDS as readonly string[]).includes(taskId);
}

function deniedPlace(
  listName: string | null,
  folderName: string | null,
): "deny-list" | "deny-folder" | null {
  if (listName && DENIED_PLACE_NAMES.has(normalizeLabel(listName))) {
    return "deny-list";
  }
  if (folderName && DENIED_PLACE_NAMES.has(normalizeLabel(folderName))) {
    return "deny-folder";
  }
  return null;
}

function deniedContent(name: string, text: string): boolean {
  return hasContactosContent(name, text) ||
    hasExternalEmail(`${name}\n${text}`);
}

function hasContactosContent(name: string, text: string): boolean {
  const nameKey = normalizeLabel(name);
  if (nameKey === "contactos" || nameKey === "contactos y contexto") {
    return true;
  }
  if (normalizeLabel(text).includes("contactos y contexto")) return true;
  for (const line of text.split(/\r?\n/)) {
    if (contactosLine(line)) return true;
  }
  return false;
}

function contactosLine(line: string): boolean {
  const stripped = line.trim().replace(/^#{1,6}\s+/, "").replace(
    /^[*_]+|[*_]+$/g,
    "",
  ).replace(/[.:]+$/g, "");
  return normalizeLabel(stripped) === "contactos";
}

function hasExternalEmail(text: string): boolean {
  const pattern = new RegExp(EMAIL.source, "gi");
  for (const match of text.matchAll(pattern)) {
    const domain = match[1]?.toLowerCase().replace(/\.+$/g, "") ?? "";
    if (!isInternalDomain(domain)) return true;
  }
  return false;
}

function isInternalDomain(domain: string): boolean {
  for (const allowed of INTERNAL_DOMAINS) {
    if (domain === allowed || domain.endsWith(`.${allowed}`)) return true;
  }
  return false;
}

function deniedTag(tags: readonly string[]): "deny-tag" | "deny-fuente" | null {
  for (const tag of tags) {
    const key = tag.trim().toLowerCase();
    if (DENY_TAGS.has(key)) return "deny-tag";
    if (FUENTE_TAGS.has(key)) return "deny-fuente";
  }
  return null;
}

function deniedFuente(value: string | null): boolean {
  if (!value) return false;
  const key = value.trim().toLowerCase();
  switch (key) {
    case "sumate":
    case "email":
    case "hola":
    case "hola@":
      return true;
    default:
      return key.includes("hola@");
  }
}

function collectEntries(
  value: unknown,
  ids: Set<string>,
  names: Set<string>,
): void {
  for (const raw of asArray(value)) {
    const record = asRecord(raw);
    if (!record) {
      const name = asString(raw);
      if (name?.trim()) names.add(normalizeLabel(name));
      continue;
    }
    const id = idString(record.id);
    if (id && /^\d+$/.test(id)) ids.add(id);
    const name = asString(record.name);
    if (name?.trim()) names.add(normalizeLabel(name));
  }
}

function collectIds(value: unknown, ids: Set<string>): void {
  for (const raw of asArray(value)) {
    const record = asRecord(raw);
    const id = record ? idString(record.id) : idString(raw);
    if (id && /^\d+$/.test(id)) ids.add(id);
  }
}

function splitIds(value: string | undefined): string[] {
  if (!value) return [];
  const ids: string[] = [];
  for (const part of value.split(/[\s,]+/)) {
    const id = part.trim();
    if (/^\d+$/.test(id)) ids.push(id);
  }
  return ids;
}
