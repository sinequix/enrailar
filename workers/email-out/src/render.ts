import { mailJobSchema, type MailJob } from "@enrailar/shared";

const FROM = "hola@enrailar.com";

export interface RenderedMail {
  from: string;
  to: string;
  mime: string;
}

function copy(locale: MailJob["locale"]): { subject: string; confirm: string; unsubscribe: string } {
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

function headerSafe(value: string): string | undefined {
  if (value.length === 0 || /[\r\n]/.test(value)) return undefined;
  return value;
}

export function renderMail(body: unknown, origin: string): RenderedMail | undefined {
  const parsed = mailJobSchema.safeParse(body);
  const base = headerSafe(origin);
  if (!parsed.success || !base) return undefined;
  const to = headerSafe(parsed.data.to);
  if (!to) return undefined;
  const text = copy(parsed.data.locale);
  const confirmUrl = `${base}${parsed.data.confirmPath}`;
  const unsubscribeUrl = `${base}${parsed.data.unsubscribePath}`;
  const lines = [
    `From: ${FROM}`,
    `To: ${to}`,
    `Subject: ${text.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    `List-Unsubscribe: <${unsubscribeUrl}>`,
    "List-Unsubscribe-Post: List-Unsubscribe=One-Click",
    "",
    `${text.confirm}: ${confirmUrl}`,
    `${text.unsubscribe}: ${unsubscribeUrl}`,
    "",
  ];
  return { from: FROM, to, mime: lines.join("\r\n") };
}
