import { assert } from "@std/assert";

const css = Deno.readTextFileSync(new URL("../app/globals.css", import.meta.url));

Deno.test("la card del blog ocupa el ancho de la grilla, también en móvil", () => {
  const posts = css.slice(css.indexOf(".posts {"), css.indexOf(".post-card {"));
  assert(posts.includes("grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));"));
  assert(!posts.includes("max-width: 44rem"));
});
