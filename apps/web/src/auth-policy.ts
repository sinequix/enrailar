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

export function isPluginAdminPath(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

/** Permisos del rol admin. Sin impersonar ni cambiar la contraseña de otro. */
export const adminUserPermissions = [
  "create",
  "list",
  "set-role",
  "ban",
  "delete",
  "set-email",
  "get",
  "update",
] as const;

export function adminMay(action: string): boolean {
  return (adminUserPermissions as readonly string[]).includes(action);
}

export function roleChangeAllowed(input: {
  actorId: string;
  targetId: string;
  nextRole: string;
  targetRole: string;
  adminCount: number;
}): boolean {
  if (input.actorId === input.targetId) return false;
  if (input.targetRole === "admin" && input.nextRole !== "admin" && input.adminCount <= 1) return false;
  return true;
}

export function isRateLimitedPath(path: string): boolean {
  return path === "/sign-in/email" ||
    path === "/sign-up/email" ||
    path === "/request-password-reset" ||
    path === "/forget-password" ||
    path === "/send-verification-email" ||
    path === "/reset-password" ||
    path === "/change-password" ||
    path === "/sign-in/passkey" ||
    path.startsWith("/two-factor/") ||
    path.startsWith("/email-otp/") ||
    path.startsWith("/passkey/");
}

export function needsTurnstile(path: string): boolean {
  return path === "/sign-up/email" ||
    path === "/request-password-reset" ||
    path === "/forget-password" ||
    path === "/send-verification-email";
}

/** IPv4 queda igual. IPv6 se agrupa por los primeros 64 bits. */
export function rateBucketIp(raw: string): string {
  const ip = raw.trim().toLowerCase();
  if (ip.length === 0) return "unknown";
  if (!ip.includes(":")) return ip;
  const groups = expandIpv6(ip.split("%")[0] ?? ip);
  if (!groups) return ip;
  return `${groups.slice(0, 4).join(":")}::/64`;
}

function expandIpv6(ip: string): string[] | null {
  let head = ip;
  const mapped = head.match(/^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (mapped) {
    const numbers = [mapped[2], mapped[3], mapped[4], mapped[5]].map((part) => Number(part));
    if (numbers.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
    const hi = ((numbers[0]! << 8) | numbers[1]!).toString(16);
    const lo = ((numbers[2]! << 8) | numbers[3]!).toString(16);
    head = `${mapped[1]}${hi}:${lo}`;
  }
  const halves = head.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (halves.length === 1 && left.length !== 8) return null;
  if (missing < 0) return null;
  const groups = halves.length === 1 ? left : [...left, ...Array<string>(missing).fill("0"), ...right];
  if (groups.length !== 8) return null;
  const normalized: string[] = [];
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    normalized.push(group.padStart(4, "0"));
  }
  return normalized;
}

export function isLoginAttempt(path: string): boolean {
  return path === "/sign-in/email" ||
    path.startsWith("/sign-in/") ||
    path.startsWith("/two-factor/verify") ||
    path.startsWith("/passkey/");
}

export type SessionFactor = "totp" | "backup" | "otp" | "passkey";

export function sessionFactor(value: unknown): SessionFactor | null {
  if (value === "totp" || value === "backup" || value === "otp" || value === "passkey") return value;
  return null;
}

export function sessionFactorForPath(path: string): SessionFactor | null {
  if (path === "/two-factor/verify-totp") return "totp";
  if (path === "/two-factor/verify-backup-code") return "backup";
  if (path === "/two-factor/verify-otp") return "otp";
  if (path === "/passkey/verify-authentication") return "passkey";
  return null;
}

export function sessionIsFresh(createdAt: string | Date, now: number, freshAgeSeconds: number): boolean {
  if (freshAgeSeconds === 0) return true;
  const created = createdAt instanceof Date ? createdAt.getTime() : Date.parse(createdAt);
  if (!Number.isFinite(created)) return false;
  return now - created < freshAgeSeconds * 1000;
}

export function passkeyRegistrationAllowed(input: {
  hasSession: boolean;
  fresh: boolean;
  twoFactorEnabled: boolean;
}): boolean {
  return input.hasSession && input.fresh && input.twoFactorEnabled;
}

export interface GateUser {
  role: string | null;
  sessionFactor: SessionFactor | null;
}

export type GateDecision = "missing" | "forbidden" | "setup" | "ok";

export type RequestArea = "public" | "session" | "admin";

/** `/app` pide sesión. `/app/admin` y `/api/admin` piden el guard de admin. */
export function requestArea(pathname: string): RequestArea {
  if (pathname === "/api/admin" || pathname.startsWith("/api/admin/")) return "admin";
  const match = /^\/(es|en)\/app(\/.*)?$/.exec(pathname);
  if (!match) return "public";
  const rest = match[2] ?? "";
  if (rest === "/admin" || rest.startsWith("/admin/")) return "admin";
  return "session";
}

export function areaLocale(pathname: string): "es" | "en" {
  if (pathname === "/en" || pathname.startsWith("/en/")) return "en";
  return "es";
}

/** Admin entra solo si esta sesión se autenticó con 2FA o passkey. Tener una passkey no alcanza. */
export function gateDecision(user: GateUser | undefined): GateDecision {
  if (!user) return "missing";
  if (user.role !== "admin") return "forbidden";
  if (user.sessionFactor) return "ok";
  return "setup";
}

export function cookieHas(header: string | null, name: string): boolean {
  if (!header) return false;
  return header.split(";").some((part) => part.trim().startsWith(`${name}=`));
}

/** En HTTPS Better Auth prefija la cookie con `__Secure-`. */
export function cookieHasSession(header: string | null, prefix = "enrailar"): boolean {
  return cookieHas(header, `${prefix}.session_token`) || cookieHas(header, `__Secure-${prefix}.session_token`);
}

export type AuditKind = "auth.login_failed";

export type AuditEvent =
  | "auth.login"
  | "auth.two_factor_on"
  | "auth.two_factor_off"
  | "auth.role"
  | "auth.user_update"
  | "auth.user_create"
  | "auth.ban"
  | "auth.remove";

export function auditKind(path: string, status: number): AuditKind | undefined {
  if (isLoginAttempt(path) && (status === 401 || status === 403)) return "auth.login_failed";
  return undefined;
}

/** Un éxito anota un solo evento. Con 2FA pendiente el login no se anota. */
export function auditAfter(input: {
  path: string;
  ok: boolean;
  pendingTwoFactor: boolean;
  hadSession: boolean;
  roleInBody: boolean;
}): AuditEvent | undefined {
  if (!input.ok || input.pendingTwoFactor) return undefined;
  if (
    input.path === "/sign-in/email" ||
    input.path === "/sign-in/passkey" ||
    input.path === "/passkey/verify-authentication"
  ) return "auth.login";
  if (input.path === "/two-factor/verify-totp" || input.path === "/two-factor/verify-backup-code" || input.path === "/two-factor/verify-otp") {
    return input.hadSession ? "auth.two_factor_on" : "auth.login";
  }
  if (input.path === "/two-factor/disable") return "auth.two_factor_off";
  if (input.path === "/admin/set-role" || (input.path === "/admin/update-user" && input.roleInBody)) return "auth.role";
  if (input.path === "/admin/update-user") return "auth.user_update";
  if (input.path === "/admin/create-user") return "auth.user_create";
  if (input.path === "/admin/ban-user") return "auth.ban";
  if (input.path === "/admin/remove-user") return "auth.remove";
  return undefined;
}
