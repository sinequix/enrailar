import { createAuth, type AuthEnv } from "./auth.ts";
import {
  areaLocale,
  gateDecision,
  requestArea,
  type GateDecision,
  type RequestArea,
} from "./auth-policy.ts";
import { asDatabase, type AppDatabase } from "./request-db.ts";

export interface AccessUser {
  id: string;
  email: string;
  name: string;
  role: string;
  decision: GateDecision;
}

export type Access =
  | { decision: "missing"; user: null }
  | { decision: Exclude<GateDecision, "missing">; user: AccessUser };

function countOf(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  return 0;
}

function flag(value: unknown): boolean {
  return value === true || value === 1 || value === 1n;
}

async function loadUser(db: AppDatabase, userId: string): Promise<AccessUser | null> {
  const row = await db.prepare(
    'SELECT email, name, role, "twoFactorEnabled" AS twoFactorEnabled FROM "user" WHERE id = ?',
  ).bind(userId).first<{
    email: string;
    name: string;
    role: string | null;
    twoFactorEnabled: number | boolean | null;
  }>();
  if (!row || typeof row.email !== "string") return null;
  const passkeys = await db.prepare(
    'SELECT COUNT(*) AS total FROM passkey WHERE "userId" = ?',
  ).bind(userId).first<{ total: number }>();
  const decision = gateDecision({
    role: typeof row.role === "string" ? row.role : "user",
    twoFactorEnabled: flag(row.twoFactorEnabled),
    passkeys: countOf(passkeys?.total),
  });
  if (decision === "missing") return null;
  return {
    id: userId,
    email: row.email,
    name: typeof row.name === "string" && row.name.length > 0 ? row.name : "cuenta",
    role: typeof row.role === "string" ? row.role : "user",
    decision,
  };
}

export function requestFrom(host: string | null, cookie: string | null): Request {
  const hostname = (host ?? "localhost").split(":")[0]?.toLowerCase() ?? "localhost";
  const https = hostname === "enrailar.com" || hostname === "www.enrailar.com" || hostname.endsWith(".workers.dev");
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return new Request(`${https ? "https" : "http"}://${host ?? "localhost"}/es/app`, { headers });
}

export async function decideAccess(request: Request, env: AuthEnv): Promise<Access> {
  const db = asDatabase(env.DB);
  const secret = env.BETTER_AUTH_SECRET ?? "";
  if (!db || secret.trim().length === 0) return { decision: "missing", user: null };
  const origin = new URL(request.url).origin;
  const auth = createAuth(env, origin);
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user && "id" in session.user && typeof session.user.id === "string" ? session.user.id : "";
  if (userId.length === 0) return { decision: "missing", user: null };
  const user = await loadUser(db, userId);
  if (!user || user.decision === "missing") return { decision: "missing", user: null };
  return { decision: user.decision, user };
}

function forbidden(locale: "es" | "en"): Response {
  const text = locale === "en" ? "You do not have access." : "No tenés acceso.";
  const html = `<!doctype html><html lang="${locale}"><meta charset="utf-8"><title>403</title><p>${text}</p>`;
  return new Response(html, {
    status: 403,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function guardRequest(request: Request, env: AuthEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const area: RequestArea = requestArea(url.pathname);
  if (area === "public") return null;
  const locale = areaLocale(url.pathname);
  const access = await decideAccess(request, env);
  switch (area) {
    case "session":
      if (access.decision === "missing") return Response.redirect(new URL(`/${locale}/cuenta/ingresar`, url.origin), 303);
      return null;
    case "admin":
      if (access.decision === "ok") return null;
      return forbidden(locale);
    default: {
      const unreachable: never = area;
      return unreachable;
    }
  }
}
