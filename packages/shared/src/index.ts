export {
  CONSENT_COPY,
  consentSchema,
  contactIntentSchema,
  contactSchema,
  emailSchema,
  honeypotSchema,
  intentsSchema,
  isJoinIntent,
  JOIN_INTENTS,
  joinIntentSchema,
  linkedinSchema,
  linkSchema,
  localeSchema,
  messageSchema,
  newsletterSchema,
  optionalMessageSchema,
  preinscriptionSchema,
  sumateSchema,
  turnstileTokenSchema,
} from "./forms.ts";
export type {
  ContactInput,
  ContactIntent,
  JoinIntent,
  NewsletterInput,
  PreinscriptionInput,
  SumateInput,
} from "./forms.ts";
export { mailJobSchema } from "./mail.ts";
export type { MailJob } from "./mail.ts";
export {
  AUTH_LINK_TTL_SECONDS,
  HACKATRAIN_START,
  HACKATRAIN_WHEN,
  ROLE_MAILBOXES,
  TRANSACTIONAL_FROM,
} from "./project.ts";
export type { RoleMailbox } from "./project.ts";
