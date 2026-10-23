# Despliegue

La definición de Cloudflare está en [`infra/alchemy.run.ts`](../infra/alchemy.run.ts). Alchemy es la única fuente. No hay un `wrangler.json` paralelo.

Este repositorio no despliega solo. `prod` no se toca hasta que existan los secretos de abajo. No corras `alchemy deploy` ni `wrangler` contra una cuenta mientras falten.

## Stages

| Stage | Qué crea |
| --- | --- |
| `preview` | Workers, D1, R2, colas y Turnstile, en URLs `workers.dev` |
| `prod` | Lo mismo, más la zona `enrailar.com`, DNS de los Workers, Email Routing y los dominios propios |
| `pr-<número>` | Igual que `preview`. Lo usa el workflow de cada pull request |

La zona y el correo son únicos en la cuenta. Por eso solo el stage `prod` los declara. Un preview no puede adoptar `enrailar.com`.

Alchemy CLI pide Node `>=22.15` (`module.registerHooks`). En `infra` están `@effect/platform-node` y `@alchemy.run/frontend-frameworks`, que el comando necesita para arrancar y para `Website.Vinext`.

```bash
pnpm --filter @enrailar/infra exec alchemy deploy --no-input --stage preview
pnpm --filter @enrailar/infra exec alchemy deploy --no-input --stage prod
pnpm --filter @enrailar/infra exec alchemy destroy --no-input --stage pr-12
```

Los workflows están en `.github/workflows/`. `ci.yml` corre lint, typecheck, tests y el build de la web, sin token de Cloudflare. `preview.yml` despliega el stage `pr-<número>` y lo destruye al terminar ese job (haya salido bien o mal el deploy) y otra vez al cerrar el PR. `prod.yml` despliega `prod` en cada push a `main`. Los dos últimos llaman a `scripts/ci/require-secrets.sh` antes de Alchemy: si falta un secreto, salen con error y no despliegan. `alchemy destroy` de `prod` no está en ningún workflow.

Los previews solo se ejecutan para PR internos que no sean de Dependabot. Los PR de forks y Dependabot no reciben secretos de Actions: sus jobs de preview y limpieza quedan `skipped`, sin crear recursos. Se comprueba el autor del PR, no quien reintenta el workflow. Esto no reemplaza una prueba de despliegue ni cambia el check `ci` obligatorio: lint, typecheck, tests, E2E y builds siguen corriendo sin credenciales. Los PR internos conservan `require-secrets.sh` y fallan si falta configuración. Después de fusionar una dependencia, se verifica el workflow de producción antes de continuar con la siguiente.

## Secretos

Los valores no van en el repositorio, ni en ejemplos, ni en logs. [`.env.example`](../.env.example) solo tiene el nombre, vacío. Cargalos en el entorno del que corre Alchemy (la shell local o los secretos del repositorio en GitHub).

| Nombre | Dónde se usa |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Credencial del provider. Alchemy la lee del entorno. |
| `CLOUDFLARE_ACCOUNT_ID` | La misma credencial. |
| `ALCHEMY_PASSWORD` | Nombre reservado. Alchemy `2.0.0-beta.81` no lo lee: la clave del state store la crea el bootstrap en el Secrets Store de Cloudflare. |
| `ACCESS_ALLOWED_EMAILS` | Lista separada por comas. La política de Access deja pasar el dominio `enrailar.com` y, además, estas direcciones. Vacía, solo queda el dominio. El valor no se escribe en el repo. |
| `ACCESS_SERVICE_TOKEN_IDS` | Lista separada por comas de ids de service tokens de Access. Opcional: vacía, la política no incluye tokens y `require-secrets.sh` no corta el deploy. Con ids, inbox y admin suman una política Service Auth para que un redeploy no los borre. El valor no se escribe en el repo. |
| `POLICY_AUD` | Binding secreto del inbox. Es el `aud` de la aplicación de Access que crea Alchemy, leído del entorno. |
| `TEAM_DOMAIN` | Binding secreto del inbox. URL del equipo de Access, o la URL completa de los certificados. Sale de la organización de Zero Trust que ya existe en la cuenta. |
| `CLICKUP_API_TOKEN` | Secreto compartido del Worker de la API y de `email-in`. Alchemy lo guarda como secret text solo si tiene valor. Es el mismo token que ya usan los workflows de sync. Vacío, el deploy sigue: Sumate guarda la ficha en D1 y el correo a `hola@` queda para reintento. El valor no se escribe en el repo. `require-secrets.sh` no lo pide. |
| `CLICKUP_LIST_ID_WEB` | Variable de GitHub Actions (`vars.CLICKUP_LIST_ID_WEB`), no un secreto. La lee el Worker de la API, que es el que guarda Sumate. Lista Voluntarios y Hackatrain: `901717736446`. Vacía, la ficha queda para reintento. |
| `CLICKUP_LIST_ID_CONTACTS` | Variable de GitHub Actions (`vars.CLICKUP_LIST_ID_CONTACTS`), no un secreto. La lee solo `email-in`. Lista Contactos: `901717736444`. Puede diferir de la de Sumate. Vacía, el correo igual se guarda en el inbox y la fila queda para reintento. |
| `EMDASH_ENCRYPTION_KEY` | Secreto del Worker de noticias. Cifra ajustes de plugins de EmDash. `require-secrets.sh` lo pide. El preview genera uno efímero. El valor no se escribe en el repo. Ver [`news-cms.md`](news-cms.md). |

