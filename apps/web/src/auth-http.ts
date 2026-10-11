import { appendAudit, createAuth, type AuthEnv } from "./auth.ts";
import {
  auditKind,
  authPath,
  isPluginAdminPath,
  isRateLimitedPath,
  needsTurnstile,
  originAllowed,
  rateBucketIp,
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

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;

export const rateLimitSql =
  `INSERT INTO rate_limits (bucket, hits, window_start) VALUES (?, 1, ?)
   ON CONFLICT(bucket) DO UPDATE SET
     hits = CASE
       WHEN (julianday(?) - julianday(rate_limits.window_start)) * 86400000 >= ? THEN 1
       ELSE rate_limits.hits + 1
     END,
     window_start = CASE
       WHEN (julianday(?) - julianday(rate_limits.window_start)) * 86400000 >= ? THEN ?
       ELSE rate_limits.window_start
     END
   RETURNING hits`;

export async function consumeRateLimit(db: RateDatabase, bucket: string, now: string): Promise<boolean> {
  const row = await db.prepare(rateLimitSql).bind(
    bucket,
    now,
    now,
    RATE_WINDOW_MS,
    now,
    RATE_WINDOW_MS,
    now,
  ).first<{ hits: number }>();
  return (row?.hits ?? RATE_LIMIT + 1) <= RATE_LIMIT;
}

function rawIp(request: Request): string {
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

export async function handleAuth(request: Request, env: AuthEnv & { TURNSTILE_SECRET_KEY?: string }, db: RateDatabase): Promise<Response> {
  const url = new URL(request.url);
  const production = env.AUTH_PRODUCTION === "1";
  if (!originAllowed(url.origin, production)) return Response.json({ ok: false }, { status: 403 });
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.trim().length === 0) {
    return Response.json({ ok: false }, { status: 503 });
  }
  const path = authPath(url.pathname);
  if (isPluginAdminPath(path)) return Response.json({ ok: false }, { status: 403 });
  if (request.method === "POST" && isRateLimitedPath(path)) {
    const allowed = await consumeRateLimit(db, `auth:${path}:${rateBucketIp(rawIp(request))}`, new Date().toISOString());
    if (!allowed) return Response.json({ ok: false }, { status: 429 });
  }
  if (request.method === "POST" && needsTurnstile(path)) {
    const ok = await verifyTurnstile({
      secret: env.TURNSTILE_SECRET_KEY ?? "",
      token: await turnstileToken(request),
      ip: rawIp(request) === "unknown" ? undefined : rawIp(request),
    });
    if (!ok) return Response.json({ ok: false, error: "turnstile" }, { status: 400 });
  }
  const auth = createAuth(env, url.origin);
  const response = await auth.handler(request);
  if (auditKind(path, response.status) === "auth.login_failed") await appendAudit(db, "auth.login_failed", "anonymous");
  return response;
}
