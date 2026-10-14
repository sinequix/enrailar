import { AUTH_LINK_TTL_SECONDS, mailJobSchema, type MailJob } from "@enrailar/shared";

const NEWSLETTER_FROM = "hola@enrailar.com";
const FROM_NAME = "Enrailar";

export interface RenderedMail {
  from: { email: string; name: string };
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface EmailSendPayload {
  to: string;
  from: { email: string; name: string };
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface MailOrigins {
  api: string;
  web: string;
  from: string;
}

export type RenderResult =
  | { status: "ok"; mail: RenderedMail }
  | { status: "invalid" }
  | { status: "no-origin" };

interface Letter {
  subject: string;
  action: string;
  lead: string;
  expiry: string;
  ignore: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function siteOrigin(value: string): "empty" | "bad" | string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "empty";
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return "bad";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "bad";
  if (url.username.length > 0 || url.password.length > 0) return "bad";
  if (url.search.length > 0 || url.hash.length > 0) return "bad";
  if (url.pathname !== "/" && url.pathname !== "") return "bad";
  return url.origin;
}

function fromAddress(value: string): "empty" | "bad" | string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "empty";
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(trimmed)) return "bad";
  return trimmed;
}

function expiryLine(locale: MailJob["locale"]): string {
  if (AUTH_LINK_TTL_SECONDS !== 60 * 60) {
    throw new Error("la plantilla de cuenta asume un enlace de una hora");
  }
  switch (locale) {
    case "es":
      return "El enlace vence en una hora y se usa una sola vez.";
    case "en":
      return "The link expires in one hour and works only once.";
    default: {
      const unreachable: never = locale;
      return unreachable;
    }
  }
}

function letter(kind: "auth.verify" | "auth.reset", locale: MailJob["locale"]): Letter {
  const expiry = expiryLine(locale);
  switch (kind) {
    case "auth.verify":
      switch (locale) {
        case "es":
          return {
            subject: "Confirmá tu correo de Enrailar",
            action: "Verificar correo",
            lead: "Recibimos un pedido para crear una cuenta de Enrailar con este correo.",
            expiry,
            ignore: "Si no fuiste vos, podés ignorar este mensaje.",
          };
        case "en":
          return {
            subject: "Confirm your Enrailar email",
            action: "Verify email",
            lead: "We got a request to create an Enrailar account with this email.",
            expiry,
            ignore: "If this was not you, you can ignore this message.",
          };
        default: {
          const unreachable: never = locale;
          return unreachable;
        }
      }
    case "auth.reset":
      switch (locale) {
        case "es":
          return {
            subject: "Recuperá tu acceso a Enrailar",
            action: "Elegir una contraseña nueva",
            lead: "Recibimos un pedido para elegir una contraseña nueva de Enrailar.",
            expiry,
            ignore: "Si no fuiste vos, podés ignorar este mensaje. La contraseña actual sigue valiendo.",
          };
        case "en":
          return {
            subject: "Reset your Enrailar access",
            action: "Choose a new password",
            lead: "We got a request to choose a new Enrailar password.",
            expiry,
            ignore: "If this was not you, you can ignore this message. The current password still works.",
          };
        default: {
          const unreachable: never = locale;
          return unreachable;
        }
      }
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
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

function htmlPage(lang: string, subject: string, paragraphs: string[], links: Array<{ href: string; label: string }>): string {
  const body = [
    ...paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    ...links.map((link) => `<p><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></p>`),
    ...links.map((link) => `<p>${escapeHtml(link.href)}</p>`),
  ];
  return [
    "<!DOCTYPE html>",
    `<html lang="${lang}">`,
    "<head>",
    '<meta charset="utf-8">',
    `<title>${escapeHtml(subject)}</title>`,
    "</head>",
    "<body>",
    ...body,
    "</body>",
    "</html>",
  ].join("");
}

function addressed(email: string): { email: string; name: string } {
  return { email, name: FROM_NAME };
}

export function toEmailSend(mail: RenderedMail): EmailSendPayload {
  return {
    to: mail.to,
    from: mail.from,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
    ...(mail.headers ? { headers: mail.headers } : {}),
  };
}

export function renderMail(body: unknown, origins: MailOrigins): RenderResult {
  const parsed = mailJobSchema.safeParse(body);
  if (!parsed.success) return { status: "invalid" };
  const job = parsed.data;
  switch (job.kind) {
    case "newsletter.confirm": {
      const base = siteOrigin(origins.api);
      if (base === "empty") return { status: "no-origin" };
      if (base === "bad") return { status: "invalid" };
      const text = newsletterCopy(job.locale);
      const confirmUrl = `${base}${job.confirmPath}`;
      const unsubscribeUrl = `${base}${job.unsubscribePath}`;
      const plain = [
        `${text.confirm}: ${confirmUrl}`,
        `${text.unsubscribe}: ${unsubscribeUrl}`,
      ].join("\n");
      return {
        status: "ok",
        mail: {
          from: addressed(NEWSLETTER_FROM),
          to: job.to,
          subject: text.subject,
          text: plain,
          html: htmlPage(job.locale, text.subject, [], [
            { href: confirmUrl, label: text.confirm },
            { href: unsubscribeUrl, label: text.unsubscribe },
          ]),
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        },
      };
    }
    case "auth.verify":
    case "auth.reset": {
      const base = siteOrigin(origins.web);
      if (base === "empty") return { status: "no-origin" };
      if (base === "bad") return { status: "invalid" };
      const from = fromAddress(origins.from);
      if (from === "empty") return { status: "no-origin" };
      if (from === "bad") return { status: "invalid" };
      const text = letter(job.kind, job.locale);
      const url = `${base}${job.path}`;
      const plain = [text.lead, "", `${text.action}: ${url}`, "", text.expiry, text.ignore].join("\n");
      return {
        status: "ok",
        mail: {
          from: addressed(from),
          to: job.to,
          replyTo: NEWSLETTER_FROM,
          subject: text.subject,
          text: plain,
          html: htmlPage(job.locale, text.subject, [text.lead, text.expiry, text.ignore], [
            { href: url, label: text.action },
          ]),
          headers: {
            "Auto-Submitted": "auto-generated",
            "X-Auto-Response-Suppress": "All",
          },
        },
      };
    }
    default: {
      const unreachable: never = job;
      return unreachable;
    }
  }
}
