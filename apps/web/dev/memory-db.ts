import { DatabaseSync } from "node:sqlite";

export interface MemoryStatement {
  bind(...values: unknown[]): MemoryStatement;
  all<T>(): Promise<{ results: T[]; meta: { changes: number; last_row_id: number } }>;
  first<T>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number; last_row_id: number } }>;
}

export interface MemoryDatabase {
  prepare(query: string): MemoryStatement;
  batch(statements: MemoryStatement[]): Promise<Array<{ results: unknown[] }>>;
  exec(sql: string): Promise<{ count: number; duration: number }>;
}

function sqlValue(value: unknown): string | number | bigint | null | Uint8Array {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" || typeof value === "string" || typeof value === "bigint") return value;
  if (value instanceof Uint8Array) return value;
  return String(value);
}

export function createMemoryDatabase(database: DatabaseSync): MemoryDatabase {
  let changes = 0;
  let lastRowId = 0;

  function remember(result: { changes?: number | bigint; lastInsertRowid?: number | bigint }) {
    changes = Number(result.changes ?? 0);
    lastRowId = Number(result.lastInsertRowid ?? 0);
  }

  function snapshot() {
    return { changes, last_row_id: lastRowId };
  }

  function statement(query: string, values: unknown[] = []): MemoryStatement {
    const bound: MemoryStatement = {
      bind(...next: unknown[]) {
        return statement(query, next);
      },
      all<T>() {
        const rows = database.prepare(query).all(...values.map(sqlValue)) as T[];
        return Promise.resolve({ results: rows, meta: snapshot() });
      },
      first<T>() {
        const row = database.prepare(query).get(...values.map(sqlValue)) as T | undefined;
        return Promise.resolve(row ?? null);
      },
      run() {
        const result = database.prepare(query).run(...values.map(sqlValue));
        remember(result);
        return Promise.resolve({ meta: snapshot() });
      },
    };
    return bound;
  }

  return {
    prepare(query: string) {
      return statement(query);
    },
    batch(statements: MemoryStatement[]) {
      return Promise.all(statements.map((item) => item.all()));
    },
    exec(sql: string) {
      database.exec(sql);
      return Promise.resolve({ count: 0, duration: 0 });
    },
  };
}
