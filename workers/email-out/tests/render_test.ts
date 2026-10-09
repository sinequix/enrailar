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

Deno.test("el correo de confirmación trae la baja en un clic", () => {
  const rendered = renderMail(job, "https://api.enrailar.com");
  assert(rendered);
  assertEquals(rendered.from, "hola@enrailar.com");
  assert(rendered.mime.includes("List-Unsubscribe: <https://api.enrailar.com/v1/newsletter/unsubscribe?token=def>"));
  assert(rendered.mime.includes("List-Unsubscribe-Post: List-Unsubscribe=One-Click"));
  assert(rendered.mime.includes("https://api.enrailar.com/v1/newsletter/confirm?token=abc"));
});

Deno.test("la cola no escribe el destinatario en el log", async () => {
  const logs: unknown[] = [];
  const sent: string[] = [];
  await handleQueue([{
    body: job,
    ack() {},
    retry() {},
  }], "https://api.enrailar.com", {
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
  }], "https://api.enrailar.com", { send: () => Promise.resolve() }, () => undefined);
  assertEquals(acked, 1);
  assertEquals(retried, 0);
});
