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
    MAILBOX: {
      deliver(input) {
        postedTo = input.to;
        return Promise.resolve();
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
    MAILBOX: {
      deliver() {
        called = true;
        return Promise.resolve();
      },
    },
  }, () => undefined);
  assertEquals(rejected, ["FORWARD_TO is empty"]);
  assertEquals(forwarded, []);
  assert(!called);
});

Deno.test("si el buzón falla no reenvía", async () => {
  const { inbound, rejected, forwarded } = message("hola@enrailar.com");
  await handleInbound(inbound, {
    FORWARD_TO: "binding-value",
    MAILBOX: {
      deliver() {
        return Promise.reject(new Error("unavailable"));
      },
    },
  }, () => undefined);
  assertEquals(rejected, ["inbox unavailable"]);
  assertEquals(forwarded, []);
});

Deno.test("una casilla ajena se rechaza", async () => {
  const { inbound, rejected, forwarded } = message("otro@example.com");
  await handleInbound(inbound, {
    FORWARD_TO: "binding-value",
    MAILBOX: { deliver: () => Promise.resolve() },
  }, () => undefined);
  assertEquals(rejected, ["mailbox not accepted"]);
  assertEquals(forwarded, []);
});
