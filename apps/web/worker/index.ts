import handler from "vinext/server/fetch-handler";
import { handleAuth, type RateDatabase } from "../src/auth-http.ts";
import type { AuthEnv } from "../src/auth.ts";
import { withSecurityHeaders } from "../src/security-headers.ts";

interface WebEnv extends AuthEnv {
  TURNSTILE_SECRET_KEY?: string;
  DB: RateDatabase;
}

export default {
  async fetch(request: Request, env: WebEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const response = url.pathname.startsWith("/api/auth")
      ? await handleAuth(request, env, env.DB)
      : await handler.fetch(request, env, ctx);
    return withSecurityHeaders(response, url.protocol === "https:");
  },
};
