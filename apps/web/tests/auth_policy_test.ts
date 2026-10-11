import { assert, assertEquals } from "@std/assert";
import {
  adminMay,
  auditAfter,
  auditKind,
  cookieHasSession,
  gateDecision,
  isConsentAt,
  isPluginAdminPath,
  isRateLimitedPath,
  needsTurnstile,
  originAllowed,
  parseAdminEmails,
  passkeyRegistrationAllowed,
  rateBucketIp,
  requestArea,
  roleChangeAllowed,
  roleForEmail,
  rpIdFor,
  sessionIsFresh,
} from "../src/auth-policy.ts";
import { cspScriptHash, inlineScriptHashes, securityHeaders, sumateScriptHash } from "../src/security-headers.ts";
import { sumateBootScript } from "../src/sumate-memory.ts";

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
  assert(isRateLimitedPath("/send-verification-email"));
  assert(isRateLimitedPath("/passkey/verify-registration"));
  assert(isRateLimitedPath("/sign-in/passkey"));
  assert(isRateLimitedPath("/reset-password"));
  assert(isRateLimitedPath("/change-password"));
  assert(!isRateLimitedPath("/get-session"));
  assert(needsTurnstile("/sign-up/email"));
  assert(needsTurnstile("/forget-password"));
  assert(needsTurnstile("/send-verification-email"));
  assert(!needsTurnstile("/sign-in/email"));
  assert(isPluginAdminPath("/admin/set-role"));
  assert(!isPluginAdminPath("/api/admin/role"));
});

Deno.test("el área de /app y /api/admin se decide por el path", () => {
  assertEquals(requestArea("/es"), "public");
  assertEquals(requestArea("/es/cuenta/ingresar"), "public");
  assertEquals(requestArea("/es/app"), "session");
  assertEquals(requestArea("/en/app/perfil"), "session");
  assertEquals(requestArea("/en/app/seguridad"), "session");
  assertEquals(requestArea("/es/app/admin"), "admin");
  assertEquals(requestArea("/en/app/admin/usuarios"), "admin");
  assertEquals(requestArea("/api/admin/role"), "admin");
  assertEquals(requestArea("/api/auth/sign-in/email"), "public");
});

Deno.test("un user no pasa el guard y una passkey ajena tampoco abre la sesión", () => {
  assertEquals(gateDecision(undefined), "missing");
  assertEquals(gateDecision({ role: "user", sessionFactor: "totp" }), "forbidden");
  assertEquals(gateDecision({ role: "admin", sessionFactor: null }), "setup");
  assertEquals(gateDecision({ role: "admin", sessionFactor: "totp" }), "ok");
  assertEquals(gateDecision({ role: "admin", sessionFactor: "passkey" }), "ok");
  assertEquals(gateDecision({ role: "admin", sessionFactor: "backup" }), "ok");
});

Deno.test("la cookie de sesión se reconoce con y sin el prefijo Secure", () => {
  assert(cookieHasSession("enrailar.session_token=1"));
  assert(cookieHasSession("__Secure-enrailar.session_token=1"));
  assert(!cookieHasSession("enrailar.two_factor=1"));
  assert(!cookieHasSession(null));
});

Deno.test("el login con 2FA pendiente no se audita y el rol se anota una vez", () => {
  const base = { ok: true, pendingTwoFactor: false, hadSession: false, roleInBody: false };
  assertEquals(auditKind("/sign-in/email", 401), "auth.login_failed");
  assertEquals(auditAfter({ ...base, path: "/sign-in/email", pendingTwoFactor: true }), undefined);
  assertEquals(auditAfter({ ...base, path: "/sign-in/email" }), "auth.login");
  assertEquals(auditAfter({ ...base, path: "/two-factor/verify-totp", hadSession: false }), "auth.login");
  assertEquals(auditAfter({ ...base, path: "/two-factor/verify-totp", hadSession: true }), "auth.two_factor_on");
  assertEquals(auditAfter({ ...base, path: "/two-factor/disable", hadSession: true }), "auth.two_factor_off");
  assertEquals(auditAfter({ ...base, path: "/admin/set-role" }), "auth.role");
  assertEquals(auditAfter({ ...base, path: "/admin/update-user", roleInBody: true }), "auth.role");
  assertEquals(auditAfter({ ...base, path: "/admin/update-user" }), "auth.user_update");
  assertEquals(auditAfter({ ...base, path: "/admin/create-user" }), "auth.user_create");
  assertEquals(auditAfter({ ...base, path: "/admin/ban-user" }), "auth.ban");
  assertEquals(auditAfter({ ...base, path: "/admin/remove-user" }), "auth.remove");
});

