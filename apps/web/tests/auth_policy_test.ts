import { assert, assertEquals } from "@std/assert";
import {
  auditKind,
  gateDecision,
  isConsentAt,
  isRateLimitedPath,
  needsTurnstile,
  originAllowed,
  parseAdminEmails,
  roleForEmail,
  rpIdFor,
} from "../src/auth-policy.ts";
import { securityHeaders } from "../src/security-headers.ts";

const now = Date.parse("2026-10-10T12:00:00.000Z");

Deno.test("el primer admin sale de la lista y nunca de un correo fijo", () => {
  const admins = parseAdminEmails(" Hola@Enrailar.com, prensa@enrailar.com ");
  assert(admins.has("hola@enrailar.com"));
  assert(admins.has("prensa@enrailar.com"));
  assertEquals(parseAdminEmails("").size, 0);
  assertEquals(parseAdminEmails(undefined).size, 0);
  assertEquals(roleForEmail("prensa@enrailar.com", admins), "admin");
  assertEquals(roleForEmail("otra@enrailar.com", admins), "user");
});

Deno.test("el consentimiento es un instante reciente", () => {
  assert(isConsentAt("2026-10-10T12:00:00.000Z", now));
  assert(!isConsentAt("ayer", now));
  assert(!isConsentAt("2026-10-10T11:00:00.000Z", now));
});

Deno.test("los orígenes de confianza son el sitio, y el preview solo fuera de prod", () => {
  assert(originAllowed("https://enrailar.com", true));
  assert(originAllowed("https://www.enrailar.com", true));
  assert(!originAllowed("https://api.enrailar.com", true));
  assert(!originAllowed("https://evil.example", true));
  assert(!originAllowed("http://enrailar.com", true));
  assert(!originAllowed("https://preview.workers.dev", true));
  assert(originAllowed("https://preview.workers.dev", false));
  assert(originAllowed("http://127.0.0.1:4173", false));
  assertEquals(rpIdFor("www.enrailar.com"), "enrailar.com");
  assertEquals(rpIdFor("127.0.0.1"), "127.0.0.1");
});

Deno.test("login, registro y OTP tienen límite, y Turnstile va en registro y recuperación", () => {
  assert(isRateLimitedPath("/sign-in/email"));
  assert(isRateLimitedPath("/sign-up/email"));
  assert(isRateLimitedPath("/request-password-reset"));
  assert(isRateLimitedPath("/two-factor/verify-totp"));
  assert(!isRateLimitedPath("/get-session"));
  assert(needsTurnstile("/sign-up/email"));
  assert(needsTurnstile("/forget-password"));
  assert(!needsTurnstile("/sign-in/email"));
});

Deno.test("un user no pasa el guard de admin y un admin sin segundo factor tampoco", () => {
  assertEquals(gateDecision(undefined), "missing");
  assertEquals(gateDecision({ role: "user", twoFactorEnabled: true, passkeys: 0 }), "forbidden");
  assertEquals(gateDecision({ role: "admin", twoFactorEnabled: false, passkeys: 0 }), "setup");
  assertEquals(gateDecision({ role: "admin", twoFactorEnabled: true, passkeys: 0 }), "ok");
  assertEquals(gateDecision({ role: "admin", twoFactorEnabled: false, passkeys: 1 }), "ok");
});

Deno.test("la auditoría anota fallo, 2FA y cambio de rol sin pedir el correo", () => {
  assertEquals(auditKind("/sign-in/email", 401, null), "auth.login_failed");
  assertEquals(auditKind("/two-factor/verify-totp", 200, "enrailar.two_factor=1"), undefined);
  assertEquals(auditKind("/two-factor/verify-totp", 200, "enrailar.session_token=1"), "auth.two_factor_on");
  assertEquals(auditKind("/two-factor/disable", 200, null), "auth.two_factor_off");
  assertEquals(auditKind("/admin/set-role", 200, null), "auth.role");
  const sql = Deno.readTextFileSync(new URL("../../api/migrations/0004_auth.sql", import.meta.url));
  assert(sql.includes('CREATE TABLE "user"'));
  assert(!sql.toLowerCase().includes("drop table"));
  assert(!sql.includes("preinscriptions"));
});

Deno.test("la web manda CSP, HSTS y frame-ancestors", () => {
  const https = securityHeaders(true);
  const csp = https.find((header) => header[0] === "content-security-policy")?.[1] ?? "";
  assert(csp.includes("frame-ancestors 'none'"));
  assert(https.some((header) => header[0] === "strict-transport-security" && header[1].includes("max-age=")));
  assert(!securityHeaders(false).some((header) => header[0] === "strict-transport-security"));
});
