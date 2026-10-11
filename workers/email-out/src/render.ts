import { mailJobSchema, type MailJob } from "@enrailar/shared";

const FROM = "hola@enrailar.com";

export interface RenderedMail {
  from: string;
  to: string;
  mime: string;
}

export interface MailOrigins {
  api: string;
  web: string;
}

export type RenderResult =
  | { status: "ok"; mail: RenderedMail }
  | { status: "invalid" }
  | { status: "no-origin" };

function headerSafe(value: string): string | undefined {
  if (value.length === 0 || /[\r\n]/.test(value)) return undefined;
  return value;
}

function newsletterCopy(locale: MailJob["locale"]): { subject: string; confirm: string; unsubscribe: string } {
  switch (locale) {
    case "es":
      return {
        subject: "Confirmá tu suscripción a Enrailar",
        confirm: "Confirmar",
        unsubscribe: "Baja en un clic",
      };
    case "en":
      return {
        subject: "Confirm your Enrailar subscription",
        confirm: "Confirm",
        unsubscribe: "One-click unsubscribe",
      };
    default: {
      const unreachable: never = locale;
      return unreachable;
    }
  }
}

function authCopy(kind: "auth.verify" | "auth.reset", locale: MailJob["locale"]): { subject: string; action: string } {
  switch (kind) {
    case "auth.verify":
      return locale === "es"
        ? { subject: "Confirmá tu correo de Enrailar", action: "Verificar correo" }
        : { subject: "Confirm your Enrailar email", action: "Verify email" };
    case "auth.reset":
      return locale === "es"
        ? { subject: "Recuperá tu acceso a Enrailar", action: "Elegir una contraseña nueva" }
        : { subject: "Reset your Enrailar access", action: "Choose a new password" };
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
}

function message(from: string, to: string, subject: string, lines: string[], extra: string[]): string {
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    ...extra,
    "",
    ...lines,
    "",
  ].join("\r\n");
}

export function renderMail(body: unknown, origins: MailOrigins): RenderResult {
  const parsed = mailJobSchema.safeParse(body);
  if (!parsed.success) return { status: "invalid" };
  const job = parsed.data;
  const to = headerSafe(job.to);
  if (!to) return { status: "invalid" };
  switch (job.kind) {
    case "newsletter.confirm": {
      const base = headerSafe(origins.api.trim());
      if (!base) return { status: "no-origin" };
      const text = newsletterCopy(job.locale);
      const confirmUrl = `${base}${job.confirmPath}`;
      const unsubscribeUrl = `${base}${job.unsubscribePath}`;
      return {
        status: "ok",
        mail: {
          from: FROM,
          to,
          mime: message(FROM, to, text.subject, [
            `${text.confirm}: ${confirmUrl}`,
            `${text.unsubscribe}: ${unsubscribeUrl}`,
          ], [
            `List-Unsubscribe: <${unsubscribeUrl}>`,
            "List-Unsubscribe-Post: List-Unsubscribe=One-Click",
          ]),
        },
      };
    }
    case "auth.verify":
    case "auth.reset": {
      const base = headerSafe(origins.web.trim());
      if (!base) return { status: "no-origin" };
      const text = authCopy(job.kind, job.locale);
      const url = `${base}${job.path}`;
      return {
        status: "ok",
        mail: {
          from: FROM,
          to,
          mime: message(FROM, to, text.subject, [`${text.action}: ${url}`], []),
        },
      };
    }
    default: {
      const unreachable: never = job;
      return unreachable;
    }
  }
}
