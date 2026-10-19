# Noticias

El agregador vive en [`apps/news`](../apps/news). Es un sitio Astro con [EmDash](https://emdashcms.com) 1.3 y se despliega como Worker de Cloudflare desde [`infra/alchemy.run.ts`](../infra/alchemy.run.ts). Alchemy crea el D1, el R2 y el dominio. No hay un `wrangler.json` de noticias y no se aprovisiona con `wrangler`.

## Por qué un host y no un camino

La web principal no es Astro. Meter EmDash en `enrailar.com/noticias` mezclaría dos Workers en el ápice. El host elegido es **`noticias.enrailar.com`**. El origen está en un solo lugar, `NEWS_ORIGIN` de `@enrailar/shared`. La cabecera y el pie de `apps/web` enlazan ahí.

Para pasar el sitio a `/noticias` más adelante:

1. En el stage `prod`, cambiar el dominio del Worker `News` por una ruta `enrailar.com/noticias*` y sacar el custom domain `noticias`.
2. Definir `NEWS_BASE=/noticias` en el entorno del build. [`apps/news/astro.config.ts`](../apps/news/astro.config.ts) lo lee y lo pasa como `base` de Astro.
3. Cambiar `NEWS_HOST` en [`packages/shared/src/project.ts`](../packages/shared/src/project.ts) y la app de Access al camino nuevo.
4. Los archivos de `public/` quedan bajo ese `base`. Las fuentes del CSS usan `/fonts`: hay que anteponer el camino si el sitio deja de servirse en la raíz del host.

## Qué no se prende

EmDash puede correr plugins en un isolate con el binding `LOADER` (Worker Loader). Eso pide el plan de pago de Workers. Este sitio no declara `sandboxRunner` ni `LOADER`. Tampoco usa el binding de Images: las notas no transforman imágenes en el Worker.

La publicación es inmediata. No hay handler `scheduled` ni cron: Alchemy arma el entrypoint del Worker y no engancha el de `@emdash-cms/cloudflare/worker`. Una nota se ve en cuanto alguien la publica en el admin. No hay publicación programada.

## Datos

D1 `NewsDatabase` y R2 `NewsMedia`, aparte de la base y el bucket del resto del proyecto. En un stage `pr-<número>` o `preview` son otros recursos. El binding de la base es `DB` y el del bucket es `MEDIA`, que es lo que esperan los adaptadores de EmDash.

`NEWS_RUNTIME=cloudflare` entra como variable de texto. Con ese valor el build de Alchemy usa D1 y R2. El script `dev` exporta `NEWS_RUNTIME=node` y usa SQLite en `apps/news/data/news.db` (gitignored) y el adaptador de Node. El build de CI no pone esa variable. Alchemy rechaza un `adapter` declarado en el config cuando despliega, así que el adaptador de Node solo está en el build local.

El typecheck de esta app es `astro check`. Ese comando no corre con TypeScript 7, que es el del resto del monorepo, así que `@enrailar/news` fija TypeScript 6. Los tests siguen en Deno y no entran en ese check.

## Modelo `noticia`

El seed está en [`apps/news/seed/seed.json`](../apps/news/seed/seed.json). EmDash reserva `slug` y `published_at`: el slug público y la fecha de publicación son campos del sistema, no columnas extra. El idioma es el locale de la entrada (`es` por defecto; `en` se puede agregar como traducción). Las etiquetas son la taxonomía `etiqueta`.

| Campo | Tipo | Obligatorio |
| --- | --- | --- |
| `title` | string | sí |
| `summary` | text | sí |
| `body` | portable text | sí |
| `source_name` | string | sí |
| `source_url` | url | sí |
| `original_post_url` | url | no |
| `via` | string | no |
| `lines` | multi-select: Urquiza, Mitre, San Martín, Roca, Sarmiento, Belgrano | sí |
| `category` | select: carga, pasajeros, infraestructura, política | sí |

Cada nota en el sitio muestra la fuente, el enlace y, si están, la publicación original y la vía. El esquema de `source_url` y `original_post_url` pide `^https://`. El render también: un `http` u otro esquema no se vuelve un enlace. Los enlaces llevan `rel="noopener noreferrer"`. El cuerpo es un resumen escrito para Enrailar. No se pega el texto del medio.

La primera nota, `ypf-arena-fractura-vaca-muerta`, va en el seed. En local, `pnpm --filter @enrailar/news seed` la escribe en SQLite. En el Worker no se escribe desde una visita pública. `ensureNoticiaSeed` corre una sola vez, después de que Access dejó pasar un request a `/_emdash`, y deja la marca `noticia-v1` en la tabla `enrailar_news_seed`. Si esa marca ya está, no vuelve a insertar contenido: borrar la nota de YPF no la recrea. Hasta esa primera entrada autenticada, la portada puede estar vacía. Hace falta igual completar el asistente una vez para crear la cuenta de admin.

## Cómo entra alguien a editar

Hay dos puertas, las dos obligatorias. EmDash convierte en admin a quien completa el asistente primero, así que `/_emdash` no puede atender a nadie antes de Access.

1. **Cloudflare Access**, con la misma política que inbox y admin: dominio `enrailar.com` y los correos de `ACCESS_ALLOWED_EMAILS`. Si `ACCESS_SERVICE_TOKEN_IDS` trae ids, también entra la política Service Auth. En `prod`, Alchemy crea la aplicación `NewsAdmin` (`noticias.enrailar.com/_emdash`) **antes** del Worker. El Worker lee `ACCESS_AUD` del `aud` de esa app: si Access no se creó, el Worker no se despliega. La portada no está en esa app. No se usa la prop `access` del Worker, porque inscribiría todo el tráfico.
2. **El JWT en el Worker.** Un middleware externo de Astro (`src/access-gate.ts`, `middleware.outer`) corre antes del setup de EmDash. En `/_emdash` y debajo (admin, API, MCP, asistente) exige `Cf-Access-Jwt-Assertion`. Verifica la firma RS256 con las claves de `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` (las guarda en memoria una hora), `exp`, `iss` igual al origen del equipo y `aud` igual a `ACCESS_AUD`. Un `alg` distinto de `RS256` (`none`, `HS256`) no verifica. Si el `kid` no está en el caché, vuelve a pedir las claves como mucho una vez cada 60 segundos. Si falta el header o no verifica, responde 403 y no llama al resto: el asistente no corre. Esa validación corre siempre, salvo en `astro dev` con `NEWS_RUNTIME=node`. Un runtime vacío u otro valor no abre el admin. `ACCESS_TEAM_DOMAIN` es el mismo `TEAM_DOMAIN` que ya usa el inbox. No se adopta la organización de Zero Trust: ese recurso hace PUT del singleton de la cuenta.
3. **La cuenta de EmDash.** La primera persona que pasa las dos puertas abre `/_emdash/admin` y termina el asistente (passkey). Las visitas siguientes usan esa cuenta. El login de EmDash no se reemplaza por Access. `/_emdash` a secas (el camino de la app de Access, sin `/admin`) no es una nota: una ruta estática lo manda a `/_emdash/admin`. La página `[slug]` también rechaza ese slug, así que el texto de «esta nota no está» no sale para el admin. El seed de YPF corre en el middleware de esa visita autenticada, antes de la página, y deja `noticia-v1`.

En un preview no hay hostname propio y no se crea `NewsAdmin` sobre `noticias.enrailar.com` (esa app es de prod). `NEWS_ADMIN` queda en `off`. Cualquier request a `/_emdash` responde 403, con o sin JWT. El workflow de preview, después del deploy, pide la URL del Worker en los outputs de Alchemy (`newsUrl`) y falla si `/_emdash` o `/_emdash/admin` no responden 403. No pide el camino autenticado: un atajo de prueba en el Worker (JWT de test, saltear Access) podría quedar prendido en prod. Ese camino se prueba en local, con un JWKS de test. El admin del preview no está abierto. `pnpm --filter @enrailar/news dev` no es un preview: corre con `NEWS_RUNTIME=node` y `import.meta.env.DEV`, y solo esa combinación deja el admin local sin Access.

## Cómo se agrega una nota

### Admin

`https://noticias.enrailar.com/_emdash/admin`, detrás de Access. Colección Noticias, nueva entrada, completar la fuente, publicar. El idioma de la interfaz del admin sigue el catálogo de EmDash (`es-419` y `en` en el build; el contenido de las notas sigue en locale `es`).

### CLI

En local, con el dev server en marcha:

```bash
pnpm --filter @enrailar/news seed
pnpm --filter @enrailar/news dev
pnpm --filter @enrailar/news exec emdash login
pnpm --filter @enrailar/news exec emdash content list noticia
```

Contra el sitio desplegado, el mismo `emdash login --url https://noticias.enrailar.com`. El navegador del device flow tiene que pasar Access. `emdash content` y `emdash schema` hablan con la API del sitio ya autenticado. La referencia está en la [CLI de EmDash](https://docs.emdashcms.com/reference/cli/).

### MCP

EmDash expone `/_emdash/api/mcp`. Pide un bearer que se crea en el admin. No se commitea. Además, esa ruta está detrás de Access: un cliente que no es un navegador necesita un service token de Access ya incluido en `ACCESS_SERVICE_TOKEN_IDS`, con las cabeceras `CF-Access-Client-Id` y `CF-Access-Client-Secret`, más `Authorization: Bearer`. El secreto del token se crea en Zero Trust. No va al repo.

## Secretos y pasos de una sola vez

Nada de esto se escribe en el repositorio. [`.env.example`](../.env.example) solo deja el nombre vacío.

| Nombre | Dónde |
| --- | --- |
| `EMDASH_ENCRYPTION_KEY` | Secreto del entorno `production` de GitHub. Alchemy lo pasa al Worker. Cifra ajustes secretos de plugins. `require-secrets.sh` corta el deploy de prod si falta. El preview genera uno efímero en el workflow y no usa el de prod. |

Generarlo en una máquina local, sin imprimirlo en un issue:

```bash
pnpm --filter @enrailar/news exec emdash secrets generate
```

Cargarlo en el entorno `production` como `EMDASH_ENCRYPTION_KEY` antes del primer deploy a `main`. Si se pierde, los ajustes cifrados que se hayan guardado después dejan de leerse. Hoy no hay plugins con secreto.

Lo demás ya está en el stack:

- El DNS de `noticias.enrailar.com` lo crea el custom domain del Worker en el stage `prod`. La zona ya está adoptada. `NewsAdmin` se crea antes que el Worker. Si Cloudflare rechaza la app porque el hostname todavía no está en la zona, el Worker no se despliega: se corrige el DNS y se vuelve a correr prod. No hay que publicar el Worker solo para «abrir» el admin.
- `ACCESS_AUD` no es un secreto de GitHub. Sale del `aud` de `NewsAdmin` y Alchemy lo pone en el Worker. `ACCESS_TEAM_DOMAIN` reutiliza el secreto `TEAM_DOMAIN` que prod ya exige para el inbox. No hay un secreto nuevo de Access.
- El proveedor de identidad es el que ya tiene la cuenta. No hay que armar la app en el tablero.
- La cuenta de admin de EmDash sí es manual: alguien de la política de Access abre `/_emdash/admin` una vez y registra la passkey. Esa visita, ya autenticada, aplica el seed una sola vez. La nota de YPF no se carga a mano. Borrarla después no la vuelve a crear.

`POLICY_AUD` sigue siendo solo del inbox. Noticias usa el `aud` de su propia app.
