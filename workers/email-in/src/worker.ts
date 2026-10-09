import { env } from "cloudflare:workers";
import { handleInbound, type InboundEnv, type InboundMessage } from "./inbound.ts";

function bindings(): InboundEnv {
  return env as InboundEnv;
}

export default {
  fetch(): Response {
    return new Response("enrailar email-in", { status: 200 });
  },
  email(message: InboundMessage): Promise<void> {
    return handleInbound(message, bindings(), (event) => {
      console.log(JSON.stringify(event));
    });
  },
};
