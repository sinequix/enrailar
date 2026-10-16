import { upsertCrmContact as pushCrmContact, type CrmContact, type MailJob } from "@enrailar/shared";
import { env } from "cloudflare:workers";
import type { ApiDeps } from "./deps.ts";
import { createD1Store, type QueueLike, type SqlDatabase } from "./store.ts";
import { verifyTurnstile } from "./turnstile.ts";

interface WorkerEnv {
  DB: SqlDatabase;
  MAIL_QUEUE: QueueLike;
  TURNSTILE_SECRET_KEY: string;
  CLICKUP_API_TOKEN?: string;
  CLICKUP_LIST_ID?: string;
}

function bindingText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function bindings(): WorkerEnv {
  return env as WorkerEnv;
}

export function workerDeps(): ApiDeps {
  return {
    store: createD1Store(bindings().DB),
    now: () => new Date().toISOString(),
    log(event) {
      console.log(JSON.stringify(event));
    },
    verifyTurnstile(token, ip) {
      return verifyTurnstile({ secret: bindings().TURNSTILE_SECRET_KEY, token, ip });
    },
    enqueue(job: MailJob) {
      return bindings().MAIL_QUEUE.send(job);
    },
    upsertCrmContact(contact: CrmContact) {
      const runtime = bindings();
      return pushCrmContact(contact, {
        token: bindingText(runtime.CLICKUP_API_TOKEN),
        listId: bindingText(runtime.CLICKUP_LIST_ID),
      });
    },
    rateLimit: { limit: 8, windowMs: 10 * 60 * 1000 },
  };
}
