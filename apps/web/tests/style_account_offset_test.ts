import { assert } from "@std/assert";

const css = Deno.readTextFileSync(new URL("../app/globals.css", import.meta.url));

Deno.test("el título de la cuenta queda debajo del header fijo", () => {
  assert(css.includes("scroll-padding-top: 6.5rem"));
  assert(css.includes(".account-page h1 {\n  margin-bottom: var(--s-5);\n  scroll-margin-top: 6.5rem;"));
});
