import {
  contactSchema,
  isJoinIntent,
  newsletterSchema,
  preinscriptionSchema,
  sumateSchema,
  type ContactIntent,
  type JoinIntent,
} from "@enrailar/shared";

/** El hash completo, porque el query vive dentro del fragmento. */
export const SUMATE_PRESELECT = "#sumate?quiero=hackatrain";

export const SUMATE_PATH = "/v1/sumate";

export const SUMATE_FIELDS = [
  "intents",
  "email",
  "name",
  "city",
  "link",
  "message",
  "consent",
  "turnstileToken",
] as const;

export type SumateField = (typeof SUMATE_FIELDS)[number];

export function isSumateField(value: string): value is SumateField {
  return (SUMATE_FIELDS as readonly string[]).includes(value);
}

export function intentsFromHash(hash: string): JoinIntent[] {
  const body = hash.startsWith("#") ? hash.slice(1) : hash;
  const mark = body.indexOf("?");
  if (mark < 0) return [];
  const params = new URLSearchParams(body.slice(mark + 1));
  const selected: JoinIntent[] = [];
  for (const raw of params.getAll("quiero")) {
    for (const part of raw.split(",")) {
      const value = part.trim();
      if (!isJoinIntent(value) || selected.includes(value)) continue;
      selected.push(value);
    }
  }
  return selected;
}

export function sumateIssueFields(issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey> }>): SumateField[] {
  const fields: SumateField[] = [];
  for (const issue of issues) {
    const name = String(issue.path[0] ?? "");
    if (!isSumateField(name) || fields.includes(name)) continue;
    fields.push(name);
  }
  return fields;
}

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

export interface SumateFields {
  intents: readonly string[];
  email: string;
  name: string;
  city: string;
  link: string;
  message: string;
  locale: string;
  consent: boolean;
  turnstileToken: string;
  company_url: string;
}

export function parseSumate(fields: SumateFields) {
  return sumateSchema.safeParse({ ...fields, intents: [...fields.intents] });
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
