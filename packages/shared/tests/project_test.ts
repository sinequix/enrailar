import { assert, assertEquals } from "@std/assert";
import {
  AUTH_LINK_TTL_SECONDS,
  NEWS_HOST,
  NEWS_ORIGIN,
  PUBLIC_CONTACT,
  ROLE_MAILBOXES,
  TRANSACTIONAL_FROM,
} from "../src/project.ts";

Deno.test("el remitente de cuenta no es una casilla de entrada", () => {
  assertEquals(TRANSACTIONAL_FROM, "no-responder@enrailar.com");
  assertEquals(AUTH_LINK_TTL_SECONDS, 60 * 60);
  assert(!(ROLE_MAILBOXES as readonly string[]).includes(TRANSACTIONAL_FROM));
  assertEquals(PUBLIC_CONTACT, "hola@enrailar.com");
  assertEquals(ROLE_MAILBOXES[0], PUBLIC_CONTACT);
  assertEquals(NEWS_HOST, "noticias.enrailar.com");
  assertEquals(NEWS_ORIGIN, "https://noticias.enrailar.com");
});
