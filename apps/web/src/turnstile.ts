/**
 * Clave pública (sitekey) de Turnstile.
 *
 * En Cloudflare, Alchemy declara el binding `TURNSTILE_SITE_KEY` en el Worker
 * de la web (`infra/alchemy.run.ts`). Con `nodejs_compat` y fecha de
 * compatibilidad posterior a 2025-04-01, ese binding aparece en `process.env`
 * en tiempo de request. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` queda como alternativa
 * para desarrollo local (`.env`) y para builds que la inyecten.
 */
export const TURNSTILE_SITE_KEY_NAMES = ["TURNSTILE_SITE_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY"] as const;

export type TurnstileEnv = Partial<Record<(typeof TURNSTILE_SITE_KEY_NAMES)[number], string | undefined>>;

export function resolveTurnstileSiteKey(env: TurnstileEnv): string {
  for (const name of TURNSTILE_SITE_KEY_NAMES) {
    const value = env[name];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return "";
}

/** Lee la clave del entorno del proceso en el momento de la llamada, nunca en build. */
export function turnstileSiteKeyFromProcess(): string {
  const env = (globalThis as { process?: { env?: TurnstileEnv } }).process?.env ?? {};
  return resolveTurnstileSiteKey(env);
}

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(input: {
  secret: string;
  token: string;
  ip: string | undefined;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  if (input.secret.trim().length === 0 || input.token.trim().length === 0) return false;
  const body = new URLSearchParams({ secret: input.secret, response: input.token });
  if (input.ip !== undefined && input.ip.length > 0) body.set("remoteip", input.ip);
  const response = await (input.fetchImpl ?? fetch)(SITEVERIFY, { method: "POST", body });
  if (!response.ok) return false;
  const payload: unknown = await response.json();
  return typeof payload === "object" && payload !== null && "success" in payload && payload.success === true;
}
