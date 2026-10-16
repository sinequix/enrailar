/**
 * Alta o actualización de un contacto en una lista de ClickUp.
 *
 * Sumate llama con `fuente: "sumate"` y la etiqueta `voluntario`.
 * El worker de correo entrante puede reutilizar el mismo módulo con
 * `fuente: "email"`. El token no se escribe en el repo: entra como secreto
 * del Worker. El id de la lista es una variable de texto, no un secreto.
 *
 * El correo no va en el título ni en la descripción: el sync de ClickUp
 * publica esos campos en un issue público. Queda en el custom field `email`
 * y en un comentario con `notify_all` en falso.
 */

export const CRM_FUENTES = ["sumate", "email"] as const;

export type CrmFuente = (typeof CRM_FUENTES)[number];

export function isCrmFuente(value: string): value is CrmFuente {
  switch (value) {
    case "sumate":
    case "email":
      return true;
    default:
      return false;
  }
}

export interface CrmContact {
  email: string;
  /** No se publica en el título ni en la descripción. */
  name?: string;
  title: string;
  /** Texto público de la tarea. No debe llevar correo ni nombre. */
  summary: string;
  /** Comentario privado. Puede llevar el correo y el nombre. */
  note: string;
  fuente: CrmFuente;
  tags?: readonly string[];
  /** Si el correo de esa tarea coincide, se actualiza en lugar de buscar. */
  taskId?: string;
}

export interface CrmUpsertResult {
  ok: boolean;
  taskId?: string;
  action?: "created" | "updated";
}

export interface CrmResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export interface CrmRequest {
  method: string;
  headers: Record<string, string>;
  body?: string;
  signal?: unknown;
}

export interface CrmFetch {
  (url: string, init: CrmRequest): Promise<CrmResponse>;
}

export interface CrmClientOptions {
  token: string;
  listId: string;
  fetch?: CrmFetch;
  timeoutMs?: number;
}

const API = "https://api.clickup.com/api/v2";
const EMAIL_FIELD_NAMES = new Set(["email", "correo", "e-mail", "mail"]);
const FUENTE_FIELD_NAMES = new Set(["fuente", "source"]);

interface CrmField {
  id: string;
  name: string;
  type: string;
  options: ReadonlyArray<{ id: string; name: string }>;
}

interface CrmTaskHit {
  id: string;
  tags: string[];
  fields: Map<string, unknown>;
}

export function fuenteTag(fuente: CrmFuente): string {
  switch (fuente) {
    case "sumate":
      return "fuente-sumate";
    case "email":
      return "fuente-email";
    default: {
      const unreachable: never = fuente;
      return unreachable;
    }
  }
}

export function publicCrmText(text: string, email: string, name: string | undefined): string {
  let out = text;
  const mail = email.trim();
  if (mail.length > 0) {
    out = out.split(mail).join("");
    out = out.split(mail.toLowerCase()).join("");
  }
  const person = name?.trim() ?? "";
  if (person.length >= 3) out = out.split(person).join("");
  return out.replace(/[ \t]+\n/g, "\n").trim();
}

