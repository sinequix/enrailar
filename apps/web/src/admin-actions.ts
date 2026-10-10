import { appendAudit, createAuth, type AuthEnv } from "./auth.ts";

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

export async function changeRole(request: Request, env: AuthEnv, userId: string, role: AssignableRole): Promise<boolean> {
  const auth = createAuth(env, new URL(request.url).origin);
  try {
    await auth.api.setRole({ body: { userId, role }, headers: request.headers });
  } catch {
    return false;
  }
  await appendAudit(env.DB, "auth.role", userId);
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
