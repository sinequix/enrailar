import {
  contactSchema,
  newsletterSchema,
  preinscriptionSchema,
  type ContactIntent,
} from "@enrailar/shared";

export type FormKind = "preinscripcion" | "contacto" | "newsletter";

export function apiOrigin(value: string | undefined): string {
  if (value && value.trim().length > 0) return value.replace(/\/$/, "");
  return "https://api.enrailar.com";
}

export function formPath(kind: FormKind): string {
  switch (kind) {
    case "preinscripcion":
      return "/v1/preinscripcion";
    case "contacto":
      return "/v1/contacto";
    case "newsletter":
      return "/v1/newsletter";
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
}

export interface FormFields {
  email: string;
  linkedin: string;
  message: string;
  locale: string;
  consent: boolean;
  turnstileToken: string;
  company_url: string;
  intent?: ContactIntent;
}

export function parseSubmission(kind: FormKind, fields: FormFields) {
  const common = {
    email: fields.email,
    locale: fields.locale,
    consent: fields.consent,
    turnstileToken: fields.turnstileToken,
    company_url: fields.company_url,
  };
  switch (kind) {
    case "preinscripcion":
      return preinscriptionSchema.safeParse({ ...common, linkedin: fields.linkedin, message: fields.message });
    case "contacto":
      return contactSchema.safeParse({
        ...common,
        linkedin: fields.linkedin,
        message: fields.message,
        intent: fields.intent,
      });
    case "newsletter":
      return newsletterSchema.safeParse(common);
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
}
