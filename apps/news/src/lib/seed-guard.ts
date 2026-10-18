export const SEED_FLAG_ID = "noticia-v1";

export const CREATE_SEED_FLAG_SQL =
  "CREATE TABLE IF NOT EXISTS enrailar_news_seed (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)";

export interface SeedStore {
  flagSet(): Promise<boolean>;
  applyContent(): Promise<void>;
  markApplied(): Promise<void>;
}

/**
 * Una sola vez. Si la marca ya está, no vuelve a escribir el contenido:
 * borrar la nota no la recrea.
 */
export async function runSeedOnce(store: SeedStore): Promise<"applied" | "skipped"> {
  if (await store.flagSet()) return "skipped";
  await store.applyContent();
  await store.markApplied();
  return "applied";
}
