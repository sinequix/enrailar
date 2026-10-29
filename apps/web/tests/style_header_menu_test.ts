import { assert } from "@std/assert";
import { COPY } from "../src/copy.ts";

const css = Deno.readTextFileSync(
  new URL("../app/globals.css", import.meta.url),
);
const header = Deno.readTextFileSync(
  new URL("../app/components/site-header.tsx", import.meta.url),
);

Deno.test("en mobile y tablet el header es una fila y el menú se cierra con Escape", () => {
  assert(css.includes(".nav-links {\n  display: contents;"));
  assert(css.includes(".nav-toggle {\n  display: none;"));
  // Hasta 1160 px la fila completa no entra: se partía en dos o tres filas en tablet.
  assert(!css.includes("@media (max-width: 860px)"));
  const start = css.indexOf("@media (max-width: 1160px)");
  assert(start > 0);
  const narrow = css.slice(start);
  assert(narrow.includes(".site-header .wrap {\n    flex-wrap: nowrap;"));
  assert(narrow.includes("align-items: center;"));
  assert(narrow.includes(".nav-toggle {\n    display: inline-flex;"));
  assert(narrow.includes(".nav-links.is-open {\n    display: flex;"));
  assert(header.includes("aria-expanded={open}"));
  assert(header.includes('event.key !== "Escape"'));
  assert(header.includes('className="lang"'));
  assert(header.includes("/cuenta/crear"));
  assertEqualsCopy();
});

function assertEqualsCopy(): void {
  assert(COPY.es.nav.menuOpen === "Abrir menú");
  assert(COPY.en.nav.menuOpen === "Open menu");
  assert(COPY.es.nav.menuClose === "Cerrar menú");
  assert(COPY.en.nav.menuClose === "Close menu");
}
