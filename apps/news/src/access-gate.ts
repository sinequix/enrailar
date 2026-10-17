import { defineMiddleware } from "astro:middleware";
import { continueOrForbid, decideAccess, isEmDashPath } from "./lib/access.ts";

const NAMES = ["NEWS_RUNTIME", "NEWS_ADMIN", "ACCESS_AUD", "ACCESS_TEAM_DOMAIN"] as const;

let workerEnv: Record<string, unknown> | undefined;
let workerEnvTried = false;

/**
 * Import dinámico: `cloudflare:workers` no existe en `astro dev`. Un import
 * estático tiraría abajo el sitio público en Node. No es una dependencia circular.
 */
async function readWorkerEnv(): Promise<Record<string, unknown> | undefined> {
  if (workerEnvTried) return workerEnv;
  workerEnvTried = true;
  try {
    const specifier = "cloudflare:workers";
    const loaded: { env?: Record<string, unknown> } = await import(/* @vite-ignore */ specifier);
    workerEnv = loaded.env;
  } catch {
    workerEnv = undefined;
  }
  return workerEnv;
}

function fromProcess(name: string): string {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const value = proc?.env?.[name];
  return typeof value === "string" ? value : "";
}

async function binding(name: (typeof NAMES)[number]): Promise<string> {
  const worker = await readWorkerEnv();
  const fromWorker = worker?.[name];
  if (typeof fromWorker === "string" && fromWorker.length > 0) return fromWorker;
  return fromProcess(name);
}

async function fetchCerts(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`jwks ${response.status}`);
  return response.json();
}

/**
 * Envuelve todo EmDash (`middleware.outer`, orden pre). Si esto no llama a
 * `next()`, el asistente de setup no corre y nadie se vuelve admin.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const verdict = await decideAccess({
    pathname: context.url.pathname,
    token: context.request.headers.get("cf-access-jwt-assertion"),
    runtime: await binding("NEWS_RUNTIME"),
    admin: await binding("NEWS_ADMIN"),
    aud: await binding("ACCESS_AUD"),
    teamDomain: await binding("ACCESS_TEAM_DOMAIN"),
    now: Date.now(),
    dev: import.meta.env.DEV === true,
  }, fetchCerts);
  const pathname = context.url.pathname;
  if (verdict.kind === "pass" && isEmDashPath(pathname)) {
    context.locals.newsAccess = "allow";
  }
  return continueOrForbid(verdict, next);
});
