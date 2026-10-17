import { getEmDashEntry } from "emdash";
import { getDb } from "emdash/runtime";
import { applySeed, validateSeed, type SeedFile } from "emdash/seed";
import seedJson from "../../seed/seed.json" with { type: "json" };
import { NOTICIA_COLLECTION, YPF_SLUG } from "../host.ts";

let ready: Promise<void> | undefined;

function seedFile(): SeedFile {
  const seed = seedJson as SeedFile;
  const result = validateSeed(seed);
  if (!result.valid) {
    throw new Error(`El seed de noticias no es válido: ${result.errors.join("; ")}`);
  }
  return seed;
}

async function apply(): Promise<void> {
  const found = await getEmDashEntry(NOTICIA_COLLECTION, YPF_SLUG, { locale: "es" }).catch(() => undefined);
  if (found?.entry) return;
  const db = await getDb();
  await applySeed(db, seedFile(), { includeContent: true, onConflict: "skip" });
}

/**
 * Aplica el seed con el contenido la primera vez que el isolate no encuentra
 * la nota. El asistente de EmDash no copia el contenido de ejemplo salvo que
 * alguien lo pida; esta llamada lo deja publicado igual.
 */
export function ensureNoticiaSeed(): Promise<void> {
  ready ??= apply().catch((error: unknown) => {
    ready = undefined;
    throw error;
  });
  return ready;
}
