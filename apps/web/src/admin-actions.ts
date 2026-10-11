import { createAuth, type AuthEnv } from "./auth.ts";
import { roleChangeAllowed } from "./auth-policy.ts";
import { asDatabase } from "./request-db.ts";

export type AssignableRole = "user" | "admin";

export function assignableRole(value: unknown): AssignableRole | null {
  if (value === "user" || value === "admin") return value;
  return null;
}

export function safeUserId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(value)) return null;
  return value;
}

function countOf(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  return 0;
}

export async function changeRole(request: Request, env: AuthEnv, userId: string, role: AssignableRole): Promise<boolean> {
  const db = asDatabase(env.DB);
  if (!db) return false;
  const auth = createAuth(env, new URL(request.url).origin);
  const session = await auth.api.getSession({ headers: request.headers });
  const actorId = session?.user && "id" in session.user && typeof session.user.id === "string" ? session.user.id : "";
  if (actorId.length === 0) return false;
  const row = await db.prepare(`SELECT role FROM "user" WHERE id = ?`).bind(userId).first<{ role: string | null }>();
  const count = await db.prepare(`SELECT COUNT(*) AS total FROM "user" WHERE role = 'admin'`).bind().first<{ total: number | bigint | null }>();
  if (!roleChangeAllowed({
    actorId,
    targetId: userId,
    nextRole: role,
    targetRole: typeof row?.role === "string" ? row.role : "",
    adminCount: countOf(count?.total),
  })) return false;
  try {
    await auth.api.setRole({ body: { userId, role }, headers: request.headers });
  } catch {
    return false;
  }
  return true;
}

export async function banUser(request: Request, env: AuthEnv, userId: string): Promise<boolean> {
  const auth = createAuth(env, new URL(request.url).origin);
  try {
    await auth.api.banUser({ body: { userId }, headers: request.headers });
  } catch {
    return false;
  }
  return true;
}
