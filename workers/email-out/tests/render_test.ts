import { assert, assertEquals } from "@std/assert";
import { AUTH_LINK_TTL_SECONDS, TRANSACTIONAL_FROM } from "@enrailar/shared";
import { handleQueue } from "../src/queue.ts";
import { renderMail, toEmailSend } from "../src/render.ts";

const job = {
  kind: "newsletter.confirm",
  to: "hola@enrailar.com",
  locale: "es",
  confirmPath: "/v1/newsletter/confirm?token=abc",
  unsubscribePath: "/v1/newsletter/unsubscribe?token=def",
};

const origins = {
  api: "https://api.enrailar.com",
  web: "https://enrailar.com",
  from: TRANSACTIONAL_FROM,
};

const verifyJob = {
  kind: "auth.verify",
  to: "prensa@enrailar.com",
  locale: "es",
  path: "/es/cuenta/verificar?token=abcdefghij",
};

Deno.test("el correo de confirmación trae la baja en un clic", () => {
  const rendered = renderMail(job, origins);
  assertEquals(rendered.status, "ok");
  if (rendered.status !== "ok") return;
  assertEquals(rendered.mail.from.email, "hola@enrailar.com");
  assertEquals(rendered.mail.headers?.["List-Unsubscribe"], "<https://api.enrailar.com/v1/newsletter/unsubscribe?token=def>");
  assertEquals(rendered.mail.headers?.["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert(rendered.mail.text.includes("https://api.enrailar.com/v1/newsletter/confirm?token=abc"));
  assert(rendered.mail.html.includes("https://api.enrailar.com/v1/newsletter/confirm?token=abc"));
  assert(rendered.mail.html.includes("https://api.enrailar.com/v1/newsletter/unsubscribe?token=def"));
});

Deno.test("el correo de verificación es html y texto, desde el remitente transaccional", () => {
  assertEquals(AUTH_LINK_TTL_SECONDS, 60 * 60);
  const rendered = renderMail(verifyJob, origins);
  assertEquals(rendered.status, "ok");
  if (rendered.status !== "ok") return;
  const link = "https://enrailar.com/es/cuenta/verificar?token=abcdefghij";
  assertEquals(rendered.mail.from.email, TRANSACTIONAL_FROM);
  assertEquals(rendered.mail.from.name, "Enrailar");
  assertEquals(rendered.mail.replyTo, "hola@enrailar.com");
  assertEquals(rendered.mail.subject, "Confirmá tu correo de Enrailar");
  assert(rendered.mail.text.includes(link));
  assert(rendered.mail.html.includes(link));
  assert(rendered.mail.html.includes("<html lang=\"es\">"));
  assert(rendered.mail.text.includes("una hora"));
  assert(rendered.mail.html.includes("una sola vez"));
  assert(!rendered.mail.text.includes(verifyJob.to));
  assert(!rendered.mail.html.includes(verifyJob.to));
  const payload = toEmailSend(rendered.mail);
  assertEquals(payload.from.email, TRANSACTIONAL_FROM);
  assert(payload.html.length > 0);
  assert(payload.text.length > 0);
  const hosts = [...`${rendered.mail.text}\n${rendered.mail.html}`.matchAll(/https:\/\/[^\s<"]+/g)].map((match) => new URL(match[0]).hostname);
  assert(hosts.some((host) => host === "enrailar.com"));
  assert(hosts.every((host) => host !== "api.enrailar.com"));
});

Deno.test("el correo de recuperación en inglés usa el origen del sitio", () => {
  const rendered = renderMail({
    kind: "auth.reset",
    to: "prensa@enrailar.com",
    locale: "en",
    path: "/en/cuenta/recuperar?token=abcdefghij",
  }, origins);
  assertEquals(rendered.status, "ok");
  if (rendered.status !== "ok") return;
  assertEquals(rendered.mail.subject, "Reset your Enrailar access");
  assert(rendered.mail.text.includes("https://enrailar.com/en/cuenta/recuperar?token=abcdefghij"));
  assert(rendered.mail.html.includes("lang=\"en\""));
  assert(rendered.mail.text.includes("one hour"));
});

Deno.test("sin origen web o sin remitente el correo de auth se reintenta", () => {
  const missingWeb = renderMail(verifyJob, { ...origins, web: "" });
  assertEquals(missingWeb.status, "no-origin");
  const missingFrom = renderMail(verifyJob, { ...origins, from: "  " });
  assertEquals(missingFrom.status, "no-origin");
});

Deno.test("una ruta que no es la de la cuenta se descarta", () => {
  const rendered = renderMail({
    ...verifyJob,
    path: "https://evil.example/phish",
  }, origins);
  assertEquals(rendered.status, "invalid");
});

Deno.test("la cola no escribe el destinatario en el log", async () => {
  const logs: unknown[] = [];
  const sent: string[] = [];
  await handleQueue([{
    body: job,
    ack() {},
    retry() {},
  }], origins, {
    send(message) {
      sent.push(message.to);
      return Promise.resolve();
    },
  }, (event) => logs.push(event));
  assertEquals(sent, ["hola@enrailar.com"]);
  assertEquals(logs, [{ status: "sent" }]);
  assert(!JSON.stringify(logs).includes("@"));
});

Deno.test("un mensaje inválido se descarta sin reintento", async () => {
  let acked = 0;
  let retried = 0;
  await handleQueue([{
    body: { kind: "otro" },
    ack() {
      acked += 1;
    },
    retry() {
      retried += 1;
    },
  }], origins, { send: () => Promise.resolve() }, () => undefined);
  assertEquals(acked, 1);
  assertEquals(retried, 0);
});

Deno.test("si el envío falla la cola reintenta sin loguear el destinatario", async () => {
  const logs: unknown[] = [];
  let retried = 0;
  await handleQueue([{
    body: verifyJob,
    ack() {},
    retry() {
      retried += 1;
    },
  }], origins, {
    send() {
      return Promise.reject(new Error("delivery"));
    },
  }, (event) => logs.push(event));
  assertEquals(retried, 1);
  assertEquals(logs, [{ status: "retry" }]);
  assert(!JSON.stringify(logs).includes("@"));
  assert(!JSON.stringify(logs).includes("abcdefghij"));
});
