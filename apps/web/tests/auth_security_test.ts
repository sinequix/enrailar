import { assert, assertEquals } from "@std/assert";
import { DatabaseSync } from "node:sqlite";
import { changeRole } from "../src/admin-actions.ts";
import { guardRequest, requireAdminAccess } from "../src/app-guard.ts";
import { createAuth, type AuthEnv } from "../src/auth.ts";
import { consumeRateLimit, handleAuth, rateLimitSql } from "../src/auth-http.ts";
import { createMemoryDatabase } from "../dev/memory-db.ts";
import type { MailJob } from "@enrailar/shared";

const host = ["example", "test"].join(".");
const adminEmail = ["mesa", host].join("@");
const userEmail = ["cuenta", host].join("@");
const otherEmail = ["visita", host].join("@");
const password = "correct-horse-battery";
const origin = "http://localhost:9";
const turnstile = "1x0000000000000000000000000000000AA";
const tokenHeader = "XXXX.DUMMY.TOKEN.XXXX";

function openDb() {
  const sqlite = new DatabaseSync(":memory:");
  const dir = new URL("../../api/migrations/", import.meta.url);
  const names = [...Deno.readDirSync(dir)].map((entry) => entry.name).filter((name) => name.endsWith(".sql")).sort();
  sqlite.exec(names.map((name) => Deno.readTextFileSync(new URL(name, dir))).join("\n"));
  const db = createMemoryDatabase(sqlite);
  const jobs: MailJob[] = [];
  const env: AuthEnv & { TURNSTILE_SECRET_KEY: string } = {
    DB: db,
    BETTER_AUTH_SECRET: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
    ADMIN_EMAILS: adminEmail,
    AUTH_PRODUCTION: "0",
    TURNSTILE_SECRET_KEY: turnstile,
    MAIL_QUEUE: {
      send(body) {
        jobs.push(body);
        return Promise.resolve();
      },
    },
  };
  return { sqlite, db, env, jobs };
}

function call(db: ReturnType<typeof openDb>["db"], env: AuthEnv & { TURNSTILE_SECRET_KEY?: string }, path: string, body: unknown, cookie = "", method = "POST"): Promise<Response> {
  const headers = new Headers({ origin });
  if (path === "/sign-up/email" || path === "/request-password-reset" || path === "/send-verification-email") {
    headers.set("x-turnstile-token", tokenHeader);
  }
  if (cookie) headers.set("cookie", cookie);
  if (method !== "GET") headers.set("content-type", "application/json");
  return handleAuth(new Request(`${origin}/api/auth${path}`, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(body),
  }), env, db);
}

function forbiddenStatus(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("status" in error && (error.status === "FORBIDDEN" || error.status === 403)) return true;
  if ("statusCode" in error && error.statusCode === 403) return true;
  return false;
}

function mailToken(jobs: MailJob[]): string {
  const job = jobs.at(-1);
  if (!job || job.kind === "newsletter.confirm") throw new Error("sin correo");
  return new URL(job.path, origin).searchParams.get("token") ?? "";
}

function cookieJar(response: Response, previous = ""): string {
  const map = new Map<string, string>();
  for (const part of previous.split(";").map((item) => item.trim()).filter(Boolean)) {
    const eq = part.indexOf("=");
    if (eq > 0) map.set(part.slice(0, eq), part.slice(eq + 1));
  }
  for (const raw of response.headers.getSetCookie()) {
    const pair = raw.split(";")[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq > 0) map.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  return [...map.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function codeFor(secret: string): Promise<string> {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = secret.toUpperCase().replace(/=+$/g, "");
  let bits = "";
  for (const char of clean) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes = (bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2));
  const raw = new Uint8Array(bytes);
  const counter = Math.floor(Date.now() / 30000);
  const msg = new ArrayBuffer(8);
  new DataView(msg).setBigUint64(0, BigInt(counter));
  const cryptoKey = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, msg));
  const offset = digest[digest.length - 1]! & 0xf;
  const binary = ((digest[offset]! & 0x7f) << 24) | (digest[offset + 1]! << 16) | (digest[offset + 2]! << 8) | digest[offset + 3]!;
  return String(binary % 1_000_000).padStart(6, "0");
}

async function signup(db: ReturnType<typeof openDb>["db"], env: AuthEnv & { TURNSTILE_SECRET_KEY?: string }, email: string): Promise<void> {
  const response = await call(db, env, "/sign-up/email", {
    email,
    password,
    name: "cuenta",
    consentAt: new Date().toISOString(),
    locale: "es",
  });
  assertEquals(response.status, 200, await response.clone().text());
}

