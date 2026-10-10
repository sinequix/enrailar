import type { AuthEnv } from "./auth.ts";

export interface BoundStatement {
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface AppDatabase {
  prepare(query: string): {
    bind(...values: unknown[]): BoundStatement;
  };
}

const DB = Symbol.for("enrailar.db");

type GlobalDb = typeof globalThis & { [DB]?: AppDatabase };

export function bindDb(db: AppDatabase): void {
  (globalThis as GlobalDb)[DB] = db;
}

export function readDb(): AppDatabase | null {
  const db = (globalThis as GlobalDb)[DB];
  if (db && typeof db.prepare === "function") return db;
  return null;
}

function processEnv(name: string): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const value = env?.[name];
  return typeof value === "string" ? value : "";
}

export function authEnvFromProcess(): AuthEnv {
  return {
    DB: readDb(),
    BETTER_AUTH_SECRET: processEnv("BETTER_AUTH_SECRET"),
    ADMIN_EMAILS: processEnv("ADMIN_EMAILS"),
    AUTH_PRODUCTION: processEnv("AUTH_PRODUCTION"),
  };
}

export function asDatabase(value: unknown): AppDatabase | null {
  if (!value || typeof value !== "object" || !("prepare" in value)) return null;
  if (typeof value.prepare !== "function") return null;
  return value as AppDatabase;
}
