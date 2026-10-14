import { assert, assertEquals } from "@std/assert";
import {
  AUTH_LINK_TTL_SECONDS,
  ROLE_MAILBOXES,
  TRANSACTIONAL_FROM,
} from "../src/project.ts";

Deno.test("el remitente de cuenta no es una casilla de entrada", () => {
  assertEquals(TRANSACTIONAL_FROM, "no-responder@enrailar.com");
  assertEquals(AUTH_LINK_TTL_SECONDS, 60 * 60);
  assert(!(ROLE_MAILBOXES as readonly string[]).includes(TRANSACTIONAL_FROM));
});