`email-in` no reenvía. No hay `FORWARD_TO` ni `message.forward()`. Los workflows de preview y de prod inyectan las dos variables de lista; Alchemy las ata como texto en el recurso de cada Worker.

El sitekey de Turnstile es público y sale del recurso. El secret también: Alchemy lo expone como `turnstile.secret` (`Redacted`) y el Worker de la API lo recibe como binding. No hace falta un `TURNSTILE_SECRET_KEY` en el entorno. Los hostnames del widget son `enrailar.com` (cubre subdominios) y `localhost`. Un preview en `workers.dev` no está en esa lista: hay que sumar el hostname al widget antes de probar el formulario ahí.

## Qué queda apuntando a stubs

### Correo transaccional

El worker `email-out` recibe el binding `EMAIL` (`send_email` de Email Sending). Las variables de texto, no secretos, son `EMAIL_FROM`, `APP_BASE_URL` y `PUBLIC_API_ORIGIN`. Alchemy las setea: en prod `EMAIL_FROM` es `no-responder@enrailar.com` y `APP_BASE_URL` es `https://enrailar.com`. No van en `.env.example` ni en los secretos de GitHub. `EMAIL_VERIFICATION_REQUIRED` también es texto, en el Worker de la web: vacía (el default) no bloquea el ingreso y un fallo de envío no corta el alta ni la recuperación. `1`, `true` o `yes` vuelven a exigir la verificación. Está vacía en `.env.example` y el workflow la pasa desde `secrets.EMAIL_VERIFICATION_REQUIRED`. `require-secrets.sh` no la pide. En `prod`, Alchemy declara el MX de Email Routing, un solo SPF en el ápice y el TXT `_dmarc` (`p=none`, `rua` a `hola@enrailar.com`). DKIM y los registros de Email Sending (`cf-bounce`) no se copian: los escribe el onboarding. El detalle está en [`email.md`](email.md).

La API, el inbox, los workers de correo y la web ya tienen entrypoint propio. La web es `Cloudflare.Website.Vinext` sobre `apps/web`. El inbox es `Cloudflare.Website.Vite` sobre `apps/inbox` (`main: workers/app.ts`). Antes de `alchemy deploy`, `npm ci --prefix apps/inbox`: ese paquete no está en el workspace de pnpm y trae su propio lockfile. Ese `npm ci` no corre Wrangler. El admin sigue en `infra/stubs/`. Las tablas de D1 salen de `apps/api/migrations`. El detalle del correo está en [`email.md`](email.md) y el del inbox en [`inbox.md`](inbox.md).

`NEXT_PUBLIC_API_ORIGIN` y `NEXT_PUBLIC_TURNSTILE_SITE_KEY` son públicas. En [`.env.example`](../.env.example) quedan vacías. Si el origen no está, el formulario apunta a `https://api.enrailar.com`. La clave de Turnstile es el sitekey del widget, no el secret.

