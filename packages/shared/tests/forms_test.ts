import { assertEquals, assertFalse } from "@std/assert";
import { contactSchema, newsletterSchema, preinscriptionSchema, sumateSchema } from "../src/index.ts";

const turnstileToken = "token-de-prueba";

const base = {
  email: "hola@enrailar.com",
  linkedin: "https://www.linkedin.com/in/ejemplo",
  message: "Quiero ayudar a mapear vías.",
  locale: "es" as const,
  consent: true as const,
  turnstileToken,
  company_url: "",
};

Deno.test("la preinscripción acepta el contrato mínimo", () => {
  const parsed = preinscriptionSchema.parse({ ...base, linkedin: "" });
  assertEquals(parsed.email, "hola@enrailar.com");
  assertEquals(parsed.linkedin, undefined);
});

Deno.test("el contacto exige una de las tres intenciones", () => {
  const parsed = contactSchema.parse({ ...base, intent: "sumarme" });
  assertEquals(parsed.intent, "sumarme");
  assertFalse(contactSchema.safeParse({ ...base, intent: "otra" }).success);
});

Deno.test("sin consentimiento no entra", () => {
  assertFalse(newsletterSchema.safeParse({ ...base, consent: false }).success);
});

Deno.test("el honeypot con texto se rechaza", () => {
  assertFalse(preinscriptionSchema.safeParse({ ...base, company_url: "https://spam.example" }).success);
});

Deno.test("un correo mal formado se rechaza", () => {
  assertFalse(newsletterSchema.safeParse({ ...base, email: "no-es-un-correo" }).success);
});

const sumate = {
  intents: ["hackatrain"],
  email: "hola@enrailar.com",
  name: "",
  city: "",
  link: "",
  message: "",
  locale: "es" as const,
  consent: true as const,
  turnstileToken,
  company_url: "",
};

Deno.test("la ficha única pide al menos una intención y acepta el resto vacío", () => {
  const parsed = sumateSchema.parse(sumate);
  assertEquals(parsed.intents, ["hackatrain"]);
  assertEquals(parsed.name, undefined);
  assertEquals(parsed.city, undefined);
  assertEquals(parsed.link, undefined);
  assertEquals(parsed.message, undefined);
  assertFalse(sumateSchema.safeParse({ ...sumate, intents: [] }).success);
  assertFalse(sumateSchema.safeParse({ ...sumate, intents: ["otra"] }).success);
});

Deno.test("la ficha única deduplica intenciones y acepta un https cualquiera", () => {
  const parsed = sumateSchema.parse({
    ...sumate,
    intents: ["boletin", "hackatrain", "boletin"],
    link: "https://example.com/proyecto",
    name: "Equipo",
    city: "Tandil",
  });
  assertEquals(parsed.intents, ["boletin", "hackatrain"]);
  assertEquals(parsed.link, "https://example.com/proyecto");
  assertFalse(sumateSchema.safeParse({ ...sumate, link: "http://example.com" }).success);
  assertFalse(sumateSchema.safeParse({ ...sumate, consent: false }).success);
});
