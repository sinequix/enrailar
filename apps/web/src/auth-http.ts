import { appendAudit, createAuth, type AuthEnv } from "./auth.ts";
import {
  auditKind,
  authPath,
  isRateLimitedPath,
  needsTurnstile,
  originAllowed,
} from "./auth-policy.ts";
import { verifyTurnstile } from "./turnstile.ts";

export interface RateDatabase {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
}

interface RateRow {
  hits: number;
  windowStart: string;
}

function rateDecision(current: RateRow | undefined, now: string, windowMs: number, limit: number): { allowed: boolean; next: RateRow } {
  const started = current === undefined ? Number.NaN : Date.parse(current.windowStart);
  const expired = current === undefined || !Number.isFinite(started) || Date.parse(now) - started >= windowMs;
  if (expired) return { allowed: true, next: { hits: 1, windowStart: now } };
  if (current.hits >= limit) return { allowed: false, next: current };
  return { allowed: true, next: { hits: current.hits + 1, windowStart: current.windowStart } };
}

async function allow(db: RateDatabase, bucket: string, now: string): Promise<boolean> {
  const current = await db.prepare(
    "SELECT hits, window_start AS windowStart FROM rate_limits WHERE bucket = ?",
  ).bind(bucket).first<RateRow>();
  const decision = rateDecision(current ?? undefined, now, 10 * 60 * 1000, 5);
  await db.prepare(
    `INSERT INTO rate_limits (bucket, hits, window_start) VALUES (?, ?, ?)
     ON CONFLICT(bucket) DO UPDATE SET hits = excluded.hits, window_start = excluded.window_start`,
  ).bind(bucket, decision.next.hits, decision.next.windowStart).run();
  return decision.allowed;
}

function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

async function turnstileToken(request: Request): Promise<string> {
  const header = request.headers.get("x-turnstile-token");
  if (header && header.trim().length > 0) return header.trim();
  const body: unknown = await request.clone().json().catch(() => null);
  if (body && typeof body === "object" && "turnstileToken" in body && typeof body.turnstileToken === "string") {
    return body.turnstileToken;
  }
  return "";
}

function recordIdFrom(body: unknown): string {
  if (!body || typeof body !== "object" || !("userId" in body)) return "anonymous";
  const userId = body.userId;
  if (typeof userId !== "string" || userId.length === 0 || userId.includes("@")) return "anonymous";
  return userId;
}

export async function handleAuth(request: Request, env: AuthEnv & { TURNSTILE_SECRET_KEY?: string }, db: RateDatabase): Promise<Response> {
  const url = new URL(request.url);
  const production = env.AUTH_PRODUCTION === "1";
  if (!originAllowed(url.origin, production)) return Response.json({ ok: false }, { status: 403 });
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.trim().length === 0) {
    return Response.json({ ok: false }, { status: 503 });
  }
  const path = authPath(url.pathname);
  if (request.method === "POST" && isRateLimitedPath(path)) {
    const allowed = await allow(db, `auth:${path}:${clientIp(request)}`, new Date().toISOString());
    if (!allowed) return Response.json({ ok: false }, { status: 429 });
  }
  if (request.method === "POST" && needsTurnstile(path)) {
    const ok = await verifyTurnstile({
      secret: env.TURNSTILE_SECRET_KEY ?? "",
      token: await turnstileToken(request),
      ip: clientIp(request) === "unknown" ? undefined : clientIp(request),
    });
    if (!ok) return Response.json({ ok: false, error: "turnstile" }, { status: 400 });
  }
  const auth = createAuth(env, url.origin);
  const response = await auth.handler(request);
  const kind = auditKind(path, response.status, request.headers.get("cookie"));
  if (kind === "auth.login_failed") await appendAudit(db, kind, "anonymous");
  if (kind === "auth.role") {
    const body: unknown = await request.clone().json().catch(() => null);
    await appendAudit(db, kind, recordIdFrom(body));
  }
  if (kind === "auth.two_factor_on" || kind === "auth.two_factor_off") {
    const session = await auth.api.getSession({ headers: request.headers });
    const userId = session?.user?.id;
    await appendAudit(db, kind, typeof userId === "string" && !userId.includes("@") ? userId : "anonymous");
  }
  return response;
}
