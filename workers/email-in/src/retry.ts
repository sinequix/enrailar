import type { InboundContact } from "./contact.ts";

export interface SqlStatement {
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export interface SqlDatabase {
  prepare(statement: string): { bind(...values: unknown[]): SqlStatement };
}

export type RetryStore = {
  mark(contact: InboundContact): Promise<void>;
  forget(messageId: string): Promise<void>;
  bump(messageId: string): Promise<void>;
  pending(limit: number): Promise<InboundContact[]>;
};

type RetryRow = {
  message_id: string;
  sender: string;
  subject: string;
  body: string;
};

export function createRetryStore(
  db: SqlDatabase,
  now: () => string = () => new Date().toISOString(),
): RetryStore {
  return {
    async mark(contact) {
      await db.prepare(
        `INSERT INTO crm_email_retries (message_id, sender, subject, body, attempts, updated_at)
         VALUES (?, ?, ?, ?, 0, ?)
         ON CONFLICT(message_id) DO UPDATE SET
           sender = excluded.sender,
           subject = excluded.subject,
           body = excluded.body,
           updated_at = excluded.updated_at`,
      ).bind(contact.messageId, contact.sender, contact.subject, contact.body, now()).run();
    },
    async forget(messageId) {
      await db.prepare("DELETE FROM crm_email_retries WHERE message_id = ?").bind(messageId).run();
    },
    async bump(messageId) {
      await db.prepare(
        "UPDATE crm_email_retries SET attempts = attempts + 1, updated_at = ? WHERE message_id = ?",
      ).bind(now(), messageId).run();
    },
    async pending(limit) {
      const rows = await db.prepare(
        `SELECT message_id, sender, subject, body
         FROM crm_email_retries
         ORDER BY updated_at ASC
         LIMIT ?`,
      ).bind(limit).all<RetryRow>();
      return rows.results.map((row) => ({
        messageId: row.message_id,
        sender: row.sender,
        subject: row.subject,
        body: row.body,
      }));
    },
  };
}
