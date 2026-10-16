import { PUBLIC_CONTACT, ROLE_MAILBOXES, type RoleMailbox } from "@enrailar/shared";
import type { ContactSync } from "./crm.ts";
import { readContact } from "./parse.ts";

const MAX_BYTES = 10 * 1024 * 1024;

export interface InboundMessage {
  readonly from: string;
  readonly to: string;
  readonly raw: ReadableStream<Uint8Array>;
  readonly rawSize: number;
  setReject(reason: string): void;
}

export interface MailboxDelivery {
  deliver(input: { to: string; raw: Uint8Array }): Promise<void>;
}

export interface InboundEnv {
  readonly MAILBOX: MailboxDelivery;
  readonly CONTACTS: ContactSync;
}

export interface InboundLog {
  status: "stored" | "rejected";
  reason?: "mailbox" | "size" | "inbox";
  clickup?: "synced" | "retry" | "skipped";
}

function isRoleMailbox(value: string): value is RoleMailbox {
  const mailbox = value.trim().toLowerCase();
  return (ROLE_MAILBOXES as readonly string[]).includes(mailbox);
}

export async function handleInbound(
  message: InboundMessage,
  env: InboundEnv,
  log: (event: InboundLog) => void,
): Promise<void> {
  if (!isRoleMailbox(message.to)) {
    message.setReject("mailbox not accepted");
    log({ status: "rejected", reason: "mailbox" });
    return;
  }
  if (message.rawSize <= 0 || message.rawSize > MAX_BYTES) {
    message.setReject("message size");
    log({ status: "rejected", reason: "size" });
    return;
  }

  const bytes = new Uint8Array(await new Response(message.raw).arrayBuffer());
  const mailbox = message.to.trim().toLowerCase();
  try {
    await env.MAILBOX.deliver({ to: mailbox, raw: bytes });
  } catch {
    message.setReject("inbox unavailable");
    log({ status: "rejected", reason: "inbox" });
    return;
  }

  if (mailbox !== PUBLIC_CONTACT) {
    log({ status: "stored", clickup: "skipped" });
    return;
  }
  const contact = await readContact(bytes, message.from);
  const clickup = await env.CONTACTS.sync(contact);
  log({ status: "stored", clickup });
}
