import { HACKATRAIN_START } from "@enrailar/shared";
import { assert, assertEquals } from "@std/assert";
import { ARTICLE_URL, COPY } from "../src/copy.ts";
import { POSTS } from "../src/posts.ts";
import { apiOrigin, formPath, parseSubmission } from "../src/submit.ts";

Deno.test("el primer post enlaza la nota y la cuenta usa el 1 de febrero", () => {
  assertEquals(ARTICLE_URL, "https://x.com/tebayoso/status/2107894676426559739");
  assertEquals(HACKATRAIN_START, "2027-02-01T00:00:00-03:00");
  for (const locale of ["es", "en"] as const) {
    const text = POSTS[locale].paragraphs.join("\n");
    assert(text.includes(ARTICLE_URL));
    assert(text.includes("Tandil"));
    assert(!text.includes("$"));
    assert(COPY[locale].countdownNote.length > 0);
  }
});

Deno.test("contacto, preinscripción y boletín usan el mismo contrato", () => {
  const base = {
    email: "hola@enrailar.com",
    linkedin: "https://www.linkedin.com/in/ejemplo",
    message: "Quiero ver el mapa.",
    locale: "es",
    consent: true,
    turnstileToken: "token",
    company_url: "",
  };
  assert(parseSubmission("preinscripcion", base).success);
  assert(parseSubmission("contacto", { ...base, intent: "donar" }).success);
  assert(parseSubmission("newsletter", base).success);
  assertEquals(formPath("contacto"), "/v1/contacto");
  assertEquals(apiOrigin(undefined), "https://api.enrailar.com");
  assertEquals(apiOrigin("https://api.example.test/"), "https://api.example.test");
});