La web manda una sola ficha a `POST /v1/sumate`. Cada opción queda como una intención en D1 (`submissions` y `submission_intents`). La ficha también guarda nombre, correo, ciudad, región o país, perfil y cómo quiere ayudar (`0006_sumate_volunteer.sql`). Si una de las opciones es el boletín, el doble opt-in sigue por `newsletter.confirm`, igual que `POST /v1/newsletter`. El alta de voluntario no manda otro correo. Las rutas `POST /v1/preinscripcion`, `POST /v1/contacto` y `POST /v1/newsletter` siguen aceptando el contrato anterior. `0003_submissions.sql` copia las fichas ya guardadas y no borra las tablas de origen.

Después de guardar, la API hace create-or-update de un contacto en la lista `CLICKUP_LIST_ID_WEB` (Voluntarios y Hackatrain, `901717736446`), deduplicado por el custom field `email`. Si no existe, lo crea. La fuente queda en el custom field `fuente` (`sumate`). `email-in` usa el mismo `upsertCrmContact` de `@enrailar/shared` con `fuente` `email`, la etiqueta `contacto` y la otra lista, `CLICKUP_LIST_ID_CONTACTS` (Contactos, `901717736444`). La etiqueta `voluntario` se agrega en Sumate. Si el custom field `fuente` no se puede escribir, se usa la etiqueta `fuente-sumate` o `fuente-email`. El título y la descripción no llevan perfil, lugar, intenciones ni id de ficha: van en un comentario con `notify_all` en falso. La sync no publica estas listas. Si ClickUp falla, la respuesta sigue siendo 202 y `clickup_status` queda en `retry`. El token solo entra como secreto del Worker.

### Cómo llega el sitekey de Turnstile a la web

Alchemy declara el binding `TURNSTILE_SITE_KEY` en el Worker de la web (`Cloudflare.Website.Vinext("Web", { env: { TURNSTILE_SITE_KEY: turnstile.sitekey } })`). La web no lo recibe en el build: `vite build` corre sin ese valor, y en `vinext` solo las variables `NEXT_PUBLIC_*` presentes en el entorno del build se inlinean. Por eso la página lo lee en tiempo de request con `process.env.TURNSTILE_SITE_KEY` ([`apps/web/src/turnstile.ts`](../apps/web/src/turnstile.ts)): con `nodejs_compat` y fecha de compatibilidad posterior a `2025-04-01`, el runtime de Workers puebla `process.env` con los bindings de texto. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` queda como alternativa para desarrollo local.

Si una página se sirviera prerenderizada (hoy `vinext()` no tiene `prerender` activado), el HTML no tendría la clave. Para ese caso el cliente la pide una vez a `GET /api/turnstile` ([`apps/web/app/api/turnstile/route.ts`](../apps/web/app/api/turnstile/route.ts)), una ruta `force-dynamic` sin caché que lee el mismo binding. El mensaje «Falta la clave pública de Turnstile en este entorno» solo aparece cuando ninguna de las dos vías devuelve un valor.

## Access

`inbox` y `admin` exigen Cloudflare Access. La política `allow` deja pasar identidades del dominio `enrailar.com` y las direcciones de `ACCESS_ALLOWED_EMAILS`. Si `ACCESS_SERVICE_TOKEN_IDS` trae ids, la misma aplicación suma una política Service Auth (`non_identity`) con esos tokens: Access no acepta un service token dentro de la política de correos. El proveedor de identidad se configura en la cuenta, no en este repo. En `prod` los dos Workers entran en la misma aplicación. El `aud` de esa aplicación se carga en `POLICY_AUD`.

Noticias (`noticias.enrailar.com`) es otro Worker, Astro + EmDash. En `prod` la app `NewsAdmin` existe antes que el Worker y cubre solo `/_emdash`. El Worker además verifica el JWT de Access. En un preview `/_emdash` responde 403. El detalle, el secreto `EMDASH_ENCRYPTION_KEY` y el modelo de contenido están en [`news-cms.md`](news-cms.md).

## State

El stack usa `Cloudflare.state()`. El primer `alchemy deploy` o `alchemy plan` de una cuenta nueva quiere bootstrapear el state store. Eso también es un despliegue: no lo corras sin los secretos y sin intención de crear recursos. `.alchemy/` está en `.gitignore`.
