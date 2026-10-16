import { assert, assertEquals } from "@std/assert";
import { handleInbound, type InboundMessage } from "../src/inbound.ts";
import type { InboundContact } from "../src/contact.ts";

function message(to: string, rawText: string, from = "sobre@example.com"): {
  inbound: InboundMessage;
  rejected: string[];
} {
  const rejected: string[] = [];
  const raw = new TextEncoder().encode(rawText);
  const inbound: InboundMessage = {
    from,
    to,
    raw: new Response(raw).body ?? new ReadableStream(),
    rawSize: raw.byteLength,
    setReject(reason) {
      rejected.push(reason);
    },
  };
  return { inbound, rejected };
}

const mime = [
  "From: Persona <remitente@example.com>",
  "To: hola@enrailar.com",
  "Subject: Mapa",
  "Message-ID: <Abc@example.com>",
  "MIME-Version: 1.0",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Quiero ver el mapa.",
  "",
].join("\r\n");

Deno.test("hola@ queda en el inbox y arma el contacto, sin reenviar", async () => {
  const logs: unknown[] = [];
  const { inbound, rejected } = message("Hola@enrailar.com", mime);
  let postedTo = "";
  let contact: InboundContact | undefined;
  await handleInbound(inbound, {
    MAILBOX: {
      deliver(input) {
        postedTo = input.to;
        return Promise.resolve();
      },
    },
    CONTACTS: {
      sync(value) {
        contact = value;
        return Promise.resolve("synced");
      },
    },
  }, (event) => logs.push(event));
  assertEquals(postedTo, "hola@enrailar.com");
  assertEquals(contact?.sender, "remitente@example.com");
  assertEquals(contact?.subject, "Mapa");
  assertEquals(contact?.body, "Quiero ver el mapa.");
  assertEquals(contact?.messageId, "<abc@example.com>");
  assertEquals(rejected, []);
  assertEquals(logs, [{ status: "stored", clickup: "synced" }]);
  assert(!JSON.stringify(logs).includes("@"));
});

Deno.test("si ClickUp falla el correo igual queda aceptado y marcado para reintento", async () => {
  const { inbound, rejected } = message("hola@enrailar.com", mime);
  let stored = false;
  await handleInbound(inbound, {
    MAILBOX: {
      deliver() {
        stored = true;
        return Promise.resolve();
      },
    },
    CONTACTS: { sync: () => Promise.resolve("retry") },
  }, () => undefined);
  assert(stored);
  assertEquals(rejected, []);
});

Deno.test("hackatrain@ se guarda y no toca ClickUp", async () => {
  const { inbound, rejected } = message("hackatrain@enrailar.com", mime);
  let called = false;
  const logs: unknown[] = [];
  await handleInbound(inbound, {
    MAILBOX: { deliver: () => Promise.resolve() },
    CONTACTS: {
      sync() {
        called = true;
        return Promise.resolve("synced");
      },
    },
  }, (event) => logs.push(event));
  assert(!called);
  assertEquals(rejected, []);
  assertEquals(logs, [{ status: "stored", clickup: "skipped" }]);
});

Deno.test("si el buzón falla no crea el contacto", async () => {
  const { inbound, rejected } = message("hola@enrailar.com", mime);
  let called = false;
  await handleInbound(inbound, {
    MAILBOX: { deliver: () => Promise.reject(new Error("unavailable")) },
    CONTACTS: {
      sync() {
        called = true;
        return Promise.resolve("synced");
      },
    },
  }, () => undefined);
  assertEquals(rejected, ["inbox unavailable"]);
  assert(!called);
});

Deno.test("una casilla ajena se rechaza", async () => {
  const { inbound, rejected } = message("otro@example.com", mime);
  let stored = false;
  await handleInbound(inbound, {
    MAILBOX: {
      deliver() {
        stored = true;
        return Promise.resolve();
      },
    },
    CONTACTS: { sync: () => Promise.resolve("synced") },
  }, () => undefined);
  assertEquals(rejected, ["mailbox not accepted"]);
  assert(!stored);
});

Deno.test("el worker no reenvía", async () => {
  const inbound = await Deno.readTextFile(new URL("../src/inbound.ts", import.meta.url));
  const worker = await Deno.readTextFile(new URL("../src/worker.ts", import.meta.url));
  assert(!inbound.includes("forward("));
  assert(!inbound.includes("FORWARD_TO"));
  assert(!worker.includes("forward("));
  assert(!worker.includes("FORWARD_TO"));
});
