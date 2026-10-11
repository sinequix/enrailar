import { assertEquals } from "@std/assert";
import {
  CLICKUP_BUDGET_PER_MINUTE,
  rateLimitDelayMs,
  throttleDelayMs,
} from "./rate-limit.ts";

Deno.test("un 429 espera hasta X-RateLimit-Reset", () => {
  const now = 1_700_000_000_000;
  const resetSec = 1_700_000_010;
  assertEquals(rateLimitDelayMs(String(resetSec), now), 10_000 + 250);
});

Deno.test("un reset en el pasado no espera", () => {
  assertEquals(rateLimitDelayMs("100", 1_700_000_000_000), 0);
});

Deno.test("sin header espera un minuto", () => {
  assertEquals(rateLimitDelayMs(null, 0), 60_000);
  assertEquals(rateLimitDelayMs("no-es-numero", 0), 60_000);
});

Deno.test("un timestamp en milisegundos también se entiende", () => {
  const now = 1_700_000_000_000;
  assertEquals(rateLimitDelayMs(String(now + 5_000), now), 5_000 + 250);
});

Deno.test("la ráfaga se frena antes de las 100 por minuto", () => {
  const now = 60_000;
  const recent = Array.from(
    { length: CLICKUP_BUDGET_PER_MINUTE - 1 },
    () => now - 1_000,
  );
  assertEquals(throttleDelayMs(recent, now), 0);
  const full = [...recent, now - 500];
  assertEquals(throttleDelayMs(full, now) > 0, true);
});
