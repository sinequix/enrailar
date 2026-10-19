import { assert, assertEquals } from "@std/assert";
import { NEWS_HOST, NEWS_ORIGIN } from "../../packages/shared/src/project.ts";

const alchemy = Deno.readTextFileSync(new URL("../alchemy.run.ts", import.meta.url));
const newsConfig = Deno.readTextFileSync(new URL("../../apps/news/astro.config.ts", import.meta.url));

Deno.test("noticias es un Worker de Astro con D1 y R2 propios", () => {
  assert(alchemy.includes('Cloudflare.Website.Astro("News"'));
  assert(alchemy.includes('Cloudflare.D1.Database("NewsDatabase")'));
  assert(alchemy.includes('Cloudflare.R2.Bucket("NewsMedia")'));
  assert(alchemy.includes("DB: newsDatabase"));
  assert(alchemy.includes("MEDIA: newsMedia"));
  assert(alchemy.includes("`noticias.${DOMAIN}`"));
  assert(alchemy.includes("EMDASH_ENCRYPTION_KEY"));
  assert(alchemy.includes('domain: `noticias.${DOMAIN}/_emdash`'));
  const adminAt = alchemy.indexOf('Cloudflare.Access.Application("NewsAdmin"');
  const newsAt = alchemy.indexOf('Cloudflare.Website.Astro("News"');
  assert(adminAt > 0 && newsAt > adminAt);
  const newsBlock = alchemy.slice(newsAt, alchemy.indexOf('Cloudflare.Website.Vinext("Web"'));
  assert(newsBlock.includes("ACCESS_AUD: newsAdmin.aud"));
  assert(newsBlock.includes("ACCESS_TEAM_DOMAIN"));
  assert(newsBlock.includes('NEWS_ADMIN: production ? "on" : "off"'));
  assert(alchemy.includes("newsUrl: news.url"));
  assert(!newsBlock.includes("access"));
  assert(!alchemy.includes("worker_loaders"));
  assert(!/\bLOADER\s*:/.test(alchemy));
  assert(!/sandboxRunner\s*:/.test(newsConfig));
  assert(!newsConfig.includes("worker_loaders"));
  assert(newsConfig.includes('process.env.NEWS_RUNTIME === "cloudflare"'));
  assert(newsConfig.includes("emdashEntryIntegration()"));
  assertEquals(NEWS_HOST, "noticias.enrailar.com");
  assertEquals(NEWS_ORIGIN, `https://${NEWS_HOST}`);
});
