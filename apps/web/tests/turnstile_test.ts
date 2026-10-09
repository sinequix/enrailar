import { assertEquals } from "@std/assert";
import { resolveTurnstileSiteKey, turnstileSiteKeyFromProcess } from "../src/turnstile.ts";

Deno.test("la clave de Turnstile sale del binding del Worker antes que de NEXT_PUBLIC", () => {
  assertEquals(resolveTurnstileSiteKey({}), "");
  assertEquals(resolveTurnstileSiteKey({ TURNSTILE_SITE_KEY: "  " }), "");
  assertEquals(resolveTurnstileSiteKey({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "pub" }), "pub");
  assertEquals(resolveTurnstileSiteKey({ TURNSTILE_SITE_KEY: " bind ", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "pub" }), "bind");
});

Deno.test("la lectura del proceso no explota sin variable", () => {
  Deno.env.delete("TURNSTILE_SITE_KEY");
  Deno.env.delete("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  assertEquals(turnstileSiteKeyFromProcess(), "");
  Deno.env.set("TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
  assertEquals(turnstileSiteKeyFromProcess(), "1x00000000000000000000AA");
  Deno.env.delete("TURNSTILE_SITE_KEY");
});
