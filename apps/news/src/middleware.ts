import { defineMiddleware } from "astro:middleware";
import { ensureNoticiaSeed } from "./lib/ensure-seed.ts";

/** El seed corre acá, con la base ya abierta, y solo si Access dejó pasar. */
export const onRequest = defineMiddleware(async (context, next) => {
  if (context.locals.newsAccess === "allow") await ensureNoticiaSeed();
  return next();
});
