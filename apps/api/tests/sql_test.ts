import { assert, assertEquals } from "@std/assert";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { createD1Store, type Prepared, type SqlDatabase } from "../src/store.ts";

function open(): { db: DatabaseSync; sql: SqlDatabase } {
  const db = new DatabaseSync(":memory:");
  const sql = Deno.readTextFileSync(new URL("../migrations/0001_init.sql", import.meta.url));
  db.exec(sql);
  const wrapped: SqlDatabase = {
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
  return { db, sql: wrapped };
}

Deno.test("la auditoría en D1 no se puede modificar ni borrar", async () => {
  const { db, sql } = open();
  const store = createD1Store(sql);
  await store.appendAudit({ recordId: "rec-1", kind: "contact.accepted", createdAt: "2026-10-09T00:00:00.000Z" });
  const rows = db.prepare("SELECT record_id, kind FROM audit_events").all() as Array<{ record_id: string; kind: string }>;
  assertEquals(rows, [{ record_id: "rec-1", kind: "contact.accepted" }]);
  let updateFailed = false;
  try {
    db.exec("UPDATE audit_events SET kind = 'no'");
  } catch {
    updateFailed = true;
  }
  let deleteFailed = false;
  try {
    db.exec("DELETE FROM audit_events");
  } catch {
    deleteFailed = true;
  }
  assert(updateFailed);
  assert(deleteFailed);
  const still = db.prepare("SELECT COUNT(*) AS n FROM audit_events").get() as { n: number };
  assertEquals(still.n, 1);
  assert(!JSON.stringify(rows).includes("@"));
  db.close();
});

Deno.test("confirmar y darse de baja no guarda el token en claro", async () => {
  const { db, sql } = open();
  const store = createD1Store(sql);
  const id = await store.saveNewsletterPending({
    id: "sub-1",
    email: "hola@enrailar.com",
    locale: "es",
    confirmTokenHash: "hash-confirm",
    unsubscribeTokenHash: "hash-baja",
    consentAt: "2026-10-09T00:00:00.000Z",
    createdAt: "2026-10-09T00:00:00.000Z",
  });
  assertEquals(id, "sub-1");
  assertEquals(await store.confirmNewsletter("hash-confirm", "2026-10-09T00:01:00.000Z"), "sub-1");
  const row = db.prepare("SELECT status FROM newsletter_subscribers").get() as { status: string };
  assertEquals(row.status, "confirmed");
  assertEquals(await store.unsubscribeNewsletter("hash-baja", "2026-10-09T00:02:00.000Z"), "sub-1");
  db.close();
});

Deno.test("la migración copia fichas viejas y deja las tablas de origen", async () => {
  const { db, sql } = open();
  db.exec(`
    INSERT INTO preinscriptions (id, email, linkedin, message, locale, consent_at, created_at)
    VALUES ('pre-1', 'hola@enrailar.com', 'https://www.linkedin.com/in/ejemplo', 'Quiero el mapa.', 'es', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z');
    INSERT INTO contacts (id, intent, email, linkedin, message, locale, consent_at, created_at)
    VALUES ('con-1', 'sumarme', 'hola@enrailar.com', NULL, 'Quiero sumarme.', 'es', '2026-10-02T00:00:00.000Z', '2026-10-02T00:00:00.000Z');
    INSERT INTO newsletter_subscribers
      (id, email, locale, status, confirm_token_hash, unsubscribe_token_hash, consent_at, confirmed_at, unsubscribed_at, created_at)
    VALUES ('news-1', 'prensa@enrailar.com', 'es', 'confirmed', 'hash-c', 'hash-u', '2026-10-03T00:00:00.000Z', '2026-10-03T00:00:00.000Z', NULL, '2026-10-03T00:00:00.000Z');
  `);
  db.exec(Deno.readTextFileSync(new URL("../migrations/0003_submissions.sql", import.meta.url)));
  const submissions = db.prepare("SELECT id, message FROM submissions ORDER BY id").all() as Array<{ id: string; message: string }>;
  assertEquals(submissions, [
    { id: "con-1", message: "Quiero sumarme." },
    { id: "pre-1", message: "Quiero el mapa." },
  ]);
  const intents = db.prepare("SELECT submission_id, intent FROM submission_intents ORDER BY submission_id, intent").all();
  assertEquals(intents, [
    { submission_id: "con-1", intent: "equipo" },
    { submission_id: "pre-1", intent: "ciudad" },
    { submission_id: "pre-1", intent: "hackatrain" },
  ]);
  const stillPre = db.prepare("SELECT COUNT(*) AS n FROM preinscriptions").get() as { n: number };
  const stillContact = db.prepare("SELECT COUNT(*) AS n FROM contacts").get() as { n: number };
  const stillNews = db.prepare("SELECT COUNT(*) AS n FROM newsletter_subscribers").get() as { n: number };
  assertEquals(stillPre.n, 1);
  assertEquals(stillContact.n, 1);
  assertEquals(stillNews.n, 1);
  const store = createD1Store(sql);
  await store.insertSubmission({
    id: "sum-1",
    email: "hackatrain@enrailar.com",
    name: undefined,
    city: "Tandil",
    link: "https://enrailar.com",
    message: undefined,
    locale: "en",
    intents: ["donar", "boletin"],
    consentAt: "2026-10-09T00:00:00.000Z",
    createdAt: "2026-10-09T00:00:00.000Z",
  });
  const added = db.prepare("SELECT intent FROM submission_intents WHERE submission_id = 'sum-1' ORDER BY intent").all() as Array<{ intent: string }>;
  assertEquals(added.map((row) => row.intent), ["boletin", "donar"]);
  db.close();
});
