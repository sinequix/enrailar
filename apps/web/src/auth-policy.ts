/** Decisiones de auth sin red ni Better Auth, para poder testearlas solas. */

export type AuthRole = "user" | "admin";

export function parseAdminEmails(raw: string | undefined): ReadonlySet<string> {
  const found = new Set<string>();
  for (const part of (raw ?? "").split(",")) {
    const email = part.trim().toLowerCase();
    if (email.includes("@") && !email.includes(" ")) found.add(email);
  }
  return found;
}

export function roleForEmail(email: string, admins: ReadonlySet<string>): AuthRole {
  return admins.has(email.trim().toLowerCase()) ? "admin" : "user";
}

/** El consentimiento de la Ley 25.326 es un instante, no un texto libre. */
export function isConsentAt(value: string, now = Date.now()): boolean {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const delta = now - parsed;
  return delta >= -60_000 && delta <= 10 * 60_000;
}

export function originAllowed(origin: string, production: boolean): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  if (host === "enrailar.com" || host === "www.enrailar.com") return url.protocol === "https:";
  if (production) return false;
  if (host === "localhost" || host === "127.0.0.1") return url.protocol === "http:" || url.protocol === "https:";
  if (host.endsWith(".workers.dev")) return url.protocol === "https:";
  return false;
}

/** rpID de WebAuthn. En prod es el dominio registrable, no www. */
export function rpIdFor(hostname: string): string {
  const host = hostname.toLowerCase().split(":")[0] ?? hostname;
  if (host === "enrailar.com" || host === "www.enrailar.com") return "enrailar.com";
  return host;
}

export function authPath(pathname: string): string {
  const prefix = "/api/auth";
  if (!pathname.startsWith(prefix)) return pathname;
  const rest = pathname.slice(prefix.length);
  return rest.length === 0 ? "/" : rest;
}

export function isRateLimitedPath(path: string): boolean {
  return path === "/sign-in/email" ||
    path === "/sign-up/email" ||
    path === "/request-password-reset" ||
    path === "/forget-password" ||
    path.startsWith("/two-factor/") ||
    path.startsWith("/email-otp/");
}

export function needsTurnstile(path: string): boolean {
  return path === "/sign-up/email" || path === "/request-password-reset" || path === "/forget-password";
}

export function isLoginAttempt(path: string): boolean {
  return path === "/sign-in/email" ||
    path.startsWith("/sign-in/") ||
    path.startsWith("/two-factor/verify") ||
    path.startsWith("/passkey/");
}

export interface GateUser {
  role: string | null;
  twoFactorEnabled: boolean;
  passkeys: number;
}

export type GateDecision = "missing" | "forbidden" | "setup" | "ok";

/** Admin entra a /app/admin solo con 2FA o una passkey. El resto recibe 403. */
export function gateDecision(user: GateUser | undefined): GateDecision {
  if (!user) return "missing";
  if (user.role !== "admin") return "forbidden";
  if (user.twoFactorEnabled || user.passkeys > 0) return "ok";
  return "setup";
}

export function cookieHas(header: string | null, name: string): boolean {
  if (!header) return false;
  return header.split(";").some((part) => part.trim().startsWith(`${name}=`));
}

export type AuditKind = "auth.login_failed" | "auth.two_factor_on" | "auth.two_factor_off" | "auth.role";

export function auditKind(path: string, status: number, cookie: string | null): AuditKind | undefined {
  if (path === "/admin/set-role" && status === 200) return "auth.role";
  if (path === "/two-factor/disable" && status === 200) return "auth.two_factor_off";
  if (path === "/two-factor/verify-totp" && status === 200 && cookieHas(cookie, "enrailar.session_token") && !cookieHas(cookie, "enrailar.two_factor")) {
    return "auth.two_factor_on";
  }
  if (isLoginAttempt(path) && (status === 401 || status === 403)) return "auth.login_failed";
  return undefined;
}
