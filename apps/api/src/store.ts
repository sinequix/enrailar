export interface AuditEvent {
  recordId: string;
  kind:
    | "preinscription.accepted"
    | "contact.accepted"
    | "newsletter.pending"
    | "newsletter.confirmed"
    | "newsletter.unsubscribed"
    | "form.rejected";
  createdAt: string;
}

export interface PreinscriptionRow {
  id: string;
  email: string;
  linkedin: string | undefined;
  message: string;
  locale: "es" | "en";
  consentAt: string;
  createdAt: string;
}

export interface ContactRow extends PreinscriptionRow {
  intent: "colaborar" | "donar" | "sumarme";
}

export interface NewsletterPending {
  id: string;
  email: string;
  locale: "es" | "en";
  confirmTokenHash: string;
  unsubscribeTokenHash: string;
  consentAt: string;
  createdAt: string;
}

export interface Store {
  insertPreinscription(row: PreinscriptionRow): Promise<void>;
  insertContact(row: ContactRow): Promise<void>;
  saveNewsletterPending(row: NewsletterPending): Promise<string>;
  confirmNewsletter(tokenHash: string, at: string): Promise<string | undefined>;
  unsubscribeNewsletter(tokenHash: string, at: string): Promise<string | undefined>;
  appendAudit(event: AuditEvent): Promise<void>;
  allow(bucket: string, now: string, windowMs: number, limit: number): Promise<boolean>;
}

export interface RateRow {
  hits: number;
  windowStart: string;
}

export function rateDecision(
  current: RateRow | undefined,
  now: string,
  windowMs: number,
  limit: number,
): { allowed: boolean; next: RateRow } {
  const started = current === undefined ? Number.NaN : Date.parse(current.windowStart);
  const expired = current === undefined || !Number.isFinite(started) || Date.parse(now) - started >= windowMs;
  if (expired) return { allowed: true, next: { hits: 1, windowStart: now } };
  if (current.hits >= limit) return { allowed: false, next: current };
  return { allowed: true, next: { hits: current.hits + 1, windowStart: current.windowStart } };
}

export function createMemoryStore(): Store {
  const preinscriptions: PreinscriptionRow[] = [];
  const contacts: ContactRow[] = [];
  const newsletter = new Map<string, NewsletterPending & { status: string; confirmedAt?: string; unsubscribedAt?: string }>();
  const audit: AuditEvent[] = [];
  const rates = new Map<string, RateRow>();

  return {
    insertPreinscription(row) {
      preinscriptions.push(row);
      return Promise.resolve();
    },
    insertContact(row) {
      contacts.push(row);
      return Promise.resolve();
    },
    saveNewsletterPending(row) {
      const existing = newsletter.get(row.email);
      const id = existing?.id ?? row.id;
      newsletter.set(row.email, { ...row, id, status: "pending" });
      return Promise.resolve(id);
    },
    confirmNewsletter(tokenHash, at) {
      for (const row of newsletter.values()) {
        if (row.confirmTokenHash !== tokenHash) continue;
        row.status = "confirmed";
        row.confirmedAt = at;
        return Promise.resolve(row.id);
      }
      return Promise.resolve(undefined);
    },
    unsubscribeNewsletter(tokenHash, at) {
      for (const row of newsletter.values()) {
        if (row.unsubscribeTokenHash !== tokenHash) continue;
        row.status = "unsubscribed";
        row.unsubscribedAt = at;
        return Promise.resolve(row.id);
      }
      return Promise.resolve(undefined);
    },
    appendAudit(event) {
      audit.push(event);
      return Promise.resolve();
    },
    allow(bucket, now, windowMs, limit) {
      const decision = rateDecision(rates.get(bucket), now, windowMs, limit);
      rates.set(bucket, decision.next);
      return Promise.resolve(decision.allowed);
    },
  };
}

export interface Prepared {
  bind(...values: unknown[]): {
    all<T>(): Promise<{ results?: T[] }>;
    first<T>(): Promise<T | null>;
    run(): Promise<unknown>;
  };
}

export interface SqlDatabase {
  prepare(sql: string): Prepared;
}

export interface QueueLike {
  send(body: unknown): Promise<void>;
}

export function createD1Store(database: SqlDatabase): Store {
  return {
    async insertPreinscription(row) {
      await database.prepare(
        `INSERT INTO preinscriptions (id, email, linkedin, message, locale, consent_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(row.id, row.email, row.linkedin ?? null, row.message, row.locale, row.consentAt, row.createdAt).run();
    },
    async insertContact(row) {
      await database.prepare(
        `INSERT INTO contacts (id, intent, email, linkedin, message, locale, consent_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(row.id, row.intent, row.email, row.linkedin ?? null, row.message, row.locale, row.consentAt, row.createdAt).run();
    },
    async saveNewsletterPending(row) {
      await database.prepare(
        `INSERT INTO newsletter_subscribers
           (id, email, locale, status, confirm_token_hash, unsubscribe_token_hash, consent_at, confirmed_at, unsubscribed_at, created_at)
         VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NULL, ?)
         ON CONFLICT(email) DO UPDATE SET
           locale = excluded.locale,
           status = 'pending',
           confirm_token_hash = excluded.confirm_token_hash,
           unsubscribe_token_hash = excluded.unsubscribe_token_hash,
           consent_at = excluded.consent_at,
           confirmed_at = NULL,
           unsubscribed_at = NULL`,
      ).bind(
        row.id,
        row.email,
        row.locale,
        row.confirmTokenHash,
        row.unsubscribeTokenHash,
        row.consentAt,
        row.createdAt,
      ).run();
      const saved = await database.prepare(
        `SELECT id FROM newsletter_subscribers WHERE email = ?`,
      ).bind(row.email).first<{ id: string }>();
      return saved?.id ?? row.id;
    },
    async confirmNewsletter(tokenHash, at) {
      const row = await database.prepare(
        `SELECT id FROM newsletter_subscribers WHERE confirm_token_hash = ?`,
      ).bind(tokenHash).first<{ id: string }>();
      if (!row) return undefined;
      await database.prepare(
        `UPDATE newsletter_subscribers SET status = 'confirmed', confirmed_at = ? WHERE confirm_token_hash = ?`,
      ).bind(at, tokenHash).run();
      return row.id;
    },
    async unsubscribeNewsletter(tokenHash, at) {
      const row = await database.prepare(
        `SELECT id FROM newsletter_subscribers WHERE unsubscribe_token_hash = ?`,
      ).bind(tokenHash).first<{ id: string }>();
      if (!row) return undefined;
      await database.prepare(
        `UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_at = ? WHERE unsubscribe_token_hash = ?`,
      ).bind(at, tokenHash).run();
      return row.id;
    },
    async appendAudit(event) {
      await database.prepare(
        `INSERT INTO audit_events (record_id, kind, created_at) VALUES (?, ?, ?)`,
      ).bind(event.recordId, event.kind, event.createdAt).run();
    },
    async allow(bucket, now, windowMs, limit) {
      const current = await database.prepare(
        `SELECT hits, window_start AS windowStart FROM rate_limits WHERE bucket = ?`,
      ).bind(bucket).first<RateRow>();
      const decision = rateDecision(current ?? undefined, now, windowMs, limit);
      await database.prepare(
        `INSERT INTO rate_limits (bucket, hits, window_start) VALUES (?, ?, ?)
         ON CONFLICT(bucket) DO UPDATE SET hits = excluded.hits, window_start = excluded.window_start`,
      ).bind(bucket, decision.next.hits, decision.next.windowStart).run();
      return decision.allowed;
    },
  };
}
