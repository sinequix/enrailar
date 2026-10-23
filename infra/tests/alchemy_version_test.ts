import { assertEquals } from "@std/assert";

Deno.test("Alchemy y sus entrypoints de frontend usan la misma versión requerida", async () => {
  const infra = JSON.parse(await Deno.readTextFile(new URL("../package.json", import.meta.url)));
  const news = JSON.parse(await Deno.readTextFile(new URL("../../apps/news/package.json", import.meta.url)));
  const alchemy = infra.dependencies.alchemy;
  assertEquals(infra.dependencies["@alchemy.run/frontend-frameworks"], alchemy);
  assertEquals(news.devDependencies["@alchemy.run/frontend-frameworks"], alchemy);
});
