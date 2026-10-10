import { z } from "zod";
import { emailSchema, localeSchema } from "./forms.ts";

const newsletterJobSchema = z.object({
  kind: z.literal("newsletter.confirm"),
  to: emailSchema,
  locale: localeSchema,
  confirmPath: z.string().startsWith("/v1/newsletter/confirm?token="),
  unsubscribePath: z.string().startsWith("/v1/newsletter/unsubscribe?token="),
});

const authPathSchema = z.string().startsWith("/").refine((value) => !/[\r\n]/.test(value));

const authVerifyJobSchema = z.object({
  kind: z.literal("auth.verify"),
  to: emailSchema,
  locale: localeSchema,
  path: authPathSchema,
});

const authResetJobSchema = z.object({
  kind: z.literal("auth.reset"),
  to: emailSchema,
  locale: localeSchema,
  path: authPathSchema,
});

export const mailJobSchema = z.discriminatedUnion("kind", [
  newsletterJobSchema,
  authVerifyJobSchema,
  authResetJobSchema,
]);

export type MailJob = z.infer<typeof mailJobSchema>;
