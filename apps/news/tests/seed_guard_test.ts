import { assertEquals } from "@std/assert";
import { CREATE_SEED_FLAG_SQL, runSeedOnce, SEED_FLAG_ID } from "../src/lib/seed-guard.ts";

Deno.test("el seed corre una vez y no recrea la nota si la borran", async () => {
  let flag = false;
  let notes = 0;
  let applies = 0;
  const store = {
    flagSet: () => Promise.resolve(flag),
    applyContent: () => {
      applies += 1;
      notes = 1;
      return Promise.resolve();
    },
    markApplied: () => {
      flag = true;
      return Promise.resolve();
    },
  };

  assertEquals(await runSeedOnce(store), "applied");
  assertEquals(applies, 1);
  assertEquals(notes, 1);

  notes = 0;
  assertEquals(await runSeedOnce(store), "skipped");
  assertEquals(applies, 1);
  assertEquals(notes, 0);
});

Deno.test("la marca en sqlite sobrevive si se borra la nota", async () => {
  const script = `
    import { DatabaseSync } from "node:sqlite";
    const db = new DatabaseSync(":memory:");
    db.exec(${JSON.stringify(CREATE_SEED_FLAG_SQL)});
    db.exec("CREATE TABLE ec_noticia (slug TEXT)");
    db.prepare("INSERT INTO ec_noticia (slug) VALUES (?)").run("ypf-arena-fractura-vaca-muerta");
    db.prepare("INSERT INTO enrailar_news_seed (id, applied_at) VALUES (?, ?)").run(${JSON.stringify(SEED_FLAG_ID)}, "2026-10-17T18:00:00.000Z");
    db.exec("DELETE FROM ec_noticia");
    const flag = db.prepare("SELECT id FROM enrailar_news_seed WHERE id = ?").get(${JSON.stringify(SEED_FLAG_ID)});
    const notes = db.prepare("SELECT COUNT(*) AS n FROM ec_noticia").get();
    console.log(JSON.stringify({ flag: flag?.id ?? null, notes: notes.n }));
  `;
  const result = await new Deno.Command("node", {
    args: ["--input-type=module", "-e", script],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assertEquals(result.code, 0, new TextDecoder().decode(result.stderr));
  const row = JSON.parse(new TextDecoder().decode(result.stdout)) as { flag: string | null; notes: number };
  assertEquals(row.flag, SEED_FLAG_ID);
  assertEquals(row.notes, 0);
});

Deno.test("las páginas públicas no escriben el seed", async () => {
  const root = new URL("../src/", import.meta.url);
  const noticia = await Deno.readTextFile(new URL("lib/noticia.ts", root));
  const pages = await Deno.readTextFile(new URL("pages/index.astro", root));
  const slug = await Deno.readTextFile(new URL("pages/[slug].astro", root));
  const middleware = await Deno.readTextFile(new URL("middleware.ts", root));
  assertEquals(noticia.includes("ensureNoticiaSeed"), false);
  assertEquals(pages.includes("ensureNoticiaSeed"), false);
  assertEquals(slug.includes("ensureNoticiaSeed"), false);
  assertEquals(middleware.includes("ensureNoticiaSeed"), true);
  assertEquals(middleware.includes('newsAccess === "allow"'), true);
});
