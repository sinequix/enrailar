import { assert } from "@std/assert";

const css = Deno.readTextFileSync(new URL("../app/globals.css", import.meta.url));

Deno.test("el pie se apoya al fondo y la columna del logo no se hunde", () => {
  assert(css.includes("min-height: 100dvh;\n  display: flex;\n  flex-direction: column;"));
  assert(css.includes("body > main,\nbody > .app-frame {\n  flex: 1 0 auto;\n}"));
  assert(css.includes("grid-template-columns: minmax(11rem, 2fr) repeat(2, minmax(0, 1fr));\n  align-items: start;"));
});
