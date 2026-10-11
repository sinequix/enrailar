import { renderMail, type MailOrigins, type RenderedMail } from "./render.ts";

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
  origins: MailOrigins,
  sender: MailSender,
  log: (event: QueueLog) => void,
): Promise<void> {
  for (const message of messages) {
    const rendered = renderMail(message.body, origins);
    if (rendered.status === "invalid") {
      log({ status: "invalid" });
      message.ack();
      continue;
    }
    if (rendered.status === "no-origin") {
      log({ status: "no-origin" });
      message.retry();
      continue;
    }
    try {
      await sender.send(rendered.mail);
      log({ status: "sent" });
      message.ack();
    } catch {
      log({ status: "retry" });
      message.retry();
    }
  }
}
