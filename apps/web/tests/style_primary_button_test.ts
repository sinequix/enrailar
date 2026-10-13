import { assert } from "@std/assert";

const css = Deno.readTextFileSync(new URL("../app/globals.css", import.meta.url));
const button = Deno.readTextFileSync(new URL("../app/components/ui/button.tsx", import.meta.url));

Deno.test("el submit usa el primario de shadcn y el disabled se distingue", () => {
  assert(button.includes("border-primary bg-primary text-primary-foreground"));
  assert(button.includes("disabled:bg-[var(--gris-100)]"));
  assert(button.includes("disabled:text-[var(--ink)]"));
  assert(!button.includes("disabled:opacity-60"));
  assert(css.includes("background: var(--sh-primary);\n  color: var(--sh-primary-foreground);"));
  assert(css.includes(".btn[disabled],\n.btn:disabled {\n  background: var(--gris-100);"));
  assert(!css.includes("opacity: 0.6"));
});
