import { HttpStatusError, readJson, sendWithRetry } from "./http.ts";
import { asArray, asRecord, asString, idString } from "./json.ts";
import { CLICKUP_BUDGET_PER_MINUTE, throttleDelayMs } from "./rate-limit.ts";
import { sleep } from "./sleep.ts";

const API = "https://api.clickup.com/api/v2";
export const CLICKUP_SPACE_ID = "90177904660";

export type ClickupStatus = {
  status: string;
  type: string;
};

export type ClickupList = {
  id: string;
  statuses: ClickupStatus[];
};

export type ClickupCustomField = {
  id: string;
  name: string;
  type: string;
  value: string | null;
};

export type ClickupTask = {
  id: string;
  name: string;
  markdown: string;
  url: string;
  status: string;
  statusType: string;
  priority: number | null;
  assignees: { id: string; username: string }[];
  tags: string[];
  parentId: string | null;
  listId: string;
  customFields: ClickupCustomField[];
};

export type ClickupComment = {
  id: string;
  text: string;
};

export type TaskPatch = {
  status?: string;
  priority?: number | null;
  markdown?: string;
  assignees?: { add: string[]; rem: string[] };
};

export class ClickupClient {
  #token: string;
  #dryRun: boolean;
  #fetch: typeof fetch;
  #timestamps: number[] = [];

  constructor(
    token: string,
    options: { dryRun?: boolean; fetchImpl?: typeof fetch } = {},
  ) {
    this.#token = token;
    this.#dryRun = options.dryRun ?? false;
    this.#fetch = options.fetchImpl ?? fetch;
  }

  async listsInSpace(spaceId: string): Promise<ClickupList[]> {
    assertId(spaceId, "space");
    const folderless = await this.#get(`/space/${spaceId}/list?archived=false`);
    const folders = await this.#get(`/space/${spaceId}/folder?archived=false`);
    const rawLists = [...asArray(asRecord(folderless)?.lists)];
    for (const folder of asArray(asRecord(folders)?.folders)) {
      const record = asRecord(folder);
      const nested = asArray(record?.lists);
      if (nested.length > 0) {
        rawLists.push(...nested);
        continue;
      }
      const folderId = idString(record?.id);
      if (!folderId) continue;
      const folderLists = await this.#get(
        `/folder/${folderId}/list?archived=false`,
      );
      rawLists.push(...asArray(asRecord(folderLists)?.lists));
    }

    const lists = new Map<string, ClickupList>();
    for (const raw of rawLists) {
      const record = asRecord(raw);
      const id = idString(record?.id);
      if (!id || lists.has(id)) continue;
      let statuses = parseStatuses(record?.statuses);
      if (statuses.length === 0) {
        const detail = asRecord(await this.#get(`/list/${id}`));
        statuses = parseStatuses(detail?.statuses);
      }
      lists.set(id, { id, statuses });
    }
    return [...lists.values()];
  }

  async taskIdsInList(
    listId: string,
  ): Promise<{ id: string; parentId: string | null }[]> {
    assertId(listId, "list");
    const tasks: { id: string; parentId: string | null }[] = [];
    const seen = new Set<string>();
    for (let page = 0; page < 50; page++) {
      const payload = await this.#get(
        `/list/${listId}/task?archived=false&include_closed=true&subtasks=true&page=${page}`,
      );
      const batch = asArray(asRecord(payload)?.tasks);
      if (batch.length === 0) break;
      for (const raw of batch) {
        const record = asRecord(raw);
        const id = idString(record?.id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        tasks.push({ id, parentId: parentId(record?.parent) });
      }
      const lastPage = asRecord(payload)?.last_page === true;
      if (lastPage || batch.length < 100) break;
    }
    return tasks;
  }

