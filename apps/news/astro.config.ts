import node from "@astrojs/node";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { NEWS_ORIGIN } from "@enrailar/shared";
import { defineConfig } from "astro/config";
import emdash, { local } from "emdash/astro";
import { sqlite } from "emdash/db";

const onCloudflare = process.env.NEWS_RUNTIME === "cloudflare";
const base = process.env.NEWS_BASE?.trim() || "/";

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
    emdash({
      database: onCloudflare ? d1({ binding: "DB" }) : sqlite({ url: "file:./data/news.db" }),
      storage: onCloudflare
        ? r2({ binding: "MEDIA" })
        : local({ directory: "./data/uploads", baseUrl: "/_emdash/api/media/file" }),
      admin: { locales: ["es-419", "en"] },
    }),
  ],
  devToolbar: { enabled: false },
});