Deno.test("el plugin admin no se expone y no puede impersonar ni cambiar contraseñas", async () => {
  const { sqlite, db, env } = openDb();
  try {
    for (const path of ["/admin/set-role", "/admin/impersonate-user", "/admin/set-user-password"]) {
      const response = await call(db, env, path, { userId: "abcdefgh", role: "admin", newPassword: password });
      assertEquals(response.status, 403, path);
    }
    await signup(db, env, userEmail);
    const auth = createAuth(env, origin);
    const headers = new Headers({ origin });
    let failed = false;
    try {
      await auth.api.setUserPassword({ body: { userId: "abcdefgh", newPassword: password }, headers });
    } catch {
      failed = true;
    }
    assert(failed);
    failed = false;
    try {
      await auth.api.impersonateUser({ body: { userId: "abcdefgh" }, headers });
    } catch {
      failed = true;
    }
    assert(failed);
  } finally {
    sqlite.close();
  }
});

Deno.test("un alta previa con un correo de admin no conserva esa contraseña", async () => {
  const { sqlite, db, env, jobs } = openDb();
  try {
    await signup(db, env, adminEmail);
    const created = await db.prepare(`SELECT role FROM "user" WHERE email = ?`).bind(adminEmail).first<{ role: string }>();
    const before = await db.prepare(`SELECT password FROM "account" WHERE "providerId" = 'credential'`).bind().first<{ password: string | null }>();
    assertEquals(created?.role, "user");
    assert(typeof before?.password === "string" && before.password.length > 0);
    const verify = await handleAuth(new Request(`${origin}/api/auth/verify-email?token=${encodeURIComponent(mailToken(jobs))}`, {
      headers: { origin },
    }), env, db);
    assertEquals(verify.status, 200, await verify.clone().text());
    const after = await db.prepare(`SELECT u.role AS role, a.password AS password FROM "user" u JOIN "account" a ON a."userId" = u.id WHERE u.email = ?`).bind(adminEmail).first<{ role: string; password: string | null }>();
    const sessions = await db.prepare(`SELECT COUNT(*) AS total FROM "session"`).bind().first<{ total: number }>();
    assertEquals(after?.role, "admin");
    assertEquals(after?.password, null);
    assertEquals(Number(sessions?.total ?? 0), 0);
    const signin = await call(db, env, "/sign-in/email", { email: adminEmail, password });
    assertEquals(signin.status, 401);
  } finally {
    sqlite.close();
  }
});

Deno.test("registrar una passkey sin 2FA o con sesión vieja responde 403", async () => {
  const { sqlite, db, env, jobs } = openDb();
  try {
    await signup(db, env, userEmail);
    const verify = await handleAuth(new Request(`${origin}/api/auth/verify-email?token=${encodeURIComponent(mailToken(jobs))}`, {
      headers: { origin },
    }), env, db);
    assertEquals(verify.status, 200);
    const signin = await call(db, env, "/sign-in/email", { email: userEmail, password });
    assertEquals(signin.status, 200);
    let jar = cookieJar(signin);
    const blocked = await call(db, env, "/passkey/generate-register-options", undefined, jar, "GET");
    assertEquals(blocked.status, 403);
    const enable = await call(db, env, "/two-factor/enable", { password }, jar);
    assertEquals(enable.status, 200, await enable.clone().text());
    jar = cookieJar(enable, jar);
    const payload = await enable.json() as { totpURI: string };
    const secret = new URL(payload.totpURI).searchParams.get("secret") ?? "";
    const confirmed = await call(db, env, "/two-factor/verify-totp", { code: await codeFor(secret) }, jar);
    assertEquals(confirmed.status, 200, await confirmed.clone().text());
    jar = cookieJar(confirmed, jar);
    const allowed = await call(db, env, "/passkey/generate-register-options", undefined, jar, "GET");
    assertEquals(allowed.status, 200, await allowed.clone().text());
    const stale = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await db.prepare(`UPDATE "session" SET "createdAt" = ?`).bind(stale).run();
    const expired = await call(db, env, "/passkey/generate-register-options", undefined, jar, "GET");
    assertEquals(expired.status, 403);
  } finally {
    sqlite.close();
  }
});

Deno.test("el límite de D1 es atómico y la sexta vez corta", async () => {
  const { sqlite, db } = openDb();
  try {
    assert(rateLimitSql.includes("ON CONFLICT"));
    assert(rateLimitSql.includes("RETURNING"));
    assert(!rateLimitSql.includes("SELECT hits"));
    const now = new Date().toISOString();
    for (let i = 0; i < 5; i++) assert(await consumeRateLimit(db, "auth:/sign-in/email:203.0.113.8", now));
    assertEquals(await consumeRateLimit(db, "auth:/sign-in/email:203.0.113.8", now), false);
    const old = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    await db.prepare(`UPDATE rate_limits SET hits = 5, window_start = ? WHERE bucket = ?`).bind(old, "auth:/sign-in/email:203.0.113.8").run();
    assertEquals(await consumeRateLimit(db, "auth:/sign-in/email:203.0.113.8", new Date().toISOString()), true);
  } finally {
    sqlite.close();
  }
});

