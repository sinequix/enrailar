import { env } from "cloudflare:workers";
import { handleQueue, type QueueMessage } from "./queue.ts";

interface OutEnv {
  SEND_EMAIL: {
    send(message: EmailMessage): Promise<unknown>;
  };
  PUBLIC_API_ORIGIN: string;
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
    return handleQueue(batch.messages, bound.PUBLIC_API_ORIGIN, {
      send(message) {
        return bound.SEND_EMAIL.send(new EmailMessage(message.from, message.to, message.mime)).then(() => undefined);
      },
    }, (event) => {
      console.log(JSON.stringify(event));
    });
  },
};
