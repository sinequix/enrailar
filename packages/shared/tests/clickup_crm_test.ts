import { assert, assertEquals } from "@std/assert";
import {
  fuenteTag,
  publicCrmText,
  upsertCrmContact,
  type CrmFetch,
  type CrmRequest,
  type CrmResponse,
} from "../src/index.ts";

const email = "hola@enrailar.com";
const token = "token-de-prueba";
const listId = "4242";

interface Call {
  url: string;
  method: string;
  body?: string;
  authorization?: string;
}

function json(status: number, body: unknown): CrmResponse {
  const text = JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, text: () => Promise.resolve(text) };
}

function empty(status: number): CrmResponse {
  return { ok: status >= 200 && status < 300, status, text: () => Promise.resolve("") };
}

function scripted(steps: Array<(call: Call) => CrmResponse>): { fetch: CrmFetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl: CrmFetch = (url, init) => {
    const call = {
      url,
      method: init.method,
      body: init.body,
      authorization: init.headers.Authorization,
    };
    calls.push(call);
    const step = steps[calls.length - 1];
    if (!step) throw new Error(`fetch de más ${init.method} ${url}`);
    return Promise.resolve(step(call));
  };
  return { fetch: fetchImpl, calls };
}

const fields = {
  fields: [
    { id: "field-email", name: "email", type: "email", type_config: {} },
    { id: "field-fuente", name: "fuente", type: "short_text", type_config: {} },
  ],
};

const contact = {
  email,
  name: "PersonaUnica",
  title: "Voluntario · Tandil",
  summary: "Perfil: ingeniería\nLugar: Tandil\nFicha: ficha-1",
  note: `Nombre: PersonaUnica\nCorreo: ${email}\nCómo quiere ayudar:\nRelevar vías.`,
  fuente: "sumate" as const,
  tags: ["voluntario"],
};

function bodyOf(call: Call | undefined): Record<string, unknown> {
  return JSON.parse(call?.body ?? "{}") as Record<string, unknown>;
}

Deno.test("sin token no llama a ClickUp", async () => {
  let called = false;
  const fetchImpl: CrmFetch = () => {
    called = true;
    return Promise.resolve(empty(500));
  };
  const result = await upsertCrmContact(contact, { token: "  ", listId, fetch: fetchImpl });
  assertEquals(result.ok, false);
  assertEquals(called, false);
});

Deno.test("crea el contacto con fuente y voluntario, sin correo en el texto público", async () => {
  const { fetch: fetchImpl, calls } = scripted([
    () => json(200, fields),
    () => json(200, { tasks: [] }),
    () => json(200, { id: "task-1", tags: [] }),
    () => empty(200),
    () => empty(200),
    () => empty(200),
    () => empty(200),
  ]);
  const result = await upsertCrmContact(contact, { token, listId, fetch: fetchImpl });
  assertEquals(result, { ok: true, taskId: "task-1", action: "created" });
  assertEquals(calls.length, 7);
  const create = calls[2];
  assert(create);
  assert(create.url.endsWith(`/list/${listId}/task`));
  assertEquals(create.authorization, token);
  assert(!create.url.includes(token));
  assert(!create.url.includes(email));
  const created = bodyOf(create);
  assertEquals(created.notify_all, false);
  assertEquals(created.tags, ["voluntario"]);
  const publicText = `${created.name}\n${created.markdown_description}`;
  assert(!publicText.includes(email));
  assert(!publicText.includes("PersonaUnica"));
  const custom = created.custom_fields as Array<{ id: string; value: string }>;
  assertEquals(custom.find((field) => field.id === "field-email")?.value, email);
  assertEquals(custom.find((field) => field.id === "field-fuente")?.value, "sumate");
  const tag = calls.find((call) => call.url.includes("/tag/voluntario"));
  assert(tag);
  const fuente = calls.find((call) => call.url.includes("/field/field-fuente"));
  assertEquals(bodyOf(fuente).value, "sumate");
  const comment = calls.find((call) => call.url.endsWith("/comment"));
  assert(comment);
  assert(bodyOf(comment).comment_text?.toString().includes(email));
  assertEquals(bodyOf(comment).notify_all, false);
});

Deno.test("si el correo ya está en la lista, actualiza esa tarea y no crea otra", async () => {
  const { fetch: fetchImpl, calls } = scripted([
    () => json(200, fields),
    () => json(200, {
      tasks: [{
        id: "task-9",
        tags: [{ name: "voluntario" }],
        custom_fields: [
          { id: "field-email", value: email },
          { id: "field-fuente", value: "email" },
        ],
      }],
    }),
    () => empty(200),
    () => empty(200),
    () => empty(200),
  ]);
  const result = await upsertCrmContact(contact, { token, listId, fetch: fetchImpl });
  assertEquals(result, { ok: true, taskId: "task-9", action: "updated" });
  assertEquals(calls.some((call) => call.method === "POST" && call.url.endsWith("/task")), false);
  assertEquals(bodyOf(calls.find((call) => call.url.includes("field-fuente"))).value, "email,sumate");
  assertEquals(calls.some((call) => call.url.includes("/tag/voluntario")), false);
  const comment = calls.find((call) => call.url.includes("/comment"));
  assert(comment?.url.includes("task-9"));
});

Deno.test("sin custom field de fuente usa la etiqueta fuente-sumate", async () => {
  const { fetch: fetchImpl, calls } = scripted([
    () => json(200, { fields: [{ id: "field-email", name: "Correo", type: "email", type_config: {} }] }),
    () => json(400, { err: "no" }),
    () => json(200, { tasks: [] }),
    () => json(200, { id: "task-2" }),
    () => empty(200),
    () => empty(200),
    () => empty(200),
    () => empty(200),
  ]);
  const result = await upsertCrmContact(
    { ...contact, fuente: "email", tags: [] },
    { token, listId, fetch: fetchImpl },
  );
  assertEquals(result.ok, true);
  assertEquals(result.action, "created");
  assert(calls.some((call) => call.method === "POST" && call.url.endsWith("/field")));
  assert(calls.some((call) => call.url.includes(`/tag/${encodeURIComponent(fuenteTag("email"))}`)));
});

Deno.test("si ClickUp falla al crear, no hay id y no se publica el correo", async () => {
  const { fetch: fetchImpl, calls } = scripted([
    () => json(200, fields),
    () => json(200, { tasks: [] }),
    () => json(500, { err: email }),
  ]);
  const result = await upsertCrmContact(contact, { token, listId, fetch: fetchImpl });
  assertEquals(result, { ok: false });
  assertEquals(calls.length, 3);
});

Deno.test("el texto público no conserva el correo ni el nombre", () => {
  assertEquals(publicCrmText(`Hola ${email} PersonaUnica`, email, "PersonaUnica").includes("@"), false);
  assertEquals(fuenteTag("sumate"), "fuente-sumate");
  assertEquals(fuenteTag("email"), "fuente-email");
});

function _typecheckRequest(init: CrmRequest): string {
  return init.method;
}

void _typecheckRequest;
