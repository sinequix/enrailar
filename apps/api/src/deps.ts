import type { MailJob } from "@enrailar/shared";
import type { Store } from "./store.ts";

export interface LogEvent {
  route: string;
  status: number;
  recordId?: string;
}

export interface ApiDeps {
  store: Store;
  now: () => string;
  log: (event: LogEvent) => void;
  verifyTurnstile: (token: string, ip: string | undefined) => Promise<boolean>;
  enqueue: (job: MailJob) => Promise<void>;
  rateLimit: { limit: number; windowMs: number };
}

export function clientIp(header: string | undefined): string {
  const value = header?.trim();
  return value && value.length > 0 ? value : "unknown";
}

const fixedOrigins = new Set([
  "https://enrailar.com",
  "https://www.enrailar.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

export function originAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  if (fixedOrigins.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname.endsWith(".workers.dev");
  } catch {
    return false;
  }
}
