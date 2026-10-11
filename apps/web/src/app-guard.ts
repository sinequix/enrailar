import { createAuth, type AuthEnv } from "./auth.ts";
import {
  areaLocale,
  gateDecision,
  requestArea,
  sessionFactor,
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

async function loadUser(db: AppDatabase, userId: string, token: string): Promise<AccessUser | null> {
  const row = await db.prepare(
    `SELECT u.email AS email, u.name AS name, u.role AS role, s."authMethod" AS authMethod
     FROM "user" u JOIN "session" s ON s."userId" = u.id
     WHERE u.id = ? AND s.token = ?`,
  ).bind(userId, token).first<{
    email: string;
    name: string;
    role: string | null;
    authMethod: string | null;
  }>();
  if (!row || typeof row.email !== "string") return null;
  const decision = gateDecision({
    role: typeof row.role === "string" ? row.role : "user",
    sessionFactor: sessionFactor(row.authMethod),
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
  const token = session?.session && "token" in session.session && typeof session.session.token === "string" ? session.session.token : "";
  if (userId.length === 0 || token.length === 0) return { decision: "missing", user: null };
  const user = await loadUser(db, userId, token);
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

export async function requireAdminAccess(request: Request, env: AuthEnv): Promise<Response | null> {
  const access = await decideAccess(request, env);
  if (access.decision === "ok") return null;
  return forbidden(areaLocale(new URL(request.url).pathname));
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
