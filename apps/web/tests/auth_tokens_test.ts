import { assert, assertEquals } from "@std/assert";
import { DatabaseSync } from "node:sqlite";
import { consumeVerifyToken, storeVerifyToken } from "../src/auth-tokens.ts";
import { createMemoryDatabase } from "../dev/memory-db.ts";

function open() {
  const sqlite = new DatabaseSync(":memory:");
  const dir = new URL("../../api/migrations/", import.meta.url);
  const names = [...Deno.readDirSync(dir)].map((entry) => entry.name).filter((name) => name.endsWith(".sql")).sort();
  sqlite.exec(names.map((name) => Deno.readTextFileSync(new URL(name, dir))).join("\n"));
  return { sqlite, db: createMemoryDatabase(sqlite) };
}

const token = "abcdefghij.KLMNOPQR.stuvwxyz";

Deno.test("el token de verificación se usa una vez y no se guarda en claro", async () => {
  const { sqlite, db } = open();
  try {
    await storeVerifyToken(db, token, new Date("2026-10-14T12:00:00.000Z"));
    const listed = await db.prepare("SELECT identifier, value FROM verification").bind().all<{ identifier: string; value: string }>();
    const dump = JSON.stringify(listed.results);
    assert(!dump.includes(token));
    assert(listed.results.some((row) => row.identifier.startsWith("auth-verify:") && row.value === "pending"));
    assertEquals(await consumeVerifyToken(db, token, new Date("2026-10-14T12:30:00.000Z")), true);
    assertEquals(await consumeVerifyToken(db, token, new Date("2026-10-14T12:30:00.000Z")), false);
  } finally {
    sqlite.close();
  }
});

Deno.test("un token vencido o ajeno no pasa", async () => {
  const { sqlite, db } = open();
  try {
    await storeVerifyToken(db, token, new Date("2026-10-14T12:00:00.000Z"));
    assertEquals(await consumeVerifyToken(db, token, new Date("2026-10-14T14:00:00.000Z")), false);
    assertEquals(await consumeVerifyToken(db, "otro-token-valido", new Date("2026-10-14T12:01:00.000Z")), false);
    assertEquals(await consumeVerifyToken(db, "corto", new Date("2026-10-14T12:01:00.000Z")), false);
  } finally {
    sqlite.close();
  }
});
