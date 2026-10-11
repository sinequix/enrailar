import { assert, assertEquals } from "@std/assert";
import { handleQueue } from "../src/queue.ts";
import { renderMail } from "../src/render.ts";

const job = {
  kind: "newsletter.confirm",
  to: "hola@enrailar.com",
  locale: "es",
  confirmPath: "/v1/newsletter/confirm?token=abc",
  unsubscribePath: "/v1/newsletter/unsubscribe?token=def",
};

const origins = { api: "https://api.enrailar.com", web: "https://enrailar.com" };

Deno.test("el correo de confirmación trae la baja en un clic", () => {
  const rendered = renderMail(job, origins);
  assertEquals(rendered.status, "ok");
  if (rendered.status !== "ok") return;
  assertEquals(rendered.mail.from, "hola@enrailar.com");
  assert(rendered.mail.mime.includes("List-Unsubscribe: <https://api.enrailar.com/v1/newsletter/unsubscribe?token=def>"));
  assert(rendered.mail.mime.includes("List-Unsubscribe-Post: List-Unsubscribe=One-Click"));
  assert(rendered.mail.mime.includes("https://api.enrailar.com/v1/newsletter/confirm?token=abc"));
});

Deno.test("el correo de verificación usa el sitio y no la API", () => {
  const rendered = renderMail({
    kind: "auth.verify",
    to: "hola@enrailar.com",
    locale: "es",
    path: "/es/cuenta/verificar?token=abc",
  }, origins);
  assertEquals(rendered.status, "ok");
  if (rendered.status !== "ok") return;
  assert(rendered.mail.mime.includes("https://enrailar.com/es/cuenta/verificar?token=abc"));
  const hosts = [...rendered.mail.mime.matchAll(/https:\/\/[^\s>]+/g)].map((match) => new URL(match[0]).hostname);
  assert(hosts.some((host) => host === "enrailar.com"));
  assert(hosts.every((host) => host !== "api.enrailar.com"));
});

Deno.test("sin origen web el correo de auth se reintenta", () => {
  const rendered = renderMail({
    kind: "auth.reset",
    to: "hola@enrailar.com",
    locale: "en",
    path: "/en/cuenta/recuperar?token=abc",
  }, { api: "https://api.enrailar.com", web: "" });
  assertEquals(rendered.status, "no-origin");
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
