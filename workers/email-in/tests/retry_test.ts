import { assertEquals } from "@std/assert";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { syncContact } from "../src/crm.ts";
import type { InboundContact } from "../src/contact.ts";
import { createRetryStore, type SqlDatabase } from "../src/retry.ts";

function storeFrom(db: DatabaseSync) {
  let clock = 0;
  const sql: SqlDatabase = {
    prepare(statement: string) {
      const prepared = db.prepare(statement);
      return {
        bind(...values: unknown[]) {
          return {
            all<T>() {
              return Promise.resolve({ results: prepared.all(...(values as SQLInputValue[])) as T[] });
            },
            first<T>() {
              const row = prepared.get(...(values as SQLInputValue[]));
              return Promise.resolve((row ?? null) as T | null);
            },
            run() {
              prepared.run(...(values as SQLInputValue[]));
              return Promise.resolve({});
            },
          };
        },
      };
    },
  };
  return createRetryStore(sql, () => {
    clock += 1;
    return `2026-10-16T00:00:${String(clock).padStart(2, "0")}.000Z`;
  });
}

const contact: InboundContact = {
  messageId: "<abc@example.com>",
  sender: "remitente@example.com",
  subject: "Mapa",
  body: "Quiero ver el mapa.",
};

Deno.test("un fallo de ClickUp deja la fila y el éxito la borra", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(Deno.readTextFileSync(new URL("../../../apps/api/migrations/0007_crm_email_retry.sql", import.meta.url)));
  const store = storeFrom(db);
  const fetchImpl: typeof fetch = () => Promise.resolve(new Response("no", { status: 503 }));
  const result = await syncContact({
    token: "token",
    listId: "90170000001",
    store,
    fetchImpl,
  }, contact);
  assertEquals(result, "retry");
  const pending = await store.pending(10);
  assertEquals(pending, [contact]);
  const rows = db.prepare("SELECT attempts FROM crm_email_retries").all() as { attempts: number }[];
  assertEquals(rows, [{ attempts: 0 }]);
  const bodies: string[] = [];
  const ok: typeof fetch = (input, init) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (typeof init?.body === "string") bodies.push(init.body);
    if (method === "GET" && path.endsWith("/field")) {
      return Promise.resolve(new Response(JSON.stringify({
        fields: [
          { id: "field-email", name: "email", type: "email" },
          { id: "field-fuente", name: "fuente", type: "short_text" },
        ],
      }), { status: 200 }));
    }
    if (method === "GET" && path.includes("/task?")) {
      return Promise.resolve(new Response(JSON.stringify({ tasks: [] }), { status: 200 }));
    }
    if (method === "POST" && path.endsWith("/task")) {
      return Promise.resolve(new Response(JSON.stringify({ id: "task-1" }), { status: 200 }));
    }
    return Promise.resolve(new Response("", { status: 200 }));
  };
  const synced = await syncContact({
    token: "token",
    listId: "90170000001",
    store,
    fetchImpl: ok,
  }, contact);
  assertEquals(synced, "synced");
  assertEquals(await store.pending(10), []);
  const created = bodies
    .map((body) => JSON.parse(body) as { name?: string; markdown_description?: string; comment_text?: string })
    .find((body) => body.name !== undefined);
  assertEquals(created?.name, "Mapa");
  assertEquals(String(created?.markdown_description).includes("@"), false);
  const note = bodies
    .map((body) => JSON.parse(body) as { comment_text?: string })
    .find((body) => body.comment_text !== undefined);
  assertEquals(note?.comment_text?.includes("remitente@example.com"), true);
  db.close();
});

Deno.test("sin token no llama a ClickUp y queda para reintentar", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(Deno.readTextFileSync(new URL("../../../apps/api/migrations/0007_crm_email_retry.sql", import.meta.url)));
  const store = storeFrom(db);
  let called = false;
  const result = await syncContact({
    token: " ",
    listId: "90170000001",
    store,
    fetchImpl: () => {
      called = true;
      return Promise.resolve(new Response("{}", { status: 200 }));
    },
  }, contact);
  assertEquals(result, "retry");
  assertEquals(called, false);
  assertEquals((await store.pending(10)).length, 1);
  db.close();
});

Deno.test("la fila no se duplica si el mismo mensaje falla otra vez", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(Deno.readTextFileSync(new URL("../../../apps/api/migrations/0007_crm_email_retry.sql", import.meta.url)));
  const store = storeFrom(db);
  await store.mark(contact);
  await store.bump(contact.messageId);
  await store.mark({ ...contact, subject: "De nuevo" });
  const rows = db.prepare("SELECT subject, attempts FROM crm_email_retries").all() as {
    subject: string;
    attempts: number;
  }[];
  assertEquals(rows, [{ subject: "De nuevo", attempts: 1 }]);
  db.close();
});
