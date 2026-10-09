import { assert, assertEquals } from "@std/assert";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { handleInbox, type InboxDeps } from "../src/handler.ts";
import { createD1Store, createMemoryStore, type ObjectStore, type Prepared, type SqlDatabase } from "../src/store.ts";

function objects(): ObjectStore & { map: Map<string, Uint8Array> } {
  const map = new Map<string, Uint8Array>();
  return {
    map,
    put(key, body) {
      map.set(key, body);
      return Promise.resolve();
    },
    get(key) {
      return Promise.resolve(map.get(key));
    },
  };
}

function deps(): InboxDeps & { blobs: ReturnType<typeof objects> } {
  const blobs = objects();
  const logs: unknown[] = [];
  return {
    blobs,
    store: createMemoryStore(),
    objects: blobs,
    now: () => "2026-10-09T00:00:00.000Z",
    log(event) {
      logs.push(event);
    },
  };
}

const raw = new TextEncoder().encode("Subject: Mapa\r\n\r\ntexto\r\n");

Deno.test("guarda el raw y la marca de buzón que espera el inbox agéntico", async () => {
  const box = deps();
  const stored = await handleInbox(
    new Request("https://inbox.internal/internal/inbound", {
      method: "POST",
      headers: { "x-envelope-to": "Hackatrain@enrailar.com" },
      body: raw,
    }),
    box,
  );
  assertEquals(stored.status, 202);
  const marker = box.blobs.map.get("mailboxes/hackatrain@enrailar.com.json");
  assert(marker);
  const settings = JSON.parse(new TextDecoder().decode(marker)) as { forwarding: { email: string } };
  assertEquals(settings.forwarding.email, "");
  const listed = await handleInbox(
    new Request("https://inbox.internal/v1/mailboxes/hackatrain@enrailar.com/messages"),
    box,
  );
  const body = await listed.json() as { messages: Array<{ subject: string }> };
  assertEquals(body.messages[0]?.subject, "Mapa");
});

Deno.test("una casilla ajena no se guarda", async () => {
  const box = deps();
  const response = await handleInbox(
    new Request("https://inbox.internal/internal/inbound", {
      method: "POST",
      headers: { "x-envelope-to": "otro@example.com" },
      body: raw,
    }),
    box,
  );
  assertEquals(response.status, 404);
  assertEquals(box.blobs.map.size, 0);
});

Deno.test("D1 no guarda una columna de remitente", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(Deno.readTextFileSync(new URL("../../../apps/api/migrations/0002_inbound.sql", import.meta.url)));
  const sql: SqlDatabase = {
    prepare(statement: string): Prepared {
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
  const store = createD1Store(sql);
  await store.save({
    id: "abc",
    mailbox: "prensa@enrailar.com",
    subject: "Prensa",
    objectKey: "raw/abc",
    sizeBytes: 4,
    createdAt: "2026-10-09T00:00:00.000Z",
  });
  const row = await store.get("abc");
  assertEquals(row?.mailbox, "prensa@enrailar.com");
  const columns = db.prepare("PRAGMA table_info(inbound_messages)").all() as Array<{ name: string }>;
  assert(!columns.some((column) => column.name === "sender" || column.name === "email"));
});
