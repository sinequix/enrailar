import { assert, assertEquals } from "@std/assert";
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

Deno.test("cada worker lee su propia lista", async () => {
  const stack = await Deno.readTextFile(new URL("../alchemy.run.ts", import.meta.url));
  const api = await Deno.readTextFile(new URL("../../apps/api/src/worker-deps.ts", import.meta.url));
  const email = await Deno.readTextFile(new URL("../../workers/email-in/src/worker.ts", import.meta.url));
  assert(stack.includes("CLICKUP_LIST_ID_WEB"));
  assert(stack.includes("CLICKUP_LIST_ID_CONTACTS"));
  assert(!/\bCLICKUP_LIST_ID\b/.test(stack));
  assert(api.includes("CLICKUP_LIST_ID_WEB"));
  assert(!api.includes("CLICKUP_LIST_ID_CONTACTS"));
  assert(email.includes("CLICKUP_LIST_ID_CONTACTS"));
  assert(!email.includes("CLICKUP_LIST_ID_WEB"));
});

Deno.test("el token presente se guarda redactado", async () => {
  const value = await Effect.runPromise(readToken({ CLICKUP_API_TOKEN: "  token-de-prueba  " }));
  assertEquals(Redacted.value(value), "token-de-prueba");
  assertEquals(String(value).includes("token-de-prueba"), false);
});
