import { fileURLToPath } from "node:url";
import node from "@astrojs/node";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { NEWS_ORIGIN } from "@enrailar/shared";
import { defineConfig } from "astro/config";
import emdash, { local } from "emdash/astro";
import { sqlite } from "emdash/db";
import { emdashEntryIntegration } from "./src/emdash-entry-integration.ts";

const onCloudflare = process.env.NEWS_RUNTIME === "cloudflare";
const base = process.env.NEWS_BASE?.trim() || "/";

/**
 * Alchemy envuelve este módulo en `\0distilled:worker-entry:` y lo vuelve a
 * resolver sin importer, desde la raíz de `apps/news`. Sin el paquete en
 * este proyecto, Rolldown no encuentra el entry y el Worker no buildea.
 * El alias apunta al archivo: el export no tiene condición `default`.
 */
const ALCHEMY_SERVER_ENTRY = "@alchemy.run/frontend-frameworks/astro/entrypoints/server";
const alchemyServerEntry = onCloudflare
  ? fileURLToPath(import.meta.resolve(ALCHEMY_SERVER_ENTRY))
  : undefined;

/**
 * Alchemy inyecta el adaptador de Cloudflare en el deploy y rechaza otro
 * `adapter` en este archivo. El build local (CI, `astro dev`) usa Node y
 * SQLite. No hay `sandboxRunner` ni binding `LOADER`: los plugins en
 * sandbox piden Worker Loader, que es de Workers de pago.
 */
export default defineConfig({
  site: NEWS_ORIGIN,
  base,
  output: "server",
  ...(onCloudflare ? {} : { adapter: node({ mode: "standalone" }) }),
  integrations: [
    react(),
    emdashEntryIntegration(),
    emdash({
      database: onCloudflare ? d1({ binding: "DB" }) : sqlite({ url: "file:./data/news.db" }),
      storage: onCloudflare
        ? r2({ binding: "MEDIA" })
        : local({ directory: "./data/uploads", baseUrl: "/_emdash/api/media/file" }),
      admin: { locales: ["es-419", "en"] },
      middleware: { outer: "./src/access-gate.ts" },
    }),
  ],
  vite: {
    resolve: alchemyServerEntry
      ? {
        alias: [{
          find: /^@alchemy\.run\/frontend-frameworks\/astro\/entrypoints\/server$/,
          replacement: alchemyServerEntry,
        }],
      }
      : {},
    ssr: {
      external: ["cloudflare:workers"],
    },
  },
  devToolbar: { enabled: false },
});
