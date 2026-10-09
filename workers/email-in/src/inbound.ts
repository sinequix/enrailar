import { ROLE_MAILBOXES, type RoleMailbox } from "@enrailar/shared";

const MAX_BYTES = 10 * 1024 * 1024;

export interface InboundMessage {
  readonly from: string;
  readonly to: string;
  readonly raw: ReadableStream<Uint8Array>;
  readonly rawSize: number;
  forward(destination: string): Promise<void>;
  setReject(reason: string): void;
}

export interface InboxFetch {
  fetch(input: Request): Promise<Response>;
}

export interface InboundEnv {
  readonly FORWARD_TO: string;
  readonly INBOX: InboxFetch;
}

export interface InboundLog {
  status: "forwarded" | "rejected";
  reason?: "empty" | "mailbox" | "size" | "inbox" | "forward";
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
  const destination = env.FORWARD_TO.trim();
  if (destination.length === 0) {
    message.setReject("FORWARD_TO is empty");
    log({ status: "rejected", reason: "empty" });
    return;
  }
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
  const stored = await env.INBOX.fetch(
    new Request("https://inbox.internal/internal/inbound", {
      method: "POST",
      headers: {
        "content-type": "message/rfc822",
        "x-envelope-to": message.to.trim().toLowerCase(),
      },
      body: bytes,
    }),
  );
  if (!stored.ok) {
    message.setReject("inbox unavailable");
    log({ status: "rejected", reason: "inbox" });
    return;
  }

  try {
    await message.forward(destination);
  } catch {
    message.setReject("forward failed");
    log({ status: "rejected", reason: "forward" });
    return;
  }
  log({ status: "forwarded" });
}
