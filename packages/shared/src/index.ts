export {
  CONSENT_COPY,
  consentSchema,
  contactIntentSchema,
  contactSchema,
  emailSchema,
  honeypotSchema,
  linkedinSchema,
  localeSchema,
  messageSchema,
  newsletterSchema,
  preinscriptionSchema,
  turnstileTokenSchema,
} from "./forms.ts";
export type { ContactInput, ContactIntent, NewsletterInput, PreinscriptionInput } from "./forms.ts";
export { mailJobSchema } from "./mail.ts";
export type { MailJob } from "./mail.ts";
export { HACKATRAIN_START, HACKATRAIN_WHEN, ROLE_MAILBOXES } from "./project.ts";
export type { RoleMailbox } from "./project.ts";
