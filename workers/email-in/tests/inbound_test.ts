import { assert, assertEquals } from "@std/assert";
import { handleInbound, type InboundMessage } from "../src/inbound.ts";

function message(to: string): { inbound: InboundMessage; rejected: string[]; forwarded: string[] } {
  const rejected: string[] = [];
  const forwarded: string[] = [];
  const raw = new TextEncoder().encode("Subject: Hola\r\n\r\ntexto\r\n");
  const inbound: InboundMessage = {
    from: "prensa@enrailar.com",
    to,
    raw: new Response(raw).body ?? new ReadableStream(),
    rawSize: raw.byteLength,
    forward(destination) {
      forwarded.push(destination);
      return Promise.resolve();
    },
    setReject(reason) {
      rejected.push(reason);
    },
  };
  return { inbound, rejected, forwarded };
}

Deno.test("reenvía la casilla de rol y guarda una copia", async () => {
  const logs: unknown[] = [];
  const { inbound, rejected, forwarded } = message("Hola@enrailar.com");
  let postedTo = "";
  await handleInbound(inbound, {
    FORWARD_TO: "  binding-value  ",
    INBOX: {
      fetch(input) {
        postedTo = input.headers.get("x-envelope-to") ?? "";
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 202 }));
      },
    },
  }, (event) => logs.push(event));
  assertEquals(postedTo, "hola@enrailar.com");
  assertEquals(forwarded, ["binding-value"]);
  assertEquals(rejected, []);
  assertEquals(logs, [{ status: "forwarded" }]);
  assert(!JSON.stringify(logs).includes("@"));
});

Deno.test("sin destino no reenvía", async () => {
  const { inbound, rejected, forwarded } = message("hola@enrailar.com");
  let called = false;
  await handleInbound(inbound, {
    FORWARD_TO: " ",
    INBOX: {
      fetch() {
        called = true;
        return Promise.resolve(new Response(null, { status: 202 }));
      },
    },
  }, () => undefined);
  assertEquals(rejected, ["FORWARD_TO is empty"]);
  assertEquals(forwarded, []);
  assert(!called);
});

Deno.test("una casilla ajena se rechaza", async () => {
  const { inbound, rejected, forwarded } = message("otro@example.com");
  await handleInbound(inbound, {
    FORWARD_TO: "binding-value",
    INBOX: { fetch: () => Promise.resolve(new Response(null, { status: 202 })) },
  }, () => undefined);
  assertEquals(rejected, ["mailbox not accepted"]);
  assertEquals(forwarded, []);
});
