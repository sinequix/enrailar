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

## Secretos

Los valores no van en el repositorio, ni en ejemplos, ni en logs. [`.env.example`](../.env.example) solo tiene el nombre, vacío. Cargalos en el entorno del que corre Alchemy (la shell local o los secretos del repositorio en GitHub).

| Nombre | Dónde se usa |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Credencial del provider. Alchemy la lee del entorno. |
| `CLOUDFLARE_ACCOUNT_ID` | La misma credencial. |
| `ALCHEMY_PASSWORD` | Nombre reservado. Alchemy `2.0.0-beta.81` no lo lee: la clave del state store la crea el bootstrap en el Secrets Store de Cloudflare. |
| `FORWARD_TO` | Binding secreto de `email-in`. El worker hace `message.forward` a ese destino. |
| `ACCESS_ALLOWED_EMAILS` | Lista separada por comas. La política de Access deja pasar el dominio `enrailar.com` y, además, estas direcciones. Vacía, solo queda el dominio. El valor no se escribe en el repo. |
| `POLICY_AUD` | Binding secreto del inbox. Es el `aud` de la aplicación de Access que crea Alchemy, leído del entorno. |
| `TEAM_DOMAIN` | Binding secreto del inbox. URL del equipo de Access, o la URL completa de los certificados. Sale de la organización de Zero Trust que ya existe en la cuenta. |

`FORWARD_TO` tiene que ser una dirección ya verificada en Email Routing de la cuenta. Sin esa verificación, Cloudflare rechaza el reenvío. El binding existe para que un buzón externo (por ejemplo un cliente de correo) reciba copia de `hola@`, `hackatrain@` y `prensa@enrailar.com`. El valor no se escribe en la definición ni en un recurso `Email.Address`.

El sitekey de Turnstile es público y sale del recurso. El secret también: Alchemy lo expone como `turnstile.secret` (`Redacted`) y el Worker de la API lo recibe como binding. No hace falta un `TURNSTILE_SECRET_KEY` en el entorno. Los hostnames del widget son `enrailar.com` (cubre subdominios) y `localhost`. Un preview en `workers.dev` no está en esa lista: hay que sumar el hostname al widget antes de probar el formulario ahí.

## Qué queda apuntando a stubs

La API, el inbox, los workers de correo y la web ya tienen entrypoint propio. La web es `Cloudflare.Website.Vinext` sobre `apps/web`. El inbox es `Cloudflare.Website.Vite` sobre `apps/inbox` (`main: workers/app.ts`). Antes de `alchemy deploy`, `npm ci --prefix apps/inbox`: ese paquete no está en el workspace de pnpm y trae su propio lockfile. Ese `npm ci` no corre Wrangler. El admin sigue en `infra/stubs/`. Las tablas de D1 salen de `apps/api/migrations`. El detalle del correo está en [`email.md`](email.md) y el del inbox en [`inbox.md`](inbox.md).

`NEXT_PUBLIC_API_ORIGIN` y `NEXT_PUBLIC_TURNSTILE_SITE_KEY` son públicas. En [`.env.example`](../.env.example) quedan vacías. Si el origen no está, el formulario apunta a `https://api.enrailar.com`. La clave de Turnstile es el sitekey del widget, no el secret.

La web manda una sola ficha a `POST /v1/sumate`. Cada opción queda como una intención en D1 (`submissions` y `submission_intents`). Si una de ellas es el boletín, el doble opt-in sigue por `newsletter.confirm`, igual que `POST /v1/newsletter`. Las rutas `POST /v1/preinscripcion`, `POST /v1/contacto` y `POST /v1/newsletter` siguen aceptando el contrato anterior. `0003_submissions.sql` copia las fichas ya guardadas y no borra las tablas de origen.

### Cómo llega el sitekey de Turnstile a la web

Alchemy declara el binding `TURNSTILE_SITE_KEY` en el Worker de la web (`Cloudflare.Website.Vinext("Web", { env: { TURNSTILE_SITE_KEY: turnstile.sitekey } })`). La web no lo recibe en el build: `vite build` corre sin ese valor, y en `vinext` solo las variables `NEXT_PUBLIC_*` presentes en el entorno del build se inlinean. Por eso la página lo lee en tiempo de request con `process.env.TURNSTILE_SITE_KEY` ([`apps/web/src/turnstile.ts`](../apps/web/src/turnstile.ts)): con `nodejs_compat` y fecha de compatibilidad posterior a `2025-04-01`, el runtime de Workers puebla `process.env` con los bindings de texto. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` queda como alternativa para desarrollo local.

Si una página se sirviera prerenderizada (hoy `vinext()` no tiene `prerender` activado), el HTML no tendría la clave. Para ese caso el cliente la pide una vez a `GET /api/turnstile` ([`apps/web/app/api/turnstile/route.ts`](../apps/web/app/api/turnstile/route.ts)), una ruta `force-dynamic` sin caché que lee el mismo binding. El mensaje «Falta la clave pública de Turnstile en este entorno» solo aparece cuando ninguna de las dos vías devuelve un valor.

## Access

`inbox` y `admin` exigen Cloudflare Access. La política deja pasar identidades del dominio `enrailar.com` y las direcciones de `ACCESS_ALLOWED_EMAILS`. El proveedor de identidad se configura en la cuenta, no en este repo. En `prod` los dos Workers entran en la misma aplicación. El `aud` de esa aplicación se carga en `POLICY_AUD`.

## State

El stack usa `Cloudflare.state()`. El primer `alchemy deploy` o `alchemy plan` de una cuenta nueva quiere bootstrapear el state store. Eso también es un despliegue: no lo corras sin los secretos y sin intención de crear recursos. `.alchemy/` está en `.gitignore`.