Deno.test("/api/admin exige decideAccess y no el área del path", async () => {
  const env = { DB: null, BETTER_AUTH_SECRET: "", ADMIN_EMAILS: "", AUTH_PRODUCTION: "0" };
  const request = new Request("http://localhost/es");
  assertEquals(await guardRequest(request, env), null);
  assertEquals((await requireAdminAccess(request, env))?.status, 403);
});

Deno.test("no hay cambio de rol propio, ni del último admin, y se audita una vez", async () => {
  const { sqlite, db, env, jobs } = openDb();
  try {
    await signup(db, env, adminEmail);
    const verify = await handleAuth(new Request(`${origin}/api/auth/verify-email?token=${encodeURIComponent(mailToken(jobs))}`, { headers: { origin } }), env, db);
    assertEquals(verify.status, 200);
    jobs.length = 0;
    const resetRequest = await call(db, env, "/request-password-reset", { email: adminEmail, redirectTo: `${origin}/es/cuenta/recuperar` });
    assertEquals(resetRequest.status, 200, await resetRequest.clone().text());
    const reset = await call(db, env, "/reset-password", { newPassword: password, token: mailToken(jobs) });
    assertEquals(reset.status, 200, await reset.clone().text());
    const signin = await call(db, env, "/sign-in/email", { email: adminEmail, password });
    assertEquals(signin.status, 200, await signin.clone().text());
    const jar = cookieJar(signin);
    const actor = await db.prepare(`SELECT id FROM "user" WHERE email = ?`).bind(adminEmail).first<{ id: string }>();
    await signup(db, env, otherEmail);
    const other = await db.prepare(`SELECT id FROM "user" WHERE email = ?`).bind(otherEmail).first<{ id: string }>();
    await db.prepare(`UPDATE "user" SET role = 'admin', "emailVerified" = 1 WHERE id = ?`).bind(other?.id).run();
    const headers = new Headers({ origin, cookie: jar });
    const request = new Request(`${origin}/api/admin/role`, { headers });
    const auth = createAuth(env, origin);
    let denied = 0;
    try {
      await auth.api.setUserPassword({ body: { userId: other?.id ?? "", newPassword: password }, headers });
    } catch (error) {
      if (forbiddenStatus(error)) denied += 1;
    }
    try {
      await auth.api.impersonateUser({ body: { userId: other?.id ?? "" }, headers });
    } catch (error) {
      if (forbiddenStatus(error)) denied += 1;
    }
    assertEquals(denied, 2);
    assertEquals(await changeRole(request, env, actor?.id ?? "", "user"), false);
    assert(await changeRole(request, env, other?.id ?? "", "user"));
    const roles = await db.prepare(`SELECT COUNT(*) AS total FROM audit_events WHERE kind = 'auth.role'`).bind().first<{ total: number }>();
    assertEquals(Number(roles?.total ?? 0), 1);
    const only = await db.prepare(`SELECT COUNT(*) AS total FROM "user" WHERE role = 'admin'`).bind().first<{ total: number }>();
    assertEquals(Number(only?.total ?? 0), 1);
    assertEquals(await changeRole(request, env, actor?.id ?? "", "user"), false);
    let hookBlocked = false;
    try {
      await auth.api.setRole({ body: { userId: actor?.id ?? "", role: "user" }, headers });
    } catch (error) {
      hookBlocked = forbiddenStatus(error);
    }
    assert(hookBlocked);
    const still = await db.prepare(`SELECT role FROM "user" WHERE id = ?`).bind(actor?.id).first<{ role: string }>();
    assertEquals(still?.role, "admin");
  } finally {
    sqlite.close();
  }
});

