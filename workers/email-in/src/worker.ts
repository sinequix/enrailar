import { ROLE_MAILBOXES } from "@enrailar/shared";
import { env } from "cloudflare:workers";
// bridge.js reexporta receiveEmail. El .d.ts lo ve tsc; el bundler sigue el .js.
// deno-lint-ignore no-sloppy-imports
import { receiveEmail } from "./bridge.js";
import { handleInbound, type InboundMessage } from "./inbound.ts";

interface Bucket {
  head(key: string): Promise<unknown>;
  put(key: string, body: string): Promise<unknown>;
}

interface MailboxNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { getFolders(): Promise<unknown> };
}

interface RuntimeEnv {
  FORWARD_TO: string;
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

export default {
  fetch(): Response {
    return new Response("enrailar email-in", { status: 200 });
  },
  async email(
    message: InboundMessage,
    _env: unknown,
    ctx: { waitUntil(promise: Promise<unknown>): void },
  ): Promise<void> {
    const runtime = env as unknown as RuntimeEnv;
    await handleInbound(message, {
      FORWARD_TO: runtime.FORWARD_TO,
      MAILBOX: {
        async deliver(input) {
          for (const mailbox of ROLE_MAILBOXES) {
            await ensureMailbox(runtime, mailbox);
          }
          const copy = new ArrayBuffer(input.raw.byteLength);
          new Uint8Array(copy).set(input.raw);
          await receiveEmail(
            {
              raw: new Blob([copy]).stream(),
              rawSize: copy.byteLength,
            },
            runtime,
            ctx,
          );
        },
      },
    }, (event) => {
      console.log(JSON.stringify(event));
    });
  },
};
