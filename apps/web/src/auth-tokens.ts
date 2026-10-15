import { AUTH_LINK_TTL_SECONDS } from "@enrailar/shared";

const TOKEN_PATTERN = /^[A-Za-z0-9._~%=-]{8,2000}$/;

export interface TokenDatabase {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
}

async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function identifier(hash: string): string {
  return `auth-verify:${hash}`;
}

export async function storeVerifyToken(db: TokenDatabase, token: string, now = new Date()): Promise<void> {
  if (!TOKEN_PATTERN.test(token)) throw new Error("no se pudo guardar el enlace");
  const hash = await tokenHash(token);
  const stamp = now.toISOString();
  const expires = new Date(now.getTime() + AUTH_LINK_TTL_SECONDS * 1000).toISOString();
  const id = identifier(hash);
  await db.prepare(
    `INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       identifier = excluded.identifier,
       value = excluded.value,
       expiresAt = excluded.expiresAt,
       updatedAt = excluded.updatedAt`,
  ).bind(id, id, "pending", expires, stamp, stamp).run();
}

/** Borra la fila y la acepta solo si todavía no venció. Un segundo uso no encuentra nada. */
export async function consumeVerifyToken(db: TokenDatabase, token: string, now = new Date()): Promise<boolean> {
  if (!TOKEN_PATTERN.test(token)) return false;
  const row = await db.prepare(
    "DELETE FROM verification WHERE identifier = ? RETURNING expiresAt",
  ).bind(identifier(await tokenHash(token))).first<{ expiresAt: string }>();
  if (!row) return false;
  const expires = Date.parse(String(row.expiresAt));
  return Number.isFinite(expires) && expires > now.getTime();
}
