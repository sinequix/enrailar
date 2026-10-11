# Auth

La sesión vive en el mismo origen que el sitio. Better Auth 1.7 corre dentro del Worker de la web (`apps/web/worker/index.ts`) en `/api/auth/*` y guarda las cuentas en el D1 que Alchemy ya migra desde `apps/api/migrations`.

## Por qué esta pieza y no otra

Better Auth 1.5+ acepta el binding D1 directamente (`database: env.DB`). El dialecto oficial usa `batch()` porque D1 no tiene transacciones interactivas. No hace falta el paquete de terceros `better-auth-cloudflare`, que arma su propia sesión y no coincide con el D1 que ya declara Alchemy.

Tampoco va en el Worker de la API Express. `api.enrailar.com` es otro origen. Una cookie con `Domain=.enrailar.com` llegaría también a `api`, `inbox` y `admin`. La cookie de sesión es host-only: `HttpOnly`, `Secure` en HTTPS, `SameSite=Lax`, sin atributo `Domain`. En `www` y en el ápice cada host tiene la suya.

Un Worker `auth.enrailar.com` repetiría el problema de origen cruzado. El handler de vinext sigue sirviendo el sitio; solo `/api/auth` entra a Better Auth.

Passkeys y TOTP usan los plugins oficiales `passkey` (`@better-auth/passkey`) y `twoFactor`. El `rpID` en producción es `enrailar.com`. En un preview de `workers.dev` o en localhost es el host de esa request, porque WebAuthn no acepta un rpID de otro sitio.

## Flujo

1. Registro con correo y contraseña (mínimo 12). El cuerpo trae `consentAt`, un instante ISO de los últimos diez minutos. Sin eso no se crea la cuenta. Es el registro del consentimiento de la Ley 25.326: se guarda el instante, no el texto legal ni otros datos de más. El nombre, si no viene, queda en `cuenta`.
2. Turnstile en el registro y en la recuperación (`x-turnstile-token` o `turnstileToken`). El login no lo pide.
3. El alta y la recuperación encolan `auth.verify` y `auth.reset` en la cola de `email-out`. El enlace usa el origen del sitio, no el de la API. El log de la cola no escribe el destinatario ni el token.
4. Hasta verificar el correo no hay sesión. La verificación pide `/{locale}/cuenta/verificar?token=`.
5. Passkey (WebAuthn) y TOTP con códigos de respaldo. El plugin `twoFactor` guarda el secreto y los códigos en D1.
6. Un login completo anota `auth.login` en `audit_events`, con el id de la cuenta. Si el segundo factor todavía está pendiente, esa fila no se escribe. Un 401 o 403 de login anota `auth.login_failed` con `record_id` `anonymous`. Activar TOTP anota `auth.two_factor_on`. Desactivarlo, `auth.two_factor_off`. Un cambio de rol anota `auth.role` una sola vez, con el id destino, nunca el correo. También se anotan alta, edición, ban y baja de una cuenta hechas por un admin. La tabla ya es append-only. La impersonación está deshabilitada, así que no hay un campo `impersonatedBy` en la auditoría.
7. Roles: `user` y `admin`. El cliente no elige el rol. Toda alta pública nace `user`, aunque el correo esté en `ADMIN_EMAILS`. Cuando `emailVerified` pasa a verdadero y el correo está en esa lista, la cuenta pasa a `admin`, se borra la contraseña de credencial y se borran las sesiones: hay que pedir un reset. Sacar un correo de la lista no degrada una cuenta ya creada. Un admin no puede cambiarse el rol a sí mismo ni degradar al último admin.
8. `/app` exige sesión. Sin sesión, el Worker responde 303 al ingreso. `/app/admin` exige rol `admin` y que esa sesión se haya abierto con TOTP, código de respaldo o passkey. Tener una passkey registrada no alcanza si la sesión es solo de contraseña. Registrar una passkey pide sesión fresca y 2FA ya activo. `/api/auth/admin/*` responde 403: el plugin no se expone. Las acciones de admin salen por `/api/admin/*`, que llama `decideAccess` y exige `ok` sin mirar el path. Si falta el segundo factor, la decisión es `setup` y el servidor responde 403. El guard corre en el Worker antes de vinext, y otra vez en el loader de cada vista. Ocultar el enlace en el cliente no autoriza.

