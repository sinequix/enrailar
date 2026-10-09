# Inbox

`apps/inbox` es una copia de [cloudflare/agentic-inbox](https://github.com/cloudflare/agentic-inbox) en el commit `48039bb6785af34e592c2966f87cde2b255c4c80` (17 de abril de 2026), metida con `git subtree` y `--squash`. No reescribimos esa app.

La licencia es Apache-2.0. El texto está en [`apps/inbox/LICENSE`](../apps/inbox/LICENSE). El copyright de los fuentes es de Cloudflare, Inc., como figura en cada archivo.

## Por qué no está en el workspace

`package.json` de upstream tiene `typecheck` = `wrangler types` y `deploy` = `wrangler deploy`. Si `apps/*` lo incluyera, `pnpm typecheck` (Turbo) correría Wrangler. El workspace lista `apps/api` y `apps/web` y deja `apps/inbox` afuera. CI no llama a Wrangler.

El lockfile de esa app es el `package-lock.json` de upstream. Un deploy instala ahí con `npm ci --prefix apps/inbox`. Ese paso no es Wrangler.

`wrangler.jsonc` queda dentro del árbol porque es de upstream. La definición de despliegue de este repo sigue siendo Alchemy.
