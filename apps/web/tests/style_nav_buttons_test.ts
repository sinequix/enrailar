import { assert } from "@std/assert";

const css = Deno.readTextFileSync(new URL("../app/globals.css", import.meta.url));

Deno.test("los botones de cuenta del nav no heredan el color ni el padding del enlace", () => {
  assert(css.includes(".nav a.btn {\n  flex: none;\n  white-space: nowrap;\n  padding: 0.8rem 1.25rem;"));
  assert(css.includes("color: var(--sh-primary-foreground);\n  background: var(--sh-primary);"));
  assert(css.includes(".nav a.btn--ghost {\n  color: var(--accent);\n  background: transparent;"));
});