  async getTask(taskId: string): Promise<ClickupTask> {
    assertId(taskId, "task");
    const payload = await this.#get(
      `/task/${taskId}?include_markdown_description=true`,
    );
    const task = parseTask(payload);
    if (!task) throw new Error(`ClickUp no devolvió la tarea ${taskId}`);
    return task;
  }

  async updateTask(taskId: string, patch: TaskPatch): Promise<void> {
    const body: Record<string, unknown> = {};
    if (patch.status) body.status = patch.status;
    if (typeof patch.priority === "number") body.priority = patch.priority;
    if (patch.markdown !== undefined) body.markdown_content = patch.markdown;
    if (
      patch.assignees &&
      (patch.assignees.add.length > 0 || patch.assignees.rem.length > 0)
    ) {
      body.assignees = {
        add: integers(patch.assignees.add),
        rem: integers(patch.assignees.rem),
      };
    }
    if (Object.keys(body).length === 0) return;
    if (this.#dryRun) {
      console.log(
        `dry-run task=${taskId} action=update fields=${
          Object.keys(body).join(",")
        }`,
      );
      return;
    }
    await this.#send("PUT", `/task/${taskId}`, body);
  }

  async comments(taskId: string): Promise<ClickupComment[]> {
    assertId(taskId, "task");
    const payload = await this.#get(`/task/${taskId}/comment`);
    const comments: ClickupComment[] = [];
    for (const raw of asArray(asRecord(payload)?.comments)) {
      const record = asRecord(raw);
      const id = idString(record?.id);
      const text = asString(record?.comment_text) ??
        commentText(record?.comment);
      if (!id || text === null) continue;
      comments.push({ id, text });
    }
    return comments;
  }

  async createComment(taskId: string, text: string): Promise<void> {
    if (this.#dryRun) {
      console.log(`dry-run task=${taskId} action=create-comment`);
      return;
    }
    await this.#send("POST", `/task/${taskId}/comment`, {
      comment_text: text,
      notify_all: false,
    });
  }

  async updateComment(commentId: string, text: string): Promise<void> {
    if (this.#dryRun) {
      console.log(`dry-run comment=${commentId} action=update-comment`);
      return;
    }
    await this.#send("PUT", `/comment/${commentId}`, { comment_text: text });
  }

  async deleteComment(commentId: string): Promise<void> {
    if (this.#dryRun) {
      console.log(`dry-run comment=${commentId} action=delete-comment`);
      return;
    }
    try {
      await this.#send("DELETE", `/comment/${commentId}`);
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 404) return;
      throw error;
    }
  }

  async addTag(taskId: string, tag: string): Promise<void> {
    if (this.#dryRun) {
      console.log(`dry-run task=${taskId} action=add-tag`);
      return;
    }
    await this.#send("POST", `/task/${taskId}/tag/${encodeURIComponent(tag)}`);
  }

  async removeTag(taskId: string, tag: string): Promise<void> {
    if (this.#dryRun) {
      console.log(`dry-run task=${taskId} action=remove-tag`);
      return;
    }
    await this.#send(
      "DELETE",
      `/task/${taskId}/tag/${encodeURIComponent(tag)}`,
    );
  }

  async setCustomField(
    taskId: string,
    fieldId: string,
    value: string,
  ): Promise<void> {
    if (this.#dryRun) {
      console.log(`dry-run task=${taskId} action=set-field`);
      return;
    }
    await this.#send("POST", `/task/${taskId}/field/${fieldId}`, { value });
  }

  async #get(path: string): Promise<unknown> {
    return await this.#send("GET", path);
  }

  async #send(method: string, path: string, body?: unknown): Promise<unknown> {
    const url = `${API}${path}`;
    await this.#pace();
    const response = await sendWithRetry(
      () =>
        this.#fetch(url, {
          method,
          headers: {
            Authorization: this.#token,
            "Content-Type": "application/json",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      "ClickUp",
    );
    return await readJson(response, `ClickUp ${method} ${path.split("?")[0]}`);
  }

  async #pace(): Promise<void> {
    const wait = throttleDelayMs(
      this.#timestamps,
      Date.now(),
      CLICKUP_BUDGET_PER_MINUTE,
    );
    if (wait > 0) await sleep(wait);
    const now = Date.now();
    this.#timestamps = this.#timestamps.filter((stamp) => stamp > now - 60_000);
    this.#timestamps.push(now);
  }
}

