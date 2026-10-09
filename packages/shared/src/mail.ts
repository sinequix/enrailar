import { z } from "zod";
import { emailSchema, localeSchema } from "./forms.ts";

export const mailJobSchema = z.object({
  kind: z.literal("newsletter.confirm"),
  to: emailSchema,
  locale: localeSchema,
  confirmPath: z.string().startsWith("/v1/newsletter/confirm?token="),
  unsubscribePath: z.string().startsWith("/v1/newsletter/unsubscribe?token="),
});

export type MailJob = z.infer<typeof mailJobSchema>;