Límite: 5 intentos cada 10 minutos por ruta y dirección, en un solo `INSERT … ON CONFLICT … RETURNING` de `rate_limits`. Cubre login, registro, verificación de correo, recuperación, reset, cambio de contraseña, passkey y 2FA. Una IPv6 entra por su prefijo `/64`. La IP no se escribe en la auditoría (`disableIpTracking`). Better Auth también limita en memoria por isolate. `trustedOrigins` es solo el origen de la request, y solo si el host es `enrailar.com`, `www.enrailar.com`, o —fuera de prod— localhost o `*.workers.dev`. CSRF queda prendido. No se confía en `x-forwarded-host`. Resetear la contraseña revoca las sesiones.

La migración `0004_auth.sql` crea `user`, `session`, `account`, `verification`, `passkey` y `twoFactor`. `0005_session_factor.sql` agrega `authMethod` a `session`. Ninguna borra ni reescribe tablas anteriores.

## Cabeceras

El Worker agrega CSP, `X-Content-Type-Options`, `Referrer-Policy` y, en HTTPS, HSTS (`max-age=31536000`, sin `includeSubDomains` para no fijar subdominios que todavía no sirven el sitio). `frame-ancestors 'none'`. `script-src` no lleva `'unsafe-inline'`: el script de Sumate entra por su hash sha256, y Turnstile sigue permitido como origen.

## Secretos nuevos para prod

Los carga Jorge en los secretos del entorno de GitHub que usa el workflow de producción. No van al repo ni a un ejemplo con valor.

| Nombre | Para qué |
| --- | --- |
| `BETTER_AUTH_SECRET` | Firma cookies y tokens. Obligatorio para desplegar. `require-secrets.sh` corta si falta. |
| `ADMIN_EMAILS` | Correos, separados por coma, que pasan a `admin` al verificar el correo. Puede ir vacío. No está en `require-secrets.sh`. |

El preview no usa el secreto de prod. Antes de `require-secrets.sh`, el workflow de preview genera un `BETTER_AUTH_SECRET` efímero (`openssl rand -base64 32`), lo enmascara con `::add-mask::` y recién entonces lo escribe en el entorno del job, tanto al desplegar como al destruir el stage `pr-N`. Así el log de los pasos siguientes no imprime el valor. Ese secreto no se commitea. En prod no se genera: el workflow lo lee de `secrets.BETTER_AUTH_SECRET` y lo pasa solo al paso de deploy.

`TURNSTILE_SECRET_KEY` sigue siendo el secreto del widget que Alchemy ya crea. No es un secreto nuevo para cargar a mano.

## Cómo rotar

1. Generar otro secreto de 32 bytes. No reutilizar el de preview.
2. Para no cortar sesiones abiertas, cargar `BETTER_AUTH_SECRETS` con la clave nueva primero y la anterior después (`2:<nuevo>,1:<anterior>`), como documenta Better Auth. Las cookies nuevas salen con la clave nueva. Las viejas todavía verifican.
3. Cuando esas sesiones vencen (7 días) o se revocan, borrar la clave anterior y dejar `BETTER_AUTH_SECRET` en el valor nuevo.
4. Cambiar `BETTER_AUTH_SECRET` de un saque invalida todas las sesiones. Sirve si hay que cortar por un incidente.
5. `ADMIN_EMAILS` se edita en el mismo entorno. No degrada cuentas existentes.

No hace falta rotar `ALCHEMY_PASSWORD` para esto, y este cambio no lo toca.
