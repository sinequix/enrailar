import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";

/**
 * Ruta estática `/_emdash`, delante de `[slug]`. Astro no publica un archivo
 * de `pages/` cuyo nombre empieza con `_`, así que la ruta entra por inyección.
 */
export function emdashEntryIntegration(): AstroIntegration {
  return {
    name: "enrailar-emdash-entry",
    hooks: {
      "astro:config:setup": ({ injectRoute }) => {
        injectRoute({
          pattern: "/_emdash",
          entrypoint: fileURLToPath(new URL("./emdash-entry.ts", import.meta.url)),
          prerender: false,
        });
      },
    },
  };
}
