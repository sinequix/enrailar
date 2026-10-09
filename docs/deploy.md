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

```bash
pnpm exec alchemy deploy --config infra/alchemy.run.ts --stage preview
pnpm exec alchemy deploy --config infra/alchemy.run.ts --stage prod
pnpm exec alchemy destroy --config infra/alchemy.run.ts --stage pr-12
```

`alchemy destroy` de `prod` no entra en el workflow de CI.

## Secretos

Los valores no van en el repositorio, ni en ejemplos, ni en logs. [`.env.example`](../.env.example) solo tiene el nombre, vacío. Cargalos en el entorno del que corre Alchemy (la shell local o los secretos del repositorio en GitHub).

| Nombre | Dónde se usa |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Credencial del provider. Alchemy la lee del entorno. |
| `CLOUDFLARE_ACCOUNT_ID` | La misma credencial. |
| `ALCHEMY_PASSWORD` | Nombre reservado. Alchemy `2.0.0-beta.81` no lo lee: la clave del state store la crea el bootstrap en el Secrets Store de Cloudflare. |
| `TURNSTILE_SECRET_KEY` | Binding secreto del Worker de la API (`Config.Redacted`). Tiene que ser el secret del widget de Turnstile de ese stage. |
| `FORWARD_TO` | Binding secreto de `email-in`. El worker hace `message.forward` a ese destino. |

`FORWARD_TO` tiene que ser una dirección ya verificada en Email Routing de la cuenta. Sin esa verificación, Cloudflare rechaza el reenvío. El binding existe para que un buzón externo (por ejemplo un cliente de correo) reciba copia de `hola@`, `hackatrain@` y `prensa@enrailar.com`. El valor no se escribe en la definición ni en un recurso `Email.Address`.

El sitekey de Turnstile es público y sale del recurso. El secret no. Los hostnames del widget son `enrailar.com` (cubre subdominios) y `localhost`. Un preview en `workers.dev` no está en esa lista: hay que sumar el hostname al widget antes de probar el formulario ahí.

## Qué queda apuntando a stubs

La API ya no es un stub: su entrypoint es `apps/api/src/worker.ts` y las tablas de D1 salen de `apps/api/migrations`. El inbox, la web y los workers de correo siguen en `infra/stubs/` hasta sus propios cambios.

## Access

`inbox` y `admin` exigen Cloudflare Access. La política deja pasar identidades del dominio `enrailar.com`. El proveedor de identidad se configura en la cuenta, no en este repo.

## State

El stack usa `Cloudflare.state()`. El primer `alchemy deploy` o `alchemy plan` de una cuenta nueva quiere bootstrapear el state store. Eso también es un despliegue: no lo corras sin los secretos y sin intención de crear recursos. `.alchemy/` está en `.gitignore`.
