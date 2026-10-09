# ADR 0001: Express en Workers y Deno para tooling

## Estado

Aceptado

## Contexto

La API de Enrailar recibe formularios, valida datos y escribe en D1. Tiene que correr en Cloudflare Workers. El CI de lint, tipos y tests tiene que pasar sin token de Cloudflare y sin desplegar.

## Decisión

La API es una aplicación Express montada sobre Workers con compatibilidad Node (`nodejs_compat`, o la fecha de compatibilidad que la activa por defecto). El entrypoint del Worker usa `httpServerHandler` de `cloudflare:node` y no es la fuente de la lógica: los handlers viven en la app Express, que los tests importan directo.

El tooling y los tests corren en Deno (`deno lint`, `deno test`). Deno resuelve las dependencias npm del workspace. Los tests no hablan con Cloudflare: usan dobles en memoria.

Los contratos compartidos entre la web y la API (esquemas Zod de los formularios, casillas de rol, fecha de la cuenta regresiva) viven en `packages/shared`.

El despliegue no se define en este ADR. Wrangler no es la fuente de verdad de la infraestructura.

## Consecuencias

- Express solo arranca en un Worker con las APIs de Node habilitadas. Eso se declara en la infra, no en un `wrangler.json` paralelo.
- Un test puede ejercitar un formulario sin red. Lo que depende del runtime de Workers (el puente `cloudflare:node`, bindings, Turnstile real) queda fuera de esa suite.
- Hay dos resoluciones de `zod`: la de pnpm para `tsc` y el import map de `deno.json` para los tests. Van pineadas a la misma versión.