Deno.test("el login con 2FA pendiente no deja auth.login y el reset revoca sesiones", async () => {
  const { sqlite, db, env, jobs } = openDb();
  try {
    await signup(db, env, userEmail);
    const verify = await handleAuth(new Request(`${origin}/api/auth/verify-email?token=${encodeURIComponent(mailToken(jobs))}`, { headers: { origin } }), env, db);
    assertEquals(verify.status, 200);
    const signin = await call(db, env, "/sign-in/email", { email: userEmail, password });
    assertEquals(signin.status, 200);
    let jar = cookieJar(signin);
    const enable = await call(db, env, "/two-factor/enable", { password }, jar);
    assertEquals(enable.status, 200);
    jar = cookieJar(enable, jar);
    const payload = await enable.json() as { totpURI: string };
    const secret = new URL(payload.totpURI).searchParams.get("secret") ?? "";
    const confirmed = await call(db, env, "/two-factor/verify-totp", { code: await codeFor(secret) }, jar);
    assertEquals(confirmed.status, 200);
    const before = await db.prepare(`SELECT COUNT(*) AS total FROM audit_events WHERE kind = 'auth.login'`).bind().first<{ total: number }>();
    const pending = await call(db, env, "/sign-in/email", { email: userEmail, password });
    const body = await pending.json() as { twoFactorRedirect?: boolean };
    assertEquals(body.twoFactorRedirect, true);
    const during = await db.prepare(`SELECT COUNT(*) AS total FROM audit_events WHERE kind = 'auth.login'`).bind().first<{ total: number }>();
    assertEquals(Number(during?.total ?? 0), Number(before?.total ?? 0));
    jobs.length = 0;
    const sessions = await db.prepare(`SELECT COUNT(*) AS total FROM "session"`).bind().first<{ total: number }>();
    assert(Number(sessions?.total ?? 0) > 0);
    const resetRequest = await call(db, env, "/request-password-reset", { email: userEmail, redirectTo: `${origin}/es/cuenta/recuperar` });
    assertEquals(resetRequest.status, 200);
    const reset = await call(db, env, "/reset-password", { newPassword: password, token: mailToken(jobs) });
    assertEquals(reset.status, 200);
    const left = await db.prepare(`SELECT COUNT(*) AS total FROM "session"`).bind().first<{ total: number }>();
    assertEquals(Number(left?.total ?? 0), 0);
  } finally {
    sqlite.close();
  }
});

Deno.test("ban, alta y edición de admin quedan en la auditoría", async () => {
  const { sqlite, db, env, jobs } = openDb();
  try {
    await signup(db, env, adminEmail);
    const verify = await handleAuth(new Request(`${origin}/api/auth/verify-email?token=${encodeURIComponent(mailToken(jobs))}`, { headers: { origin } }), env, db);
    assertEquals(verify.status, 200);
    jobs.length = 0;
    assertEquals((await call(db, env, "/request-password-reset", { email: adminEmail, redirectTo: `${origin}/es` })).status, 200);
    assertEquals((await call(db, env, "/reset-password", { newPassword: password, token: mailToken(jobs) })).status, 200);
    const signin = await call(db, env, "/sign-in/email", { email: adminEmail, password });
    assertEquals(signin.status, 200);
    const jar = cookieJar(signin);
    const headers = new Headers({ origin, cookie: jar });
    const auth = createAuth(env, origin);
    const created = await auth.api.createUser({
      body: {
        email: otherEmail,
        password,
        name: "cuenta",
        role: "user",
        data: { consentAt: new Date().toISOString(), locale: "es" },
      },
      headers,
    });
    const createdId = created && typeof created === "object" && "user" in created && created.user && typeof created.user === "object" && "id" in created.user
      ? String(created.user.id)
      : "";
    assert(createdId.length > 0);
    await auth.api.adminUpdateUser({ body: { userId: createdId, data: { name: "cuenta" } }, headers });
    await auth.api.banUser({ body: { userId: createdId }, headers });
    await auth.api.removeUser({ body: { userId: createdId }, headers });
    const count = async (kind: string): Promise<number> => {
      const row = await db.prepare(`SELECT COUNT(*) AS total FROM audit_events WHERE kind = ?`).bind(kind).first<{ total: number }>();
      return Number(row?.total ?? 0);
    };
    assertEquals(await count("auth.user_create"), 1);
    assertEquals(await count("auth.user_update"), 1);
    assertEquals(await count("auth.ban"), 1);
    assertEquals(await count("auth.remove"), 1);
  } finally {
    sqlite.close();
  }
});

Deno.test("prod no pone el secreto en el job y CI no baja Chrome sin pin", () => {
  const prod = Deno.readTextFileSync(new URL("../../../.github/workflows/prod.yml", import.meta.url));
  const job = prod.split("steps:")[0] ?? "";
  assert(!job.includes("BETTER_AUTH_SECRET"));
  const deploy = prod.slice(prod.indexOf("name: Deploy prod"));
  assert(deploy.includes("BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET }}"));
  assert(deploy.includes("require-secrets.sh"));
  assertEquals(prod.indexOf("BETTER_AUTH_SECRET"), prod.indexOf("name: Deploy prod") < prod.indexOf("BETTER_AUTH_SECRET") ? prod.indexOf("BETTER_AUTH_SECRET") : -1);
  const ci = Deno.readTextFileSync(new URL("../../../.github/workflows/ci.yml", import.meta.url));
  assert(!ci.includes("google-chrome-stable"));
  assert(!ci.includes("dl.google.com"));
  assert(ci.includes("playwright-core install chromium"));
});
