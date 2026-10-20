import { type CrmFetch, upsertCrmContact } from "@enrailar/shared";
import type { InboundContact } from "./contact.ts";
import type { RetryStore } from "./retry.ts";

export type ContactSync = {
  sync(contact: InboundContact): Promise<"synced" | "retry" | "skipped">;
};

type CrmEnv = {
  token: string;
  listId: string;
  store: RetryStore;
  fetchImpl?: typeof fetch;
};

export async function syncContact(
  env: CrmEnv,
  contact: InboundContact,
): Promise<"synced" | "retry" | "skipped"> {
  if (!acceptableSender(contact.sender)) return "skipped";
  try {
    await writeContact(env, contact);
    await env.store.forget(contact.messageId);
    return "synced";
  } catch {
    try {
      await env.store.mark(contact);
    } catch {
      // Sin fila, el cron no la ve. El inbox igual tiene el mensaje.
    }
    return "retry";
  }
}

export async function drainContacts(env: CrmEnv, limit: number): Promise<void> {
  if (!configured(env.token, env.listId)) return;
  const pending = await env.store.pending(limit);
  for (const contact of pending) {
    if (!acceptableSender(contact.sender)) {
      await env.store.forget(contact.messageId);
      continue;
    }
    try {
      await writeContact(env, contact);
      await env.store.forget(contact.messageId);
    } catch {
      await env.store.bump(contact.messageId);
    }
  }
}

export function contactTaskCopy(contact: InboundContact): {
  title: string;
  summary: string;
  note: string;
} {
  return {
    title: "Contacto por correo",
    summary: "Mensaje recibido por correo.",
    note:
      `Remitente: ${contact.sender}\nAsunto: ${contact.subject}\n\n${contact.body}`,
  };
}

async function writeContact(
  env: CrmEnv,
  contact: InboundContact,
): Promise<void> {
  if (!configured(env.token, env.listId)) throw new Error("clickup config");
  const copy = contactTaskCopy(contact);
  const result = await upsertCrmContact(
    {
      email: contact.sender,
      title: copy.title,
      summary: copy.summary,
      note: copy.note,
      fuente: "email",
      tags: ["contacto"],
    },
    {
      token: env.token,
      listId: env.listId,
      fetch: env.fetchImpl ? asCrmFetch(env.fetchImpl) : undefined,
    },
  );
  if (!result.ok) throw new Error("clickup");
}

function asCrmFetch(fetchImpl: typeof fetch): CrmFetch {
  return (url, init) => {
    const request: RequestInit = {
      method: init.method,
      headers: init.headers,
      body: init.body,
    };
    if (init.signal !== undefined) request.signal = init.signal as AbortSignal;
    return fetchImpl(url, request).then((response) => ({
      ok: response.ok,
      status: response.status,
      text: () => response.text(),
    }));
  };
}

function acceptableSender(value: string): boolean {
  const email = value.trim();
  return email.includes("@") && !/\s/.test(email);
}

function configured(token: string, listId: string): boolean {
  return token.trim().length > 0 && /^[0-9]+$/.test(listId.trim());
}
