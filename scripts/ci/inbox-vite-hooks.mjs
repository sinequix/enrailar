/**
 * Alchemy arranca el build de Vite en un proceso hijo con el loader Oxc
 * (`--import register-oxc.js`). En Node 22 ese loader, al cargar el
 * `vite.config.ts` de `apps/inbox`, hace dos cosas que tiran el build:
 *
 * 1. Resuelve `react-router` desde el bundle CJS de `@react-router/dev`
 *    hacia `dist/development/index.mjs`. El `require` de ese CJS no enlaza
 *    el chunk ESM y Node falla con `ERR_VM_MODULE_LINK_FAILURE`. Vite lo
 *    reporta solo como `failed to load config from apps/inbox/vite.config.ts`.
 * 2. El hook `load` del loader devuelve `source: null` para los `.js` CJS
 *    de `apps/inbox/node_modules` (por ejemplo `routes.js`). Node rechaza
 *    esa respuesta.
 *
 * `npm ci --prefix apps/inbox` hace falta (el paquete no está en el
 * workspace), pero no alcanza: el hijo igual corre con el loader. Este
 * módulo se pasa en `NODE_OPTIONS` antes de Alchemy. El hijo hereda esa
 * variable y el import queda adentro de la cadena, así el loader de Oxc
 * llama a estos hooks.
 */
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const packageType = new Map();

const moduleFormat = (filePath) => {
  if (filePath.endsWith(".mjs")) return "module";
  if (filePath.endsWith(".cjs")) return "commonjs";
  let dir = path.dirname(filePath);
  for (;;) {
    const cached = packageType.get(dir);
    if (cached !== undefined) return cached;
    const manifest = path.join(dir, "package.json");
    if (fs.existsSync(manifest)) {
      let format = "commonjs";
      try {
        const parsed = JSON.parse(fs.readFileSync(manifest, "utf8"));
        format = parsed.type === "module" ? "module" : "commonjs";
      } catch {
        format = "commonjs";
      }
      packageType.set(dir, format);
      return format;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return "commonjs";
    dir = parent;
  }
};

const inboxModules = (value) => value.includes("/apps/inbox/node_modules/");

registerHooks({
  resolve(specifier, context, nextResolve) {
    const parent = context.parentURL ?? "";
    if (
      inboxModules(parent) &&
      parent.includes("/@react-router/dev/") &&
      specifier.includes("/react-router/dist/") &&
      specifier.endsWith(".mjs")
    ) {
      return nextResolve(specifier.replace(/\.mjs$/, ".js"), context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    const clean = url.split("?")[0] ?? url;
    if (clean.startsWith("file:") && inboxModules(clean) && /\.(?:[cm]?js)$/.test(clean)) {
      const filePath = fileURLToPath(clean);
      return {
        format: moduleFormat(filePath),
        source: fs.readFileSync(filePath),
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});