export function githubField(task: ClickupTask): ClickupCustomField | null {
  return task.customFields.find((field) =>
    field.name.trim().toLowerCase() === "github"
  ) ?? null;
}

export function fieldCanStoreUrl(field: ClickupCustomField): boolean {
  const type = field.type.trim().toLowerCase();
  return type === "url" || type === "text" || type === "short_text";
}

function parseTask(value: unknown): ClickupTask | null {
  const record = asRecord(value);
  const id = idString(record?.id);
  if (!record || !id) return null;
  const list = asRecord(record.list);
  return {
    id,
    name: asString(record.name) ?? "",
    markdown: asString(record.markdown_description) ??
      asString(record.description) ?? "",
    url: asString(record.url) ?? `https://app.clickup.com/t/${id}`,
    status: asString(asRecord(record.status)?.status) ?? "",
    statusType: asString(asRecord(record.status)?.type) ?? "",
    priority: parsePriority(record.priority),
    assignees: parseAssignees(record.assignees),
    tags: parseTags(record.tags),
    parentId: parentId(record.parent),
    listId: idString(list?.id) ?? "",
    customFields: parseFields(record.custom_fields),
  };
}

function parseStatuses(value: unknown): ClickupStatus[] {
  const statuses: ClickupStatus[] = [];
  for (const raw of asArray(value)) {
    const record = asRecord(raw);
    const status = asString(record?.status);
    if (!status) continue;
    statuses.push({ status, type: asString(record?.type) ?? "" });
  }
  return statuses;
}

function parsePriority(value: unknown): number | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = idString(record.id);
  switch (id) {
    case "1":
    case "2":
    case "3":
    case "4":
      return Number(id);
    default:
      break;
  }
  switch (asString(record.priority)?.toLowerCase()) {
    case "urgent":
      return 1;
    case "high":
      return 2;
    case "normal":
      return 3;
    case "low":
      return 4;
    default:
      return null;
  }
}

function parseAssignees(value: unknown): { id: string; username: string }[] {
  const people: { id: string; username: string }[] = [];
  for (const raw of asArray(value)) {
    const record = asRecord(raw);
    const id = idString(record?.id);
    if (!id || !/^\d+$/.test(id)) continue;
    const username = asString(record?.username) ?? "";
    people.push({ id, username: username.includes("@") ? "" : username });
  }
  return people;
}

function parseTags(value: unknown): string[] {
  const tags: string[] = [];
  for (const raw of asArray(value)) {
    const record = asRecord(raw);
    const name = record ? asString(record.name) : asString(raw);
    if (name && name.trim().length > 0) tags.push(name.trim());
  }
  return tags;
}

function parseFields(value: unknown): ClickupCustomField[] {
  const fields: ClickupCustomField[] = [];
  for (const raw of asArray(value)) {
    const record = asRecord(raw);
    const id = idString(record?.id);
    const name = asString(record?.name);
    if (!id || !name) continue;
    const rawValue = record?.value;
    fields.push({
      id,
      name,
      type: asString(record?.type) ?? "",
      value: typeof rawValue === "string" ? rawValue : null,
    });
  }
  return fields;
}

function commentText(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const parts: string[] = [];
  for (const part of value) {
    const text = asString(asRecord(part)?.text);
    if (text) parts.push(text);
  }
  return parts.join("");
}

function parentId(value: unknown): string | null {
  const direct = idString(value);
  if (direct) return direct;
  return idString(asRecord(value)?.id);
}

function integers(ids: readonly string[]): number[] {
  const values: number[] = [];
  for (const id of ids) {
    if (!/^\d+$/.test(id)) continue;
    const value = Number(id);
    if (Number.isSafeInteger(value)) values.push(value);
  }
  return values;
}

function assertId(value: string, label: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`${label} inválido`);
  }
}