export async function upsertCrmContact(contact: CrmContact, options: CrmClientOptions): Promise<CrmUpsertResult> {
  const token = options.token.trim();
  const listId = options.listId.trim();
  const email = contact.email.trim().toLowerCase();
  if (token.length === 0 || !/^\d+$/.test(listId) || email.length === 0) return { ok: false };
  const fetchImpl = options.fetch ?? defaultFetch;
  const signal = timeoutSignal(options.timeoutMs ?? 12_000);
  let taskId: string | undefined;
  try {
    const fields = await loadFields(fetchImpl, token, listId, signal);
    const emailField = await ensureField(fetchImpl, token, listId, signal, fields, "email", "email", EMAIL_FIELD_NAMES);
    const fuenteField = await ensureField(fetchImpl, token, listId, signal, fields, "fuente", "short_text", FUENTE_FIELD_NAMES);
    const hinted = await taskIfEmailMatches(fetchImpl, token, contact.taskId, email, emailField, signal);
    const existing = hinted ?? (emailField
      ? await findByEmail(fetchImpl, token, listId, emailField, email, signal)
      : undefined);
    const title = publicCrmText(contact.title, email, contact.name).slice(0, 200) || "Contacto";
    const summary = publicCrmText(contact.summary, email, contact.name);
    const tags = uniqueTags(contact.tags ?? []);
    if (!existing) {
      const created = await send(fetchImpl, token, "POST", `/list/${listId}/task`, {
        name: title,
        markdown_description: summary,
        tags,
        notify_all: false,
        custom_fields: customFieldPayload(emailField, email, fuenteField, contact.fuente),
      }, signal);
      if (!created.ok) return { ok: false };
      taskId = taskIdOf(created.payload);
      if (!taskId) return { ok: false };
    } else {
      taskId = existing.id;
    }
    const emailSet = await writeEmail(fetchImpl, token, taskId, emailField, email, signal);
    if (!emailSet) return { ok: false, taskId };
    const fuenteSet = await writeFuente(fetchImpl, token, taskId, fuenteField, contact.fuente, existing, signal);
    if (!fuenteSet) {
      const tagged = await ensureTag(fetchImpl, token, taskId, fuenteTag(contact.fuente), existing?.tags ?? [], signal);
      if (!tagged) return { ok: false, taskId };
    }
    for (const tag of tags) {
      const tagged = await ensureTag(fetchImpl, token, taskId, tag, existing?.tags ?? [], signal);
      if (!tagged) return { ok: false, taskId };
    }
    const noted = await send(fetchImpl, token, "POST", `/task/${encodeURIComponent(taskId)}/comment`, {
      comment_text: contact.note,
      notify_all: false,
    }, signal);
    if (!noted.ok) return { ok: false, taskId };
    return { ok: true, taskId, action: existing ? "updated" : "created" };
  } catch {
    return taskId ? { ok: false, taskId } : { ok: false };
  }
}

function customFieldPayload(
  emailField: CrmField | undefined,
  email: string,
  fuenteField: CrmField | undefined,
  fuente: CrmFuente,
): Array<{ id: string; value: unknown }> {
  const fields: Array<{ id: string; value: unknown }> = [];
  if (emailField) fields.push({ id: emailField.id, value: email });
  const fuenteValue = fuentePayload(fuenteField, fuente, undefined);
  if (fuenteField && fuenteValue !== undefined) fields.push({ id: fuenteField.id, value: fuenteValue });
  return fields;
}

function uniqueTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const name = tag.trim();
    if (name.length === 0 || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

async function loadFields(fetchImpl: CrmFetch, token: string, listId: string, signal: unknown): Promise<CrmField[]> {
  const response = await send(fetchImpl, token, "GET", `/list/${listId}/field`, undefined, signal);
  if (!response.ok) return [];
  return parseFields(response.payload);
}

async function ensureField(
  fetchImpl: CrmFetch,
  token: string,
  listId: string,
  signal: unknown,
  fields: CrmField[],
  createName: string,
  createType: string,
  names: ReadonlySet<string>,
): Promise<CrmField | undefined> {
  const found = fields.find((field) => names.has(field.name.trim().toLowerCase()));
  if (found) return found;
  const response = await send(fetchImpl, token, "POST", `/list/${listId}/field`, {
    name: createName,
    type: createType,
  }, signal);
  if (!response.ok) return undefined;
  const created = parseFields(response.payload);
  return created[0] ?? parseField(asRecord(response.payload));
}

async function findByEmail(
  fetchImpl: CrmFetch,
  token: string,
  listId: string,
  emailField: CrmField,
  email: string,
  signal: unknown,
): Promise<CrmTaskHit | undefined> {
  const filter = encodeURIComponent(JSON.stringify([{
    field_id: emailField.id,
    operator: "==",
    value: email,
  }]));
  const response = await send(
    fetchImpl,
    token,
    "GET",
    `/list/${listId}/task?archived=false&include_closed=true&page=0&custom_fields=${filter}`,
    undefined,
    signal,
  );
  if (!response.ok) return undefined;
  const tasks = parseTasks(response.payload);
  const match = tasks.find((task) => fieldEqualsEmail(task.fields.get(emailField.id), email));
  if (match) return match;
  return tasks.length === 1 ? tasks[0] : undefined;
}

async function taskIfEmailMatches(
  fetchImpl: CrmFetch,
  token: string,
  taskId: string | undefined,
  email: string,
  emailField: CrmField | undefined,
  signal: unknown,
): Promise<CrmTaskHit | undefined> {
  if (!taskId || !safeId(taskId) || !emailField) return undefined;
  const response = await send(
    fetchImpl,
    token,
    "GET",
    `/task/${encodeURIComponent(taskId)}`,
    undefined,
    signal,
  );
  if (!response.ok) return undefined;
  const task = parseTasks(response.payload)[0] ?? parseTaskHit(asRecord(response.payload));
  if (!task || !fieldEqualsEmail(task.fields.get(emailField.id), email)) return undefined;
  return task;
}

async function writeEmail(
  fetchImpl: CrmFetch,
  token: string,
  taskId: string,
  field: CrmField | undefined,
  email: string,
  signal: unknown,
): Promise<boolean> {
  if (!field) return false;
  const response = await send(
    fetchImpl,
    token,
    "POST",
    `/task/${encodeURIComponent(taskId)}/field/${encodeURIComponent(field.id)}`,
    { value: email },
    signal,
  );
  return response.ok;
}

async function writeFuente(
  fetchImpl: CrmFetch,
  token: string,
  taskId: string,
  field: CrmField | undefined,
  fuente: CrmFuente,
  existing: CrmTaskHit | undefined,
  signal: unknown,
): Promise<boolean> {
  if (!field) return false;
  const current = existing?.fields.get(field.id);
  const value = fuentePayload(field, fuente, current);
  if (value === undefined) return false;
  if (fuenteUnchanged(field, current, value)) return true;
  const response = await send(
    fetchImpl,
    token,
    "POST",
    `/task/${encodeURIComponent(taskId)}/field/${encodeURIComponent(field.id)}`,
    { value },
    signal,
  );
  return response.ok;
}

function fuentePayload(field: CrmField | undefined, fuente: CrmFuente, current: unknown): unknown {
  if (!field) return undefined;
  switch (field.type) {
    case "short_text":
    case "text":
    case "email":
      return mergeFuenteText(typeof current === "string" ? current : undefined, fuente);
    case "drop_down":
      return field.options.find((option) => option.name.trim().toLowerCase() === fuente)?.id;
    case "labels":
      return labelFuenteValue(field, fuente, current);
    default:
      return undefined;
  }
}

function fuenteUnchanged(field: CrmField, current: unknown, next: unknown): boolean {
  switch (field.type) {
    case "short_text":
    case "text":
    case "email":
      return typeof current === "string" && current.trim() === next;
    case "drop_down":
      return current === next;
    case "labels":
      return Array.isArray(current) && Array.isArray(next) && next.every((id) => current.includes(id));
    default:
      return false;
  }
}

function mergeFuenteText(current: string | undefined, fuente: CrmFuente): string {
  const parts = new Set((current ?? "").split(",").map((part) => part.trim()).filter((part) => part.length > 0));
  parts.add(fuente);
  return [...parts].join(",");
}

function labelFuenteValue(field: CrmField, fuente: CrmFuente, current: unknown): string[] | undefined {
  const option = field.options.find((item) => item.name.trim().toLowerCase() === fuente);
  if (!option) return undefined;
  const ids = Array.isArray(current) ? current.filter((item): item is string => typeof item === "string") : [];
  return ids.includes(option.id) ? ids : [...ids, option.id];
}

async function ensureTag(
  fetchImpl: CrmFetch,
  token: string,
  taskId: string,
  tag: string,
  current: readonly string[],
  signal: unknown,
): Promise<boolean> {
  if (current.some((item) => item.toLowerCase() === tag.toLowerCase())) return true;
  const response = await send(
    fetchImpl,
    token,
    "POST",
    `/task/${encodeURIComponent(taskId)}/tag/${encodeURIComponent(tag)}`,
    {},
    signal,
  );
  return response.ok;
}

interface ClickResult {
  ok: boolean;
  payload: unknown;
}

async function send(
  fetchImpl: CrmFetch,
  token: string,
  method: string,
  path: string,
  body: unknown,
  signal: unknown,
): Promise<ClickResult> {
  const response = await fetchImpl(`${API}${path}`, {
    method,
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const text = await response.text();
  if (!response.ok) return { ok: false, payload: null };
  if (text.trim().length === 0) return { ok: true, payload: null };
  try {
    return { ok: true, payload: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, payload: null };
  }
}

function parseFields(payload: unknown): CrmField[] {
  const record = asRecord(payload);
  const fromList = asArray(record?.fields);
  const nested = asRecord(record?.field);
  const list = fromList.length > 0 ? fromList : nested ? [nested] : looksLikeField(record) ? [record] : [];
  const fields: CrmField[] = [];
  for (const item of list) {
    const field = parseField(asRecord(item));
    if (field) fields.push(field);
  }
  return fields;
}

function parseField(record: Record<string, unknown> | undefined): CrmField | undefined {
  if (!record) return undefined;
  const id = asString(record.id);
  const name = asString(record.name);
  const type = asString(record.type);
  if (!id || !name || !type || !safeId(id)) return undefined;
  return { id, name, type, options: parseOptions(record.type_config) };
}

function parseOptions(value: unknown): Array<{ id: string; name: string }> {
  const config = asRecord(value);
  const options = asArray(config?.options);
  const out: Array<{ id: string; name: string }> = [];
  for (const item of options) {
    const record = asRecord(item);
    const id = asString(record?.id);
    const name = asString(record?.name) ?? asString(record?.label);
    if (!id || !name) continue;
    out.push({ id, name });
  }
  return out;
}

function parseTasks(payload: unknown): CrmTaskHit[] {
  const record = asRecord(payload);
  const list = asArray(record?.tasks ?? (record?.id ? [record] : []));
  const tasks: CrmTaskHit[] = [];
  for (const item of list) {
    const task = parseTaskHit(asRecord(item));
    if (task) tasks.push(task);
  }
  return tasks;
}

function parseTaskHit(record: Record<string, unknown> | undefined): CrmTaskHit | undefined {
  if (!record) return undefined;
  const id = asString(record.id);
  if (!id || !safeId(id)) return undefined;
  const fields = new Map<string, unknown>();
  for (const item of asArray(record.custom_fields)) {
    const field = asRecord(item);
    const fieldId = asString(field?.id);
    if (!fieldId || !field || !("value" in field)) continue;
    fields.set(fieldId, field.value);
  }
  const tags: string[] = [];
  for (const item of asArray(record.tags)) {
    const tag = asRecord(item);
    const name = asString(tag?.name) ?? asString(item);
    if (name) tags.push(name);
  }
  return { id, tags, fields };
}

function fieldEqualsEmail(value: unknown, email: string): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === email;
}

function taskIdOf(payload: unknown): string | undefined {
  const id = asString(asRecord(payload)?.id);
  return id && safeId(id) ? id : undefined;
}

function looksLikeField(record: Record<string, unknown> | undefined): boolean {
  return Boolean(record && "id" in record && "type" in record && "name" in record);
}

function safeId(value: string): boolean {
  return /^[A-Za-z0-9-]+$/.test(value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function timeoutSignal(ms: number): unknown {
  const timeout = (globalThis as { AbortSignal?: { timeout?: (delay: number) => unknown } }).AbortSignal?.timeout;
  return timeout ? timeout(ms) : undefined;
}

function defaultFetch(url: string, init: CrmRequest): Promise<CrmResponse> {
  const fetchFn = (globalThis as { fetch?: (input: string, init?: unknown) => Promise<CrmResponse> }).fetch;
  if (!fetchFn) return Promise.reject(new Error("fetch"));
  return fetchFn(url, init);
}
