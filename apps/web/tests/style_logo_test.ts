import { assert } from "@std/assert";

const css = Deno.readTextFileSync(new URL("../app/globals.css", import.meta.url));
const header = Deno.readTextFileSync(new URL("../app/components/site-header.tsx", import.meta.url));
const footer = Deno.readTextFileSync(new URL("../app/components/site-footer.tsx", import.meta.url));

Deno.test("el logo del header y del pie no se aplasta ni depende del locale", () => {
  assert(css.includes(".brand {\n  display: inline-flex;\n  align-items: center;\n  flex: none;"));
  assert(css.includes("max-width: none;"));
  assert(header.includes('src="/brand/logo-horizontal.svg"'));
  assert(footer.includes('src="/brand/logo-horizontal.svg"'));
  assert(!footer.includes("loading=\"lazy\""));
  assert(!header.includes("src=\"brand/"));
  assert(!footer.includes("src=\"brand/"));
  assert(!header.includes("${locale}/brand"));
  assert(!footer.includes("${locale}/brand"));
});
