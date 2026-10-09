import { HACKATRAIN_START, HACKATRAIN_WHEN, JOIN_INTENTS } from "@enrailar/shared";
import { assert, assertEquals } from "@std/assert";
import { ARTICLE_URL, COPY } from "../src/copy.ts";
import { POSTS } from "../src/posts.ts";
import { apiOrigin, formPath, intentsFromHash, parseSubmission, parseSumate, SUMATE_PATH, SUMATE_PRESELECT } from "../src/submit.ts";

Deno.test("el hackatrain muestra el mes y no una fecha", () => {
  assertEquals(ARTICLE_URL, "https://x.com/tebayoso/status/2107894676426559739");
  assertEquals(HACKATRAIN_START, null);
  assertEquals(HACKATRAIN_WHEN.es, "Febrero 2027");
  assertEquals(HACKATRAIN_WHEN.en, "February 2027");
  for (const locale of ["es", "en"] as const) {
    const text = [
      POSTS[locale].paragraphs.join("\n"),
      COPY[locale].countdownNote,
      COPY[locale].hackatrainTitle,
      COPY[locale].description,
    ].join("\n");
    assert(text.includes(ARTICLE_URL));
    assert(text.includes("Tandil"));
    assert(text.includes(HACKATRAIN_WHEN[locale]));
    assert(!text.includes("$"));
    assert(!text.includes("2027-02-01"));
    assert(!text.includes("1 de febrero de 2027"));
    assert(!text.includes("1 February 2027"));
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

Deno.test("la ficha única preselecciona desde el hash y exige una intención", () => {
  assertEquals(SUMATE_PRESELECT, "#sumate?quiero=hackatrain");
  assertEquals(intentsFromHash(SUMATE_PRESELECT), ["hackatrain"]);
  assertEquals(intentsFromHash("#sumate?quiero=hackatrain,boletin"), ["hackatrain", "boletin"]);
  assertEquals(intentsFromHash("#sumate?quiero=no-existe"), []);
  assertEquals(intentsFromHash("#sumate"), []);
  const parsed = parseSumate({
    intents: ["ciudad", "boletin"],
    email: "hola@enrailar.com",
    name: "",
    city: "Tandil",
    link: "https://enrailar.com",
    message: "",
    locale: "es",
    consent: true,
    turnstileToken: "token",
    company_url: "",
  });
  assert(parsed.success);
  assertEquals(SUMATE_PATH, "/v1/sumate");
  assert(!parseSumate({
    intents: [],
    email: "",
    name: "",
    city: "",
    link: "",
    message: "",
    locale: "es",
    consent: false,
    turnstileToken: "",
    company_url: "",
  }).success);
  const page = Deno.readTextFileSync(new URL("../app/[locale]/page.tsx", import.meta.url));
  assertEquals(page.match(/href=\{SUMATE_PRESELECT\}/g)?.length, 2);
  const header = Deno.readTextFileSync(new URL("../app/components/site-header.tsx", import.meta.url));
  assert(header.includes("#sumate"));
  assert(!header.includes("quiero="));
  for (const locale of ["es", "en"] as const) {
    assert(!COPY[locale].joinLede.includes("Tres formas"));
    assert(!COPY[locale].joinLede.includes("Three ways"));
    for (const intent of JOIN_INTENTS) {
      assert(COPY[locale].intents[intent].length > 0);
    }
  }
});
