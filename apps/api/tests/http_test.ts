import { assert, assertEquals } from "@std/assert";
import type { MailJob } from "@enrailar/shared";
import { createApp } from "../src/app.ts";
import type { ApiDeps, LogEvent } from "../src/deps.ts";
import { createMemoryStore } from "../src/store.ts";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const valid = {
  email: "hola@enrailar.com",
  linkedin: "",
  message: "Quiero mapear el ramal.",
  locale: "es",
  consent: true,
  turnstileToken: "token-ok",
  company_url: "",
};

function harness(): { deps: ApiDeps; logs: LogEvent[]; jobs: MailJob[] } {
  const logs: LogEvent[] = [];
  const jobs: MailJob[] = [];
  const deps: ApiDeps = {
    store: createMemoryStore(),
    now: () => "2026-10-09T12:00:00.000Z",
    log(event) {
      logs.push(event);
    },
    verifyTurnstile(token) {
      return Promise.resolve(token === "token-ok");
    },
    enqueue(job) {
      jobs.push(job);
      return Promise.resolve();
    },
    rateLimit: { limit: 3, windowMs: 60_000 },
  };
  return { deps, logs, jobs };
}

async function withServer(deps: ApiDeps, run: (base: string) => Promise<void>): Promise<void> {
  const app = createApp(deps);
  const server: Server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }
}

Deno.test("preinscripción, contacto y newsletter", async () => {
  const { deps, logs, jobs } = harness();
  await withServer(deps, async (base) => {
    const pre = await fetch(`${base}/v1/preinscripcion`, {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.10" },
      body: JSON.stringify(valid),
    });
    assertEquals(pre.status, 202);
    assertEquals(await pre.json(), { ok: true });

    const contact = await fetch(`${base}/v1/contacto`, {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.10" },
      body: JSON.stringify({ ...valid, intent: "sumarme" }),
    });
    assertEquals(contact.status, 202);

    const news = await fetch(`${base}/v1/newsletter`, {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.11" },
      body: JSON.stringify(valid),
    });
    assertEquals(news.status, 202);
    assertEquals(jobs.length, 1);
    const job = jobs[0];
    assert(job);
    const confirm = await fetch(`${base}${job.confirmPath}`);
    assertEquals(confirm.status, 200);
    assert((await confirm.text()).includes("confirmada"));
    const bye = await fetch(`${base}${job.unsubscribePath}`, { method: "POST" });
    assertEquals(bye.status, 200);
    assertEquals(await bye.json(), { ok: true });
  });
  const dumped = JSON.stringify(logs);
  assert(!dumped.includes("@"));
  assert(!dumped.includes("token-ok"));
});

Deno.test("el honeypot responde ok y no encola", async () => {
  const { deps, jobs } = harness();
  await withServer(deps, async (base) => {
    const response = await fetch(`${base}/v1/newsletter`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...valid, company_url: "https://spam.example" }),
    });
    assertEquals(response.status, 200);
    assertEquals(await response.json(), { ok: true });
  });
  assertEquals(jobs.length, 0);
});

Deno.test("sin consentimiento o sin turno el formulario no entra", async () => {
  const { deps } = harness();
  await withServer(deps, async (base) => {
    const denied = await fetch(`${base}/v1/contacto`, {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.20" },
      body: JSON.stringify({ ...valid, consent: false, intent: "donar" }),
    });
    assertEquals(denied.status, 400);
    const body = await denied.json();
    assertEquals(body.ok, false);
    assert(!JSON.stringify(body).includes("@"));

    const bot = await fetch(`${base}/v1/preinscripcion`, {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.21" },
      body: JSON.stringify({ ...valid, turnstileToken: "falso" }),
    });
    assertEquals(bot.status, 400);
  });
});

const sumate = {
  intents: ["hackatrain", "ciudad"],
  email: "hola@enrailar.com",
  name: "",
  city: "",
  link: "https://enrailar.com",
  message: "",
  locale: "es",
  consent: true,
  turnstileToken: "token-ok",
  company_url: "",
};

Deno.test("sumate registra cada intención y el boletín sigue con doble opt-in", async () => {
  const { deps, logs, jobs } = harness();
  await withServer(deps, async (base) => {
    const plain = await fetch(`${base}/v1/sumate`, {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.40" },
      body: JSON.stringify(sumate),
    });
    assertEquals(plain.status, 202);
    assertEquals(await plain.json(), { ok: true });
    assertEquals(jobs.length, 0);

    const news = await fetch(`${base}/v1/sumate`, {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.41" },
      body: JSON.stringify({ ...sumate, intents: ["boletin", "hackatrain", "boletin"] }),
    });
    assertEquals(news.status, 202);
    assertEquals(jobs.length, 1);
    const job = jobs[0];
    assert(job);
    assert(job.kind === "newsletter.confirm");
    const confirm = await fetch(`${base}${job.confirmPath}`);
    assertEquals(confirm.status, 200);

    const empty = await fetch(`${base}/v1/sumate`, {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.42" },
      body: JSON.stringify({ ...sumate, intents: [] }),
    });
    assertEquals(empty.status, 400);
    const denied = await empty.json();
    assertEquals(denied.fields, ["intents"]);
    assert(!JSON.stringify(denied).includes("@"));

    const honeypot = await fetch(`${base}/v1/sumate`, {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.43" },
      body: JSON.stringify({ ...sumate, company_url: "https://spam.example" }),
    });
    assertEquals(honeypot.status, 200);
    assertEquals(jobs.length, 1);

    const bot = await fetch(`${base}/v1/sumate`, {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.44" },
      body: JSON.stringify({ ...sumate, turnstileToken: "falso" }),
    });
    assertEquals(bot.status, 400);
  });
  const dumped = JSON.stringify(logs);
  assert(!dumped.includes("@"));
  assert(!dumped.includes("token-ok"));
});

Deno.test("sumate corta por límite", async () => {
  const { deps, jobs } = harness();
  await withServer(deps, async (base) => {
    const headers = { "content-type": "application/json", "cf-connecting-ip": "203.0.113.50" };
    for (let i = 0; i < 3; i++) {
      const response = await fetch(`${base}/v1/sumate`, { method: "POST", headers, body: JSON.stringify(sumate) });
      assertEquals(response.status, 202);
    }
    const blocked = await fetch(`${base}/v1/sumate`, { method: "POST", headers, body: JSON.stringify(sumate) });
    assertEquals(blocked.status, 429);
  });
  assertEquals(jobs.length, 0);
});

Deno.test("el límite corta antes de aceptar otra ficha", async () => {
  const { deps } = harness();
  await withServer(deps, async (base) => {
    const headers = { "content-type": "application/json", "cf-connecting-ip": "203.0.113.30" };
    for (let i = 0; i < 3; i++) {
      const response = await fetch(`${base}/v1/preinscripcion`, { method: "POST", headers, body: JSON.stringify(valid) });
      assertEquals(response.status, 202);
    }
    const blocked = await fetch(`${base}/v1/preinscripcion`, { method: "POST", headers, body: JSON.stringify(valid) });
    assertEquals(blocked.status, 429);
  });
});
