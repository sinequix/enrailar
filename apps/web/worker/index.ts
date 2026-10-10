import handler from "vinext/server/fetch-handler";
import { guardRequest } from "../src/app-guard.ts";
import { handleAuth, type RateDatabase } from "../src/auth-http.ts";
import type { AuthEnv } from "../src/auth.ts";
import { asDatabase, bindDb } from "../src/request-db.ts";
import { withSecurityHeaders } from "../src/security-headers.ts";

interface WebEnv extends AuthEnv {
  TURNSTILE_SECRET_KEY?: string;
  DB: RateDatabase;
}

export default {
  async fetch(request: Request, env: WebEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const db = asDatabase(env.DB);
    if (db) bindDb(db);
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
    if (proc?.env) {
      if (env.BETTER_AUTH_SECRET) proc.env.BETTER_AUTH_SECRET = env.BETTER_AUTH_SECRET;
      proc.env.ADMIN_EMAILS = env.ADMIN_EMAILS ?? "";
      proc.env.AUTH_PRODUCTION = env.AUTH_PRODUCTION ?? "";
    }
    const https = url.protocol === "https:";
    if (url.pathname.startsWith("/api/auth")) {
      return await withSecurityHeaders(await handleAuth(request, env, env.DB), https);
    }
    const guarded = await guardRequest(request, env);
    if (guarded) return await withSecurityHeaders(guarded, https);
    return await withSecurityHeaders(await handler.fetch(request, env, ctx), https);
  },
};
