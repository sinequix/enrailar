import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";
import {
  adminUserPermissions,
  auditAfter,
  passkeyRegistrationAllowed,
  roleChangeAllowed,
  roleForEmail,
  sessionFactorForPath,
  sessionIsFresh,
  type AuditEvent,
} from "./auth-policy.ts";

interface Sql {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
}

const promoteOnVerify = new WeakMap<object, true>();

function verified(value: unknown): boolean {
  return value === true || value === 1 || value === 1n;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function markAdminPromotion(ctx: object | null, patch: { emailVerified?: unknown }): void {
  if (!ctx || !verified(patch.emailVerified)) return;
  promoteOnVerify.set(ctx, true);
}

export function shouldPromoteAdmin(ctx: object | null): boolean {
  return ctx !== null && promoteOnVerify.has(ctx);
}

export async function promoteVerifiedAdmin(db: Sql, userId: string, email: string, admins: ReadonlySet<string>): Promise<boolean> {
  if (roleForEmail(email, admins) !== "admin") return false;
  await db.prepare(`UPDATE "user" SET role = 'admin' WHERE id = ?`).bind(userId).run();
  await db.prepare(`UPDATE "account" SET password = NULL WHERE "userId" = ? AND "providerId" = 'credential'`).bind(userId).run();
  await db.prepare(`DELETE FROM "session" WHERE "userId" = ?`).bind(userId).run();
  return true;
}

function recordId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.includes("@")) return "anonymous";
  return value;
}

function returnedOk(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (value instanceof Error) return false;
  if ("statusCode" in value && typeof value.statusCode === "number" && value.statusCode >= 400) return false;
  return true;
}

function roleInBody(body: unknown): boolean {
  if (!body || typeof body !== "object" || !("data" in body)) return false;
  const data = body.data;
  return !!data && typeof data === "object" && "role" in data;
}

function targetId(path: string, body: unknown, returned: unknown): string {
  if (body && typeof body === "object" && "userId" in body) return recordId(body.userId);
  if (path === "/admin/create-user" && returned && typeof returned === "object" && "user" in returned) {
    const user = returned.user;
    if (user && typeof user === "object" && "id" in user) return recordId(user.id);
  }
  return "anonymous";
}

async function storedRole(db: Sql, id: string): Promise<string> {
  const row = await db.prepare(`SELECT role FROM "user" WHERE id = ?`).bind(id).first<{ role: string | null }>();
  return typeof row?.role === "string" ? row.role : "";
}

async function adminCount(db: Sql): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS total FROM "user" WHERE role = 'admin'`).bind().first<{ total: number | bigint | null }>();
  if (typeof row?.total === "bigint") return Number(row.total);
  return typeof row?.total === "number" ? row.total : 0;
}

const access = createAccessControl(defaultStatements);
const userRole = access.newRole({ user: [], session: [] });
const adminRole = access.newRole({
  user: [...adminUserPermissions],
  session: ["list", "revoke", "delete"],
});

export const adminAccess = { ac: access, roles: { user: userRole, admin: adminRole } };

export function guardPlugin(db: Sql, audit: (kind: AuditEvent, recordId: string) => Promise<void>) {
  return {
    id: "enrailar-guard",
    hooks: {
      before: [{
        matcher: () => true,
        handler: createAuthMiddleware(async (ctx) => {
          const path = ctx.path;
          if (path === "/passkey/generate-register-options" || path === "/passkey/verify-registration") {
            const session = ctx.context.session ?? await getSessionFromCtx(ctx);
            const createdAt = session?.session?.createdAt;
            const fresh = createdAt ? sessionIsFresh(createdAt, Date.now(), ctx.context.sessionConfig.freshAge) : false;
            const allowed = passkeyRegistrationAllowed({
              hasSession: !!session?.user,
              fresh,
              twoFactorEnabled: verified(session?.user?.twoFactorEnabled),
            });
            if (!session?.user) throw APIError.from("UNAUTHORIZED", { message: "sesión requerida", code: "UNAUTHORIZED" });
            if (!allowed) throw APIError.from("FORBIDDEN", { message: "hace falta una sesión fresca con 2FA", code: "FORBIDDEN" });
          }
          if (path !== "/admin/set-role" && path !== "/admin/update-user") return;
          const session = ctx.context.session ?? await getSessionFromCtx(ctx);
          const actorId = text(session?.user?.id);
          const body = ctx.body;
          const next = path === "/admin/set-role"
            ? text(body && typeof body === "object" && "role" in body ? body.role : "")
            : text(body && typeof body === "object" && "data" in body && body.data && typeof body.data === "object" && "role" in body.data ? body.data.role : "");
          if (next.length === 0 || actorId.length === 0) return;
          const userId = text(body && typeof body === "object" && "userId" in body ? body.userId : "");
          if (userId.length === 0) return;
          const targetRole = await storedRole(db, userId);
          const admins = await adminCount(db);
          if (!roleChangeAllowed({ actorId, targetId: userId, nextRole: next, targetRole, adminCount: admins })) {
            throw APIError.from("FORBIDDEN", { message: "ese cambio de rol no está permitido", code: "FORBIDDEN" });
          }
        }),
      }],
      after: [{
        matcher: () => true,
        handler: createAuthMiddleware(async (ctx) => {
          const path = ctx.path ?? "";
          const returned = ctx.context.returned;
          const factor = sessionFactorForPath(path);
          const token = ctx.context.newSession?.session?.token;
          if (factor && typeof token === "string" && token.length > 0 && returnedOk(returned)) {
            await ctx.context.internalAdapter.updateSession(token, { authMethod: factor });
          }
          const event = auditAfter({
            path,
            ok: returnedOk(returned),
            pendingTwoFactor: !!returned && typeof returned === "object" && "twoFactorRedirect" in returned && returned.twoFactorRedirect === true,
            hadSession: !!ctx.context.session?.user,
            roleInBody: roleInBody(ctx.body),
          });
          if (!event) return;
          const id = event === "auth.login" || event === "auth.two_factor_on" || event === "auth.two_factor_off"
            ? recordId(ctx.context.newSession?.user?.id ?? ctx.context.session?.user?.id)
            : targetId(path, ctx.body, returned);
          await audit(event, id);
        }),
      }],
    },
  };
}
