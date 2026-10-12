import { assert } from "@std/assert";

const css = Deno.readTextFileSync(new URL("../app/globals.css", import.meta.url));

Deno.test("el header sticky no lleva el blur que lo suelta sobre Sumate", () => {
  const header = css.slice(css.indexOf(".site-header {"), css.indexOf(".site-header::before"));
  assert(header.includes("position: sticky"));
  assert(header.includes("z-index: 60"));
  assert(!header.includes("backdrop-filter"));
  assert(!header.includes("transform"));
  const veil = css.slice(css.indexOf(".site-header::before {"), css.indexOf(".site-header .wrap"));
  assert(veil.includes("backdrop-filter: blur(10px)"));
  assert(css.includes(".join {\n  position: relative;\n  z-index: 0;"));
});
