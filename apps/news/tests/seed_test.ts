import { assert, assertEquals } from "@std/assert";
import { CATEGORY_OPTIONS, LINE_OPTIONS, YPF_SLUG } from "../src/host.ts";

const root = new URL("..", import.meta.url);
const seedPath = new URL("../seed/seed.json", import.meta.url);

interface SeedField {
  slug: string;
  type: string;
  required?: boolean;
}

interface SeedFile {
  version: string;
  defaultLocale: string;
  collections: Array<{
    slug: string;
    fields: SeedField[];
  }>;
  taxonomies: Array<{ name: string; collections: string[] }>;
  content: {
    noticia: Array<{
      slug: string;
      status: string;
      locale: string;
      data: Record<string, unknown>;
    }>;
  };
}

function readSeed(): SeedFile {
  return JSON.parse(Deno.readTextFileSync(seedPath)) as SeedFile;
}

Deno.test("el seed declara la colección noticia y la nota de YPF", () => {
  const seed = readSeed();
  assertEquals(seed.version, "1");
  assertEquals(seed.defaultLocale, "es");
  const collection = seed.collections.find((item) => item.slug === "noticia");
  assert(collection);
  const fields = new Map(collection.fields.map((field) => [field.slug, field]));
  for (const slug of ["title", "summary", "body", "source_name", "source_url", "original_post_url", "via", "lines", "category"]) {
    assert(fields.has(slug), slug);
  }
  assertEquals(fields.get("lines")?.type, "multiSelect");
  assertEquals(fields.get("category")?.type, "select");
  assertEquals(fields.get("body")?.type, "portableText");
  assertEquals(fields.get("original_post_url")?.required, undefined);
  assertEquals(fields.get("via")?.required, undefined);
  assert(!fields.has("slug"));
  assert(!fields.has("published_at"));
  const lines = collection.fields.find((field) => field.slug === "lines") as SeedField & { validation?: { options?: string[] } };
  assertEquals(lines.validation?.options, [...LINE_OPTIONS]);
  const category = collection.fields.find((field) => field.slug === "category") as SeedField & { validation?: { options?: string[] } };
  assertEquals(category.validation?.options, [...CATEGORY_OPTIONS]);
  assertEquals(seed.taxonomies[0]?.name, "etiqueta");
  assertEquals(seed.taxonomies[0]?.collections, ["noticia"]);

  const item = seed.content.noticia.find((entry) => entry.slug === YPF_SLUG);
  assert(item);
  assertEquals(item.status, "published");
  assertEquals(item.locale, "es");
  assertEquals(item.data.category, "carga");
  assertEquals(item.data.lines, ["Urquiza", "Mitre", "San Martín"]);
  assertEquals(item.data.source_name, "Diario Río Negro");
  assert(String(item.data.source_url).startsWith("https://www.rionegro.com.ar/"));
  assertEquals(item.data.original_post_url, "https://x.com/CristianGeo7/status/2111513323363557489");
  assertEquals(item.data.via, "@sebaherrera");
  const prose = `${item.data.summary}\n${JSON.stringify(item.data.body)}`;
  assert(prose.includes("Horacio Marín"));
  assert(prose.includes("un millón de toneladas"));
  for (const banned of ["Ya estamos", "EnergíaON", "Palmira", "dólares", "Victoria"]) {
    assert(!prose.includes(banned), banned);
  }
});

Deno.test("emdash valida el seed y lo aplica en sqlite", async () => {
  const directory = await Deno.makeTempDir({ prefix: "enrailar-news-" });
  const database = `${directory}/news.db`;
  const cwd = Deno.realPathSync(root);
  const validate = await new Deno.Command("pnpm", {
    args: ["exec", "emdash", "seed", "seed/seed.json", "--validate"],
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();
  assertEquals(validate.code, 0, new TextDecoder().decode(validate.stderr));

  const apply = await new Deno.Command("pnpm", {
    args: ["exec", "emdash", "seed", "seed/seed.json", "--database", database],
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();
  assertEquals(apply.code, 0, new TextDecoder().decode(apply.stderr));

  const query = await new Deno.Command("node", {
    args: ["--input-type=module", "-e", `
      import { DatabaseSync } from "node:sqlite";
      const db = new DatabaseSync(${JSON.stringify(database)});
      const row = db.prepare("select slug, status, locale, category, lines, source_name from ec_noticia").get();
      console.log(JSON.stringify(row));
    `],
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();
  assertEquals(query.code, 0, new TextDecoder().decode(query.stderr));
  const row = JSON.parse(new TextDecoder().decode(query.stdout)) as {
    slug: string;
    status: string;
    locale: string;
    category: string;
    lines: string;
    source_name: string;
  };
  assertEquals(row.slug, YPF_SLUG);
  assertEquals(row.status, "published");
  assertEquals(row.locale, "es");
  assertEquals(row.category, "carga");
  assertEquals(row.source_name, "Diario Río Negro");
  assertEquals(JSON.parse(row.lines), ["Urquiza", "Mitre", "San Martín"]);
});
