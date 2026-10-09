import { renderMail, type RenderedMail } from "./render.ts";

export interface QueueMessage {
  readonly body: unknown;
  ack(): void;
  retry(): void;
}

export interface MailSender {
  send(message: RenderedMail): Promise<void>;
}

export interface QueueLog {
  status: "sent" | "invalid" | "no-origin" | "retry";
}

export async function handleQueue(
  messages: readonly QueueMessage[],
  origin: string,
  sender: MailSender,
  log: (event: QueueLog) => void,
): Promise<void> {
  for (const message of messages) {
    if (origin.trim().length === 0) {
      log({ status: "no-origin" });
      message.retry();
      continue;
    }
    const rendered = renderMail(message.body, origin.trim());
    if (!rendered) {
      log({ status: "invalid" });
      message.ack();
      continue;
    }
    try {
      await sender.send(rendered);
      log({ status: "sent" });
      message.ack();
    } catch {
      log({ status: "retry" });
      message.retry();
    }
  }
}
