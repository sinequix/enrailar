import { assertEquals } from "@std/assert";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { optionalSecret } from "../src/clickup-env.ts";

function readToken(env: Record<string, string>) {
  return optionalSecret("CLICKUP_API_TOKEN").parse(ConfigProvider.fromEnv({ env }));
}

Deno.test("el token ausente queda vacío", async () => {
  const value = await Effect.runPromise(readToken({}));
  assertEquals(Redacted.value(value), "");
});

Deno.test("el token presente se guarda redactado", async () => {
  const value = await Effect.runPromise(readToken({ CLICKUP_API_TOKEN: "  token-de-prueba  " }));
  assertEquals(Redacted.value(value), "token-de-prueba");
  assertEquals(String(value).includes("token-de-prueba"), false);
});
