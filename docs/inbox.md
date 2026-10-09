# Inbox

`apps/inbox` es una copia de [cloudflare/agentic-inbox](https://github.com/cloudflare/agentic-inbox) en el commit `48039bb6785af34e592c2966f87cde2b255c4c80` (17 de abril de 2026), metida con `git subtree` y `--squash`. No reescribimos esa app.

La licencia es Apache-2.0. El texto está en [`apps/inbox/LICENSE`](../apps/inbox/LICENSE). El copyright de los fuentes es de Cloudflare, Inc., como figura en cada archivo.

## Por qué no está en el workspace

`package.json` de upstream tiene `typecheck` = `wrangler types` y `deploy` = `wrangler deploy`. Si `apps/*` lo incluyera, `pnpm typecheck` (Turbo) correría Wrangler. El workspace lista `apps/api` y `apps/web` y deja `apps/inbox` afuera. CI no llama a Wrangler.

El lockfile de esa app es el `package-lock.json` de upstream. Un deploy instala ahí con `npm ci --prefix apps/inbox`. Ese paso no es Wrangler.

`wrangler.jsonc` queda dentro del árbol porque es de upstream. La definición de despliegue de este repo sigue siendo Alchemy.

## Alchemy

`Cloudflare.Website.Vite` sobre `apps/inbox`, con `main: "workers/app.ts"`. Ese módulo envuelve el build de React Router (`virtual:react-router/server-build`) y reexporta las clases. Alchemy sube el bundle del Worker y los assets del build. No hay un paso de Wrangler.

Bindings:

| Binding | Qué es |
| --- | --- |
| `MAILBOX` | Durable Object. La clase exportada es `MailboxDO`, no `Mailbox`. No renombramos el export de upstream. |
| `EMAIL_AGENT` | Durable Object, clase `EmailAgent`. |
| `EMAIL_MCP` | Durable Object, clase `EmailMCP`. `/mcp` vive en el mismo Worker que la UI. |
| `BUCKET` | El R2 del stack. |
| `AI` | Workers AI. |
| `EMAIL` | `send_email`, remitentes limitados a las tres casillas de rol. Sin lista de destinos. |
| `DOMAINS` | `enrailar.com`. |
| `EMAIL_ADDRESSES` | Las tres casillas de rol, como JSON. |
| `POLICY_AUD`, `TEAM_DOMAIN` | Secretos. La app vendida, fuera de `vite dev`, responde 500 si faltan. El valor no está en el repo. |

Cloudflare Access cubre el Worker entero: la UI y `/mcp`. La política deja pasar el dominio `enrailar.com` y las direcciones de `ACCESS_ALLOWED_EMAILS`. El IdP se configura en la cuenta. `POLICY_AUD` es el `aud` de la aplicación que crea Alchemy y entra por el entorno.

`email-in` no entra por HTTP. Tiene bindings cruzados `MAILBOX` (`MailboxDO`) y `EMAIL_AGENT` al script de este Worker, y el mismo R2. Antes de llamar a `receiveEmail` escribe `mailboxes/<casilla>.json` si falta. `forwarding.email` queda `""`: el `message.forward()` de `email-in` es el único reenvío, y el destino sale de `FORWARD_TO`.

### Incompatibilidad con Alchemy beta

`Website.Vite` inyecta `@alchemy.run/cloudflare-runtime/vite` y setea `ALCHEMY_CLOUDFLARE_VITE_INJECTED=1`. El `vite.config.ts` de upstream registra además `@cloudflare/vite-plugin`. Alchemy documenta que los dos plugins, con el mismo nombre, se pisan: en dev hay dos workerd y uno solo tiene los bindings.

La alternativa chica es el corte que ya está en `apps/inbox/vite.config.ts`: si esa variable vale `1`, no se carga el plugin oficial. Un `vite build` suelto (sin Alchemy) sigue usando el plugin de upstream. No reescribimos la app.

El hijo de Vite de Alchemy carga ese config con el loader Oxc. En Node 22 el loader no puede enlazar `@react-router/dev` (el bundle CJS termina pidiendo el build ESM de `react-router`) y tampoco devuelve fuente para los `.js` de `apps/inbox/node_modules`. Vite solo muestra `failed to load config from apps/inbox/vite.config.ts`. `npm ci --prefix apps/inbox` deja las dependencias en su sitio; el loader igual las rompe. Los workflows pasan `scripts/ci/inbox-vite-hooks.mjs` en `NODE_OPTIONS` para corregir esa resolución antes de `alchemy deploy`.
