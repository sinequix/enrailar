export interface InboundRow {
  id: string;
  mailbox: string;
  subject: string;
  objectKey: string;
  sizeBytes: number;
  createdAt: string;
}

export interface InboundStore {
  save(row: InboundRow): Promise<void>;
  list(mailbox: string): Promise<InboundRow[]>;
  get(id: string): Promise<InboundRow | undefined>;
}

export interface ObjectStore {
  put(key: string, body: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | undefined>;
}

export function mailboxObject(mailbox: string): { key: string; body: Uint8Array } {
  const settings = {
    fromName: mailbox,
    forwarding: { enabled: false, email: "" },
    signature: { enabled: false, text: "" },
    autoReply: { enabled: false, subject: "", message: "" },
  };
  return {
    key: `mailboxes/${mailbox}.json`,
    body: new TextEncoder().encode(JSON.stringify(settings)),
  };
}

export function createMemoryStore(): InboundStore {
  const rows = new Map<string, InboundRow>();
  return {
    save(row) {
      const existing = rows.get(row.id);
      rows.set(row.id, existing ? { ...row, createdAt: existing.createdAt } : row);
      return Promise.resolve();
    },
    list(mailbox) {
      const found = [...rows.values()].filter((row) => row.mailbox === mailbox);
      found.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return Promise.resolve(found.slice(0, 50));
    },
    get(id) {
      return Promise.resolve(rows.get(id));
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

interface SqlRow {
  id: string;
  mailbox: string;
  subject: string;
  object_key: string;
  size_bytes: number;
  created_at: string;
}

function fromSql(row: SqlRow): InboundRow {
  return {
    id: row.id,
    mailbox: row.mailbox,
    subject: row.subject,
    objectKey: row.object_key,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

export function createD1Store(database: SqlDatabase): InboundStore {
  return {
    async save(row) {
      await database.prepare(
        `INSERT INTO inbound_messages (id, mailbox, subject, object_key, size_bytes, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           mailbox = excluded.mailbox,
           subject = excluded.subject,
           object_key = excluded.object_key,
           size_bytes = excluded.size_bytes`,
      ).bind(row.id, row.mailbox, row.subject, row.objectKey, row.sizeBytes, row.createdAt).run();
    },
    async list(mailbox) {
      const result = await database.prepare(
        `SELECT id, mailbox, subject, object_key, size_bytes, created_at
         FROM inbound_messages WHERE mailbox = ? ORDER BY created_at DESC LIMIT 50`,
      ).bind(mailbox).all<SqlRow>();
      return (result.results ?? []).map(fromSql);
    },
    async get(id) {
      const row = await database.prepare(
        `SELECT id, mailbox, subject, object_key, size_bytes, created_at
         FROM inbound_messages WHERE id = ?`,
      ).bind(id).first<SqlRow>();
      return row ? fromSql(row) : undefined;
    },
  };
}
