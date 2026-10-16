import { ROLE_MAILBOXES } from "@enrailar/shared";
import { env } from "cloudflare:workers";
// bridge.js reexporta receiveEmail. El .d.ts lo ve tsc; el bundler sigue el .js.
// deno-lint-ignore no-sloppy-imports
import { receiveEmail } from "./bridge.js";
import { drainContacts, syncContact } from "./crm.ts";
import { handleInbound, type InboundMessage } from "./inbound.ts";
import { createRetryStore, type SqlDatabase } from "./retry.ts";

interface Bucket {
  head(key: string): Promise<unknown>;
  put(key: string, body: string): Promise<unknown>;
}

interface MailboxNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { getFolders(): Promise<unknown> };
}

interface RuntimeEnv {
  CLICKUP_API_TOKEN?: string;
  CLICKUP_LIST_ID_CONTACTS?: string;
  DB: SqlDatabase;
  BUCKET: Bucket;
  MAILBOX: MailboxNamespace;
  EMAIL_AGENT: unknown;
  EMAIL_ADDRESSES: readonly string[];
}

function mailboxSettings(name: string): string {
  return JSON.stringify({
    fromName: name,
    forwarding: { enabled: false, email: "" },
    signature: { enabled: false, text: "" },
    autoReply: { enabled: false, subject: "", message: "" },
  });
}

async function ensureMailbox(runtime: RuntimeEnv, mailbox: string): Promise<void> {
  const key = `mailboxes/${mailbox}.json`;
  if (await runtime.BUCKET.head(key)) return;
  await runtime.BUCKET.put(key, mailboxSettings(mailbox));
  await runtime.MAILBOX.get(runtime.MAILBOX.idFromName(mailbox)).getFolders();
}

function runtime(): RuntimeEnv {
  return env as unknown as RuntimeEnv;
}

function bindingText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function crm(current: RuntimeEnv) {
  return {
    token: bindingText(current.CLICKUP_API_TOKEN),
    listId: bindingText(current.CLICKUP_LIST_ID_CONTACTS),
    store: createRetryStore(current.DB),
  };
}

export default {
  fetch(): Response {
    return new Response("enrailar email-in", { status: 200 });
  },
  async email(
    message: InboundMessage,
    _env: unknown,
    ctx: { waitUntil(promise: Promise<unknown>): void },
  ): Promise<void> {
    const current = runtime();
    const contacts = crm(current);
    await handleInbound(message, {
      MAILBOX: {
        async deliver(input) {
          for (const mailbox of ROLE_MAILBOXES) {
            await ensureMailbox(current, mailbox);
          }
          const copy = new ArrayBuffer(input.raw.byteLength);
          new Uint8Array(copy).set(input.raw);
          await receiveEmail(
            {
              raw: new Blob([copy]).stream(),
              rawSize: copy.byteLength,
            },
            current,
            ctx,
          );
        },
      },
      CONTACTS: {
        sync: (contact) => syncContact(contacts, contact),
      },
    }, (event) => {
      console.log(JSON.stringify(event));
    });
    ctx.waitUntil(drainContacts(contacts, 5).catch(() => {
      console.log(JSON.stringify({ status: "clickup-drain-failed" }));
    }));
  },
  async scheduled(): Promise<void> {
    await drainContacts(crm(runtime()), 20);
  },
};
