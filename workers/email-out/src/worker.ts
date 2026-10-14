import { env } from "cloudflare:workers";
import { handleQueue, type QueueMessage } from "./queue.ts";
import { toEmailSend, type EmailSendPayload } from "./render.ts";

interface OutEnv {
  EMAIL: {
    send(message: EmailSendPayload): Promise<{ messageId: string }>;
  };
  PUBLIC_API_ORIGIN: string;
  APP_BASE_URL: string;
  EMAIL_FROM: string;
}

function bindings(): OutEnv {
  return env as OutEnv;
}

export default {
  fetch(): Response {
    return new Response("enrailar email-out", { status: 200 });
  },
  queue(batch: { messages: QueueMessage[] }): Promise<void> {
    const bound = bindings();
    return handleQueue(batch.messages, {
      api: bound.PUBLIC_API_ORIGIN ?? "",
      web: bound.APP_BASE_URL ?? "",
      from: bound.EMAIL_FROM ?? "",
    }, {
      send(message) {
        return bound.EMAIL.send(toEmailSend(message)).then(() => undefined);
      },
    }, (event) => {
      console.log(JSON.stringify(event));
    });
  },
};
