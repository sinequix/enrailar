import { z } from "zod";

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
};

export const emailSchema = z.email().max(254);

export const linkedinSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .max(300)
    .refine((value) => {
      try {
        const url = new URL(value);
        const host = url.hostname.toLowerCase();
        return url.protocol === "https:" &&
          (host === "linkedin.com" || host === "www.linkedin.com");
      } catch {
        return false;
      }
    }, "Tiene que ser un enlace https de LinkedIn")
    .optional(),
);

export const messageSchema = z.string().trim().min(1).max(4000);

export const contactIntentSchema = z.enum(["colaborar", "donar", "sumarme"]);

export const JOIN_INTENTS = ["hackatrain", "ciudad", "colaborar", "donar", "equipo", "boletin"] as const;

export const joinIntentSchema = z.enum(JOIN_INTENTS);

export type JoinIntent = z.infer<typeof joinIntentSchema>;

export function isJoinIntent(value: string): value is JoinIntent {
  return (JOIN_INTENTS as readonly string[]).includes(value);
}

function uniqueStrings(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

/** Al menos una intención. Los duplicados se descartan antes de validar. */
export const intentsSchema = z.preprocess(
  uniqueStrings,
  z.array(joinIntentSchema).min(1).max(JOIN_INTENTS.length),
);

const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

/** Cualquier URL https. El campo de la ficha única no se limita a LinkedIn. */
export const linkSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .max(300)
    .refine((value) => {
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    }, "Tiene que ser un enlace https")
    .optional(),
);

export const optionalMessageSchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().max(4000).optional(),
);

export const localeSchema = z.enum(["es", "en"]);

export const consentSchema = z.literal(true, {
  error: "Hace falta el consentimiento para tratar los datos según la Ley 25.326",
});

export const turnstileTokenSchema = z.string().trim().min(1).max(2048);

/** Campo oculto. Si viene con texto, el formulario se rechaza. */
export const honeypotSchema = z.string().max(0).optional().default("");

export const CONSENT_COPY =
  "Acepto que Enrailar trate mi correo y el resto de estos datos según la Ley 25.326 para responder esta solicitud y, si me suscribo, enviarme novedades. Puedo pedir acceso, rectificación o supresión.";

const formBase = {
  email: emailSchema,
  linkedin: linkedinSchema,
  message: messageSchema,
  locale: localeSchema,
  consent: consentSchema,
  turnstileToken: turnstileTokenSchema,
  company_url: honeypotSchema,
};

export const preinscriptionSchema = z.object(formBase);

export const contactSchema = preinscriptionSchema.extend({
  intent: contactIntentSchema,
});

export const newsletterSchema = z.object({
  email: emailSchema,
  locale: localeSchema,
  consent: consentSchema,
  turnstileToken: turnstileTokenSchema,
  company_url: honeypotSchema,
});

export const sumateSchema = z.object({
  intents: intentsSchema,
  email: emailSchema,
  name: optionalText(120),
  city: optionalText(120),
  link: linkSchema,
  message: optionalMessageSchema,
  locale: localeSchema,
  consent: consentSchema,
  turnstileToken: turnstileTokenSchema,
  company_url: honeypotSchema,
});

export type PreinscriptionInput = z.infer<typeof preinscriptionSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type NewsletterInput = z.infer<typeof newsletterSchema>;
export type ContactIntent = z.infer<typeof contactIntentSchema>;
export type SumateInput = z.infer<typeof sumateSchema>;
