import { isJoinIntent, type JoinIntent } from "@enrailar/shared";
import { maskEmail } from "./sumate-memory.ts";
import type { AppDatabase } from "./request-db.ts";

export interface HomeData {
  intents: JoinIntent[];
}

export interface ProfileData {
  name: string;
  emailMask: string;
  role: string;
}

export interface AdminUserRow {
  id: string;
  emailMask: string;
  role: string;
  banned: boolean;
  twoFactor: boolean;
}

export interface AdminSubmissionRow {
  id: string;
  emailMask: string;
  locale: string;
  intents: string[];
  createdAt: string;
}

export interface AdminSubscriberRow {
  emailMask: string;
  status: string;
  locale: string;
  createdAt: string;
}

export interface AdminAuditRow {
  id: string;
  recordId: string;
  kind: string;
  createdAt: string;
}

export interface AdminData {
  users: AdminUserRow[];
  submissions: AdminSubmissionRow[];
  subscribers: AdminSubscriberRow[];
  audit: AdminAuditRow[];
}

function text(value: unknown, fallback = "—"): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function day(value: unknown): string {
  const raw = text(value, "");
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : "—";
}

function masked(value: unknown): string {
  if (typeof value !== "string") return "—";
  return maskEmail(value) ?? "—";
}

function on(value: unknown): boolean {
  return value === true || value === 1 || value === 1n;
}

function safeToken(value: unknown): string {
  if (typeof value !== "string" || value.includes("@")) return "—";
  if (!/^[A-Za-z0-9._:-]{1,80}$/.test(value)) return "—";
  return value;
}

function localeCell(value: unknown): string {
  return value === "en" || value === "es" ? value : "—";
}

async function rows<T>(db: AppDatabase, sql: string, ...values: unknown[]): Promise<T[]> {
  const result = await db.prepare(sql).bind(...values).all<T>();
  return Array.isArray(result.results) ? result.results : [];
}

export async function loadHome(db: AppDatabase, email: string): Promise<HomeData> {
  const found = await rows<{ intent: string }>(
    db,
    `SELECT DISTINCT i.intent AS intent
     FROM submissions s
     JOIN submission_intents i ON i.submission_id = s.id
     WHERE lower(s.email) = lower(?)`,
    email,
  );
  const intents: JoinIntent[] = [];
  for (const row of found) {
    if (isJoinIntent(row.intent) && !intents.includes(row.intent)) intents.push(row.intent);
  }
  return { intents };
}

export async function loadProfile(db: AppDatabase, userId: string): Promise<ProfileData | null> {
  const row = await db.prepare(
    'SELECT name, email, role FROM "user" WHERE id = ?',
  ).bind(userId).first<{ name: string; email: string; role: string | null }>();
  if (!row) return null;
  return {
    name: text(row.name, "cuenta"),
    emailMask: masked(row.email),
    role: row.role === "admin" ? "admin" : "user",
  };
}

export async function loadAdmin(db: AppDatabase): Promise<AdminData> {
  const users = await rows<{
    id: string;
    email: string;
    role: string | null;
    banned: number | null;
    twoFactorEnabled: number | null;
  }>(
    db,
    `SELECT id, email, role, banned, "twoFactorEnabled" AS twoFactorEnabled
     FROM "user" ORDER BY "createdAt" DESC LIMIT 100`,
  );
  const submissions = await rows<{ id: string; email: string; locale: string; created_at: string }>(
    db,
    "SELECT id, email, locale, created_at FROM submissions ORDER BY created_at DESC LIMIT 100",
  );
  const intents = await rows<{ submission_id: string; intent: string }>(
    db,
    "SELECT submission_id, intent FROM submission_intents",
  );
  const bySubmission = new Map<string, string[]>();
  for (const intent of intents) {
    if (!isJoinIntent(intent.intent)) continue;
    const list = bySubmission.get(intent.submission_id) ?? [];
    list.push(intent.intent);
    bySubmission.set(intent.submission_id, list);
  }
  const subscribers = await rows<{ email: string; status: string; locale: string; created_at: string }>(
    db,
    "SELECT email, status, locale, created_at FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 100",
  );
  const audit = await rows<{ id: number; record_id: string; kind: string; created_at: string }>(
    db,
    "SELECT id, record_id, kind, created_at FROM audit_events ORDER BY id DESC LIMIT 100",
  );
  return {
    users: users.map((row) => ({
      id: safeToken(row.id),
      emailMask: masked(row.email),
      role: row.role === "admin" ? "admin" : "user",
      banned: on(row.banned),
      twoFactor: on(row.twoFactorEnabled),
    })).filter((row) => row.id !== "—"),
    submissions: submissions.map((row) => ({
      id: safeToken(row.id),
      emailMask: masked(row.email),
      locale: localeCell(row.locale),
      intents: bySubmission.get(row.id) ?? [],
      createdAt: day(row.created_at),
    })).filter((row) => row.id !== "—"),
    subscribers: subscribers.map((row) => ({
      emailMask: masked(row.email),
      status: row.status === "pending" || row.status === "confirmed" || row.status === "unsubscribed" ? row.status : "—",
      locale: localeCell(row.locale),
      createdAt: day(row.created_at),
    })),
    audit: audit.map((row) => ({
      id: String(row.id),
      recordId: safeToken(row.record_id),
      kind: safeToken(row.kind),
      createdAt: day(row.created_at),
    })),
  };
}