Deno.test("nadie se cambia el rol ni degrada al último admin", () => {
  assert(!roleChangeAllowed({ actorId: "a", targetId: "a", nextRole: "user", targetRole: "admin", adminCount: 2 }));
  assert(!roleChangeAllowed({ actorId: "a", targetId: "b", nextRole: "user", targetRole: "admin", adminCount: 1 }));
  assert(roleChangeAllowed({ actorId: "a", targetId: "b", nextRole: "user", targetRole: "admin", adminCount: 2 }));
  assert(roleChangeAllowed({ actorId: "a", targetId: "b", nextRole: "admin", targetRole: "user", adminCount: 1 }));
});

Deno.test("una passkey nueva pide sesión fresca y 2FA", () => {
  assert(!passkeyRegistrationAllowed({ hasSession: true, fresh: true, twoFactorEnabled: false }));
  assert(!passkeyRegistrationAllowed({ hasSession: true, fresh: false, twoFactorEnabled: true }));
  assert(passkeyRegistrationAllowed({ hasSession: true, fresh: true, twoFactorEnabled: true }));
  assert(sessionIsFresh(new Date(now).toISOString(), now + 60_000, 600));
  assert(!sessionIsFresh(new Date(now).toISOString(), now + 11 * 60_000, 600));
});

Deno.test("el rol admin no puede impersonar ni poner contraseñas", () => {
  assert(adminMay("set-role"));
  assert(adminMay("ban"));
  assert(!adminMay("impersonate"));
  assert(!adminMay("impersonate-admins"));
  assert(!adminMay("set-password"));
});

Deno.test("IPv6 entra al límite por el prefijo /64", () => {
  const left = rateBucketIp("2001:db8:1:2:3:4:5:6");
  const right = rateBucketIp("2001:db8:1:2::9");
  assertEquals(left, right);
  assert(left.endsWith("::/64"));
  assert(rateBucketIp("2001:db8:1:3::1") !== left);
  assertEquals(rateBucketIp("203.0.113.8"), "203.0.113.8");
});

Deno.test("la auditoría anota el fallo de login sin pedir el correo", () => {
  const sql = Deno.readTextFileSync(new URL("../../api/migrations/0004_auth.sql", import.meta.url));
  assert(sql.includes('CREATE TABLE "user"'));
  const factor = Deno.readTextFileSync(new URL("../../api/migrations/0005_session_factor.sql", import.meta.url));
  assert(factor.includes('ADD COLUMN "authMethod"'));
  assert(!factor.toLowerCase().includes("drop"));
  assert(!sql.toLowerCase().includes("drop table"));
  assert(!sql.includes("preinscriptions"));
});

Deno.test("un script con espacio antes del cierre entra al hash", () => {
  assertEquals(inlineScriptHashes("<script>alert(1)</script >"), [cspScriptHash("alert(1)")]);
  assertEquals(inlineScriptHashes("<SCRIPT>alert(1)</SCRIPT\t>"), [cspScriptHash("alert(1)")]);
  assertEquals(inlineScriptHashes('<script src="/app.js"></script >'), []);
  assertEquals(inlineScriptHashes("<script>  </script >"), []);
});

Deno.test("la web manda CSP, HSTS y frame-ancestors", () => {
  const https = securityHeaders(true);
  const csp = https.find((header) => header[0] === "content-security-policy")?.[1] ?? "";
  const scriptSrc = csp.split(";").find((part) => part.trim().startsWith("script-src")) ?? "";
  assert(csp.includes("frame-ancestors 'none'"));
  assert(!scriptSrc.includes("unsafe-inline"));
  assert(scriptSrc.includes(sumateScriptHash()));
  assertEquals(sumateScriptHash(), cspScriptHash(sumateBootScript()));
  assertEquals(cspScriptHash("abc"), "'sha256-ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0='");
  assert(https.some((header) => header[0] === "strict-transport-security" && header[1].includes("max-age=")));
  assert(!securityHeaders(false).some((header) => header[0] === "strict-transport-security"));
});
