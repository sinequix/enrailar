import { assertEquals, assertFalse } from "@std/assert";
import { contactSchema, newsletterSchema, preinscriptionSchema } from "../src/index.ts";

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
