import { env } from "cloudflare:workers";
import { createD1Store, type QueueLike, type SqlDatabase } from "./store.ts";
import { verifyTurnstile } from "./turnstile.ts";
import type { ApiDeps } from "./deps.ts";
import type { MailJob } from "@enrailar/shared";

interface WorkerEnv {
  DB: SqlDatabase;
  MAIL_QUEUE: QueueLike;
  TURNSTILE_SECRET_KEY: string;
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
    rateLimit: { limit: 8, windowMs: 10 * 60 * 1000 },
  };
}
