import { HACKATRAIN_START, HACKATRAIN_WHEN, JOIN_INTENTS } from "@enrailar/shared";
import { assert, assertEquals } from "@std/assert";
import { ARTICLE_URL, COPY } from "../src/copy.ts";
import { POSTS } from "../src/posts.ts";
import {
  createSumateMemory,
  maskEmail,
  parseSumateMemory,
  SUMATE_MEMORY_KEY,
  sumateBootScript,
} from "../src/sumate-memory.ts";
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
  assertEquals(COPY.es.alreadyTitle, "Ya te anotaste. Pronto nos vamos a contactar.");
  assertEquals(COPY.en.alreadyTitle, "You're already signed up. We'll be in touch soon.");
  assertEquals(COPY.es.alreadyAgain, "Enviar otro mensaje");
  assertEquals(COPY.en.alreadyAgain, "Send another message");
});

Deno.test("el recuerdo de Sumate no guarda el correo", () => {
  const mask = "j***@pox.me";
  assertEquals(maskEmail("jx@pox.me"), mask);
  assertEquals(maskEmail("sin-arroba"), undefined);
  const memory = createSumateMemory({
    at: "2026-10-09T15:00:00.000Z",
    intents: ["hackatrain", "boletin", "hackatrain"],
    email: "jx@pox.me",
  });
  assert(memory);
  assertEquals(memory.intents, ["hackatrain", "boletin"]);
  assertEquals(memory.newsletter, true);
  assertEquals(memory.emailMask, mask);
  const stored = JSON.stringify(memory);
  assert(stored.includes(mask));
  assert(!stored.includes("jx@pox.me"));
  assertEquals(Object.keys(memory).sort(), ["at", "emailMask", "intents", "newsletter"]);
  assertEquals(parseSumateMemory(stored), memory);
  assertEquals(parseSumateMemory("no-json"), undefined);
  assertEquals(parseSumateMemory(JSON.stringify({ at: "ayer", intents: ["hackatrain"], newsletter: false })), undefined);
  const leaked = parseSumateMemory(JSON.stringify({
    at: "2026-10-09T15:00:00.000Z",
    intents: ["ciudad"],
    newsletter: false,
    email: "jx@pox.me",
    emailMask: "jx@pox.me",
    name: "Ada",
  }));
  assert(leaked);
  assertEquals(leaked.emailMask, undefined);
  assertEquals(leaked.intents, ["ciudad"]);
  assert(!JSON.stringify(leaked).includes("jx@"));
  assert(!JSON.stringify(leaked).includes("Ada"));
  const boot = sumateBootScript();
  assert(boot.includes(SUMATE_MEMORY_KEY));
  assert(!boot.includes("jx@pox.me"));
  const attrs = new Map<string, string>();
  const styles: string[] = [];
  const storage = new Map<string, string>([[SUMATE_MEMORY_KEY, stored]]);
  const run = new Function("localStorage", "document", boot);
  run(
    { getItem: (key: string) => storage.get(key) ?? null },
    {
      documentElement: {
        setAttribute: (name: string, value: string) => attrs.set(name, value),
      },
      createElement: () => ({ id: "", textContent: "" }),
      head: {
        appendChild: (node: { textContent: string }) => styles.push(node.textContent),
      },
    },
  );
  assertEquals(attrs.get("data-sumate"), "saved");
  assertEquals(attrs.get("data-sumate-hackatrain"), "1");
  assertEquals(attrs.get("data-sumate-boletin"), "1");
  assertEquals(attrs.has("data-sumate-donar"), false);
  assert(styles[0]?.includes(mask));
  assert(!styles.join("").includes("jx@pox.me"));
  const forms = Deno.readTextFileSync(new URL("../app/forms.tsx", import.meta.url));
  assert(!forms.includes("removeItem"));
  assert(forms.includes("aria-live"));
  assert(forms.includes('method="post"'));
  const layout = Deno.readTextFileSync(new URL("../app/layout.tsx", import.meta.url));
  assert(layout.includes("sumateBootScript"));
});
