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

La publicación programada de EmDash pide el handler `scheduled` de `@emdash-cms/cloudflare/worker`. Alchemy arma el entrypoint del Worker y no deja poner ese handler sin salir del adaptador del repo. Una nota se publica en el momento, desde el admin. No hay cron de noticias.

## Datos

D1 `NewsDatabase` y R2 `NewsMedia`, aparte de la base y el bucket del resto del proyecto. En un stage `pr-<número>` o `preview` son otros recursos. El binding de la base es `DB` y el del bucket es `MEDIA`, que es lo que esperan los adaptadores de EmDash.

`NEWS_RUNTIME=cloudflare` entra como variable de texto. Con ese valor el build de Alchemy usa D1 y R2. `astro dev` y el build de CI no lo tienen: usan SQLite en `apps/news/data/news.db` (gitignored) y el adaptador de Node. Alchemy rechaza un `adapter` declarado en el config cuando despliega, así que el adaptador de Node solo está en ese build local.

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

Cada nota en el sitio muestra la fuente, el enlace y, si están, la publicación original y la vía. El cuerpo es un resumen escrito para Enrailar. No se pega el texto del medio.

La primera nota, `ypf-arena-fractura-vaca-muerta`, va en el seed. `emdash seed` la aplica en SQLite. En el Worker, `ensureNoticiaSeed` vuelve a aplicar el seed con el contenido si esa nota no está: el asistente de EmDash, si nadie marca «incluir contenido de ejemplo», deja el esquema y no las notas. Hace falta igual completar el asistente una vez para crear la cuenta de admin.

## Cómo entra alguien a editar

Hay dos puertas, las dos obligatorias.

1. **Cloudflare Access**, con la misma política que inbox y admin: dominio `enrailar.com` y los correos de `ACCESS_ALLOWED_EMAILS`. Si `ACCESS_SERVICE_TOKEN_IDS` trae ids, también entra la política Service Auth. En `prod` la aplicación `NewsAdmin` cubre solo `noticias.enrailar.com/_emdash` (el admin, la API y el MCP). La portada queda pública. En un preview el Worker no tiene hostname propio: Access cubre el Worker entero, así el asistente no queda abierto en `workers.dev`.
2. **La cuenta de EmDash.** La primera persona que pasa Access abre `/_emdash/admin` y termina el asistente (passkey). Las visitas siguientes usan esa cuenta. El login de EmDash no se reemplaza por Access.

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

- El DNS de `noticias.enrailar.com` lo crea el custom domain del Worker en el stage `prod`. No hace falta un registro a mano si el deploy termina bien.
- La aplicación de Access `NewsAdmin` también sale de Alchemy, en el mismo deploy. El proveedor de identidad es el que ya tiene la cuenta. Si el primer deploy crea el hostname y Access todavía no lo ve, un segundo deploy de `prod` alcanza: no hay que armar la app en el tablero.
- La cuenta de admin de EmDash sí es manual: alguien de la política de Access abre `/_emdash/admin` una vez y registra la passkey. La nota de YPF no se carga a mano.

`POLICY_AUD` y `TEAM_DOMAIN` siguen siendo del inbox. Noticias no los usa: Access corta en el borde y EmDash tiene su propia sesión.
