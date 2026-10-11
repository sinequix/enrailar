import { assignableRole, changeRole, safeUserId } from "../../../../src/admin-actions.ts";
import { requireAdminAccess } from "../../../../src/app-guard.ts";
import { authEnvFromProcess } from "../../../../src/request-db.ts";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return new Response("Forbidden", { status: 403 });
  }
  const env = authEnvFromProcess();
  const denied = await requireAdminAccess(request, env);
  if (denied) return denied;
  const body: unknown = await request.json().catch(() => null);
  const record = body && typeof body === "object" ? body : {};
  const userId = safeUserId("userId" in record ? record.userId : null);
  const role = assignableRole("role" in record ? record.role : null);
  if (!userId || !role) return Response.json({ ok: false }, { status: 400 });
  const ok = await changeRole(request, env, userId, role);
  return Response.json({ ok }, { status: ok ? 200 : 400 });
}
