import { getDb } from "emdash/runtime";
import { applySeed, validateSeed, type SeedFile } from "emdash/seed";
import { sql } from "kysely";
import seedJson from "../../seed/seed.json" with { type: "json" };
import { CREATE_SEED_FLAG_SQL, runSeedOnce, SEED_FLAG_ID } from "./seed-guard.ts";

let done: Promise<void> | undefined;

function seedFile(): SeedFile {
  const seed = seedJson as SeedFile;
  const result = validateSeed(seed);
  if (!result.valid) {
    throw new Error(`El seed de noticias no es válido: ${result.errors.join("; ")}`);
  }
  return seed;
}

async function applyOnce(): Promise<void> {
  const db = await getDb();
  await runSeedOnce({
    flagSet: async () => {
      await sql.raw(CREATE_SEED_FLAG_SQL).execute(db);
      const found = await sql<{ id: string }>`
        select id from enrailar_news_seed where id = ${SEED_FLAG_ID}
      `.execute(db);
      return found.rows.length > 0;
    },
    applyContent: async () => {
      await applySeed(db, seedFile(), { includeContent: true, onConflict: "skip" });
    },
    markApplied: async () => {
      const appliedAt = new Date().toISOString();
      await sql`
        insert into enrailar_news_seed (id, applied_at)
        values (${SEED_FLAG_ID}, ${appliedAt})
        on conflict (id) do nothing
      `.execute(db);
    },
  });
}

/**
 * Corre solo después de Access, en `/_emdash`. La marca en D1 impide una
 * segunda escritura: si alguien borra la nota, no se vuelve a crear.
 * Las páginas públicas no llaman esto.
 */
export function ensureNoticiaSeed(): Promise<void> {
  done ??= applyOnce().catch((error: unknown) => {
    done = undefined;
    throw error;
  });
  return done;
}
