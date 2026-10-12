import { assert } from "@std/assert";

const picture = Deno.readTextFileSync(new URL("../app/components/picture.tsx", import.meta.url));

Deno.test("las figuras salen de /brand/img y no de una ruta por locale", () => {
  assert(picture.includes("return `/brand/img/${name}-${width}.${ext}`"));
  assert(picture.includes("const JPEG_WIDTHS = [1280]"));
  assert(!picture.includes("480.jpg"));
  assert(!picture.includes("768.jpg"));
  assert(!picture.includes("${locale}/brand"));
  assert(!picture.includes("`brand/img"));
  assert(!picture.includes("\"brand/img"));
});
