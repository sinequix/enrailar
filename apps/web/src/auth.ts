import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins/admin";
import { twoFactor } from "better-auth/plugins/two-factor";
import type { MailJob } from "@enrailar/shared";
import { adminAccess, guardPlugin, markAdminPromotion, promoteVerifiedAdmin, shouldPromoteAdmin } from "./auth-hooks.ts";
import { isConsentAt, parseAdminEmails, rpIdFor } from "./auth-policy.ts";

export interface AuthDatabase {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
    };
  };
}

export interface AuthMailQueue {
  send(body: MailJob): Promise<void>;
}

export interface AuthEnv {
  DB: unknown;
  BETTER_AUTH_SECRET?: string;
  ADMIN_EMAILS?: string;
  AUTH_PRODUCTION?: string;
  MAIL_QUEUE?: AuthMailQueue;
}

function localeOf(user: object): "es" | "en" {
  if ("locale" in user && user.locale === "en") return "en";
  return "es";
}

function verifiedFlag(value: unknown): boolean {
  return value === true || value === 1 || value === 1n;
}

function displayName(name: unknown): string {
  if (typeof name === "string") {
    const trimmed = name.trim();
    if (trimmed.length > 0) return trimmed.slice(0, 80);
  }
  return "cuenta";
}

export function createAuth(env: AuthEnv, origin: string) {
  const url = new URL(origin);
  const secret = env.BETTER_AUTH_SECRET ?? "";
  const admins = parseAdminEmails(env.ADMIN_EMAILS);
  const secure = url.protocol === "https:";
  const queue = env.MAIL_QUEUE;

  async function enqueue(job: MailJob): Promise<void> {
    if (!queue) return;
    await queue.send(job);
  }

  return betterAuth({
    appName: "Enrailar",
    baseURL: origin,
    basePath: "/api/auth",
    secret,
    trustedOrigins: [origin],
    database: env.DB as never,
    telemetry: { enabled: false },
    rateLimit: {
      enabled: true,
      window: 600,
      max: 5,
      customRules: {
        "/sign-in/email": { window: 600, max: 5 },
        "/sign-up/email": { window: 600, max: 5 },
        "/request-password-reset": { window: 600, max: 5 },
        "/forget-password": { window: 600, max: 5 },
        "/send-verification-email": { window: 600, max: 5 },
        "/reset-password": { window: 600, max: 5 },
        "/change-password": { window: 600, max: 5 },
        "/sign-in/passkey": { window: 600, max: 5 },
        "/two-factor/*": { window: 600, max: 5 },
        "/email-otp/*": { window: 600, max: 5 },
        "/passkey/*": { window: 600, max: 5 },
      },
    },
    user: {
      additionalFields: {
        consentAt: { type: "string", required: true, input: true },
        locale: { type: "string", required: false, defaultValue: "es", input: true },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => {
        const locale = localeOf(user);
        await enqueue({
          kind: "auth.reset",
          to: user.email,
          locale,
          path: `/${locale}/cuenta/recuperar?token=${encodeURIComponent(token)}`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, token }) => {
        const locale = localeOf(user);
        await enqueue({
          kind: "auth.verify",
          to: user.email,
          locale,
          path: `/${locale}/cuenta/verificar?token=${encodeURIComponent(token)}`,
        });
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      freshAge: 60 * 10,
      additionalFields: {
        authMethod: { type: "string", required: false, input: false },
      },
    },
    advanced: {
      useSecureCookies: secure,
      disableCSRFCheck: false,
      cookiePrefix: "enrailar",
      defaultCookieAttributes: {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
      },
      ipAddress: { disableIpTracking: true },
    },
    databaseHooks: {
      user: {
        create: {
          before: (user, ctx) => {
            const consentAt = typeof user.consentAt === "string" ? user.consentAt : "";
            if (!isConsentAt(consentAt)) return Promise.resolve(false);
            const path = ctx && typeof ctx === "object" && "path" in ctx && typeof ctx.path === "string" ? ctx.path : "";
            const requested = typeof user.role === "string" ? user.role : "user";
            return Promise.resolve({
              data: {
                ...user,
                name: displayName(user.name),
                role: path === "/admin/create-user" ? requested : "user",
                consentAt,
              },
            });
          },
        },
        update: {
          before: (data, ctx) => {
            markAdminPromotion(ctx && typeof ctx === "object" ? ctx : null, data);
            return Promise.resolve({ data });
          },
          after: async (user, ctx) => {
            const endpoint = ctx && typeof ctx === "object" ? ctx : null;
            if (endpoint && !shouldPromoteAdmin(endpoint)) return;
            const emailVerified = verifiedFlag(user.emailVerified);
            const role = typeof user.role === "string" ? user.role : "user";
            const id = typeof user.id === "string" ? user.id : "";
            const email = typeof user.email === "string" ? user.email : "";
            if (!emailVerified || role === "admin" || id.length === 0) return;
            await promoteVerifiedAdmin(env.DB as never, id, email, admins);
          },
        },
      },
    },
    plugins: [
      twoFactor({ issuer: "Enrailar" }),
      passkey({ rpID: rpIdFor(url.hostname), rpName: "Enrailar", origin }),
      admin({ defaultRole: "user", adminRoles: ["admin"], ac: adminAccess.ac, roles: adminAccess.roles }),
      guardPlugin(env.DB as never, (kind, recordId) => appendAudit(env.DB, kind, recordId)),
    ],
  });
}

export async function appendAudit(database: unknown, kind: string, recordId: string): Promise<void> {
  const db = database as AuthDatabase;
  try {
    await db.prepare(
      "INSERT INTO audit_events (record_id, kind, created_at) VALUES (?, ?, ?)",
    ).bind(recordId, kind, new Date().toISOString()).run();
  } catch {
    console.log(JSON.stringify({ status: "audit-failed" }));
  }
}
