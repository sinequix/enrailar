import { ROLE_MAILBOXES, type RoleMailbox } from "@enrailar/shared";
import { subjectFromRaw } from "./subject.ts";
import { mailboxObject, type InboundStore, type ObjectStore } from "./store.ts";

const MAX_BYTES = 10 * 1024 * 1024;

export interface InboxDeps {
  store: InboundStore;
  objects: ObjectStore;
  now(): string;
  log(event: { route: string; status: number; recordId: string }): void;
}

function isRoleMailbox(value: string): value is RoleMailbox {
  return (ROLE_MAILBOXES as readonly string[]).includes(value);
}

function copyBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", copyBytes(bytes));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function json(status: number, body: unknown): Response {
  return Response.json(body, { status });
}

async function acceptInbound(request: Request, deps: InboxDeps): Promise<Response> {
  const route = "POST /internal/inbound";
  const mailbox = (request.headers.get("x-envelope-to") ?? "").trim().toLowerCase();
  if (!isRoleMailbox(mailbox)) {
    deps.log({ route, status: 404, recordId: "mailbox" });
    return json(404, { ok: false });
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    deps.log({ route, status: 413, recordId: "size" });
    return json(413, { ok: false });
  }
  const id = await sha256(bytes);
  const objectKey = `raw/${id}`;
  const marker = mailboxObject(mailbox);
  await deps.objects.put(objectKey, bytes);
  await deps.objects.put(marker.key, marker.body);
  await deps.store.save({
    id,
    mailbox,
    subject: subjectFromRaw(bytes),
    objectKey,
    sizeBytes: bytes.byteLength,
    createdAt: deps.now(),
  });
  deps.log({ route, status: 202, recordId: id });
  return json(202, { ok: true });
}

export async function handleInbox(request: Request, deps: InboxDeps): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") {
    return json(200, { ok: true });
  }
  if (request.method === "POST" && url.pathname === "/internal/inbound") {
    return acceptInbound(request, deps);
  }

  const messages = /^\/v1\/mailboxes\/([^/]+)\/messages$/.exec(url.pathname);
  if (request.method === "GET" && messages?.[1]) {
    const mailbox = decodeURIComponent(messages[1]).toLowerCase();
    if (!isRoleMailbox(mailbox)) return json(404, { ok: false });
    const rows = await deps.store.list(mailbox);
    return json(200, {
      ok: true,
      messages: rows.map((row) => ({
        id: row.id,
        subject: row.subject,
        sizeBytes: row.sizeBytes,
        createdAt: row.createdAt,
      })),
    });
  }

  const one = /^\/v1\/messages\/([^/]+)(\/raw)?$/.exec(url.pathname);
  if (request.method === "GET" && one?.[1]) {
    const row = await deps.store.get(one[1]);
    if (!row) return json(404, { ok: false });
    if (one[2] === "/raw") {
      const bytes = await deps.objects.get(row.objectKey);
      if (!bytes) return json(404, { ok: false });
      return new Response(copyBytes(bytes), { status: 200, headers: { "content-type": "message/rfc822" } });
    }
    return json(200, {
      ok: true,
      id: row.id,
      mailbox: row.mailbox,
      subject: row.subject,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt,
    });
  }

  return json(404, { ok: false });
}
