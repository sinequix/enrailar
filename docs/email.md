# Correo

Tres casillas de rol: `hola@enrailar.com`, `hackatrain@enrailar.com` y `prensa@enrailar.com`. El resto se descarta en el catch-all de Email Routing, y solo en el stage `prod`.

## Entrada

`workers/email-in` recibe el mensaje de Email Routing. No reenvía a terceros: no existe `FORWARD_TO` y el worker no llama a `message.forward()`.

1. Rechaza si el sobre no es una de esas tres casillas, o si el tamaño es cero o pasa de 10 MB.
2. Asegura en R2 la marca `mailboxes/<casilla>.json` de las tres casillas de rol. `forwarding.email` queda vacío.
3. Llama a `receiveEmail` de agentic-inbox. Ese código escribe en el Durable Object `MailboxDO` del inbox (binding cruzado `MAILBOX`) y avisa a `EmailAgent`.
4. Si el sobre es `hola@enrailar.com`, crea o actualiza un contacto en la lista de CRM de ClickUp. `hackatrain@` y `prensa@` se quedan solo en el inbox.

El token (`CLICKUP_API_TOKEN`) es el mismo secreto que usa el Worker de la API. El id de lista de este worker es `CLICKUP_LIST_ID_CONTACTS`, una variable de Actions (`vars.CLICKUP_LIST_ID_CONTACTS`), no un secreto: la lista Contactos, `901717736444`. Sumate usa otra variable, `CLICKUP_LIST_ID_WEB` (`901717736446`, Voluntarios y Hackatrain), en el Worker de la API. No comparten el binding, así que las listas pueden diferir. Los dos workflows de deploy las inyectan y Alchemy las declara como texto en cada recurso. Esas listas están denegadas en la sync a GitHub: el asunto y el cuerpo quedan en un comentario de ClickUp, no en el título ni en la descripción.

La deduplicación es la de `upsertCrmContact` en `@enrailar/shared`: el custom field `email`. El título y la descripción son fijos y no llevan remitente, asunto ni cuerpo. Eso va en un comentario con `notify_all` en falso. `fuente` queda en `email` y la etiqueta es `contacto`. La sync trata esa fuente y esa etiqueta como denegación, aunque la lista estuviera en la allowlist.

Un fallo de ClickUp no rechaza el correo. La copia ya está en el inbox y la ficha queda en D1 (`crm_email_retries`, migración `0007_crm_email_retry.sql`) para reintentar. En `prod` un cron de 15 minutos vuelve a intentar las filas pendientes. Sin token o sin id de lista, tampoco se rechaza: queda la fila hasta que el binding exista.

El worker no escribe direcciones en los logs. Si la entrega al Durable Object tira, Email Routing puede reintentar y no se llama a ClickUp. `receiveEmail` elige el buzón por el destinatario del MIME, no por el sobre, y solo si está en `EMAIL_ADDRESSES`.

## Regla de Email Routing

En `prod`, Alchemy ya crea una regla por casilla de rol. La de `hola@enrailar.com` matchea el destinatario literal y la acción es el Worker `email-in`. El catch-all descarta el resto. No hay que crear esa regla a mano si el stage `prod` está desplegado con este stack. Si el dashboard no la muestra, el deploy de `prod` es el paso que la escribe.

## Inbox

`apps/inbox` es [agentic-inbox](https://github.com/cloudflare/agentic-inbox) en el commit `48039bb6785af34e592c2966f87cde2b255c4c80`, bajo Apache-2.0. El detalle de licencia y de por qué no entra al workspace de pnpm está en [`inbox.md`](inbox.md).

El inbox propio (R2 `raw/<sha256>` y la tabla D1 `inbound_messages`) salió con ese reemplazo. La migración `0002_inbound.sql` sigue en `apps/api/migrations` porque borrar una migración ya aplicada no es lo que hace Alchemy en un stage nuevo: un stage nuevo igual la corre. Esa tabla no la usa agentic-inbox.

Alchemy despliega ese árbol con `Cloudflare.Website.Vite`: bundle de React Router, Worker con assets, Durable Objects `MailboxDO` y `EmailAgent` (y `EmailMCP` para `/mcp`), R2 y Workers AI. Access cubre el Worker, o sea la UI y el MCP. El detalle está en [`inbox.md`](inbox.md).

`email-in` no usa un service binding HTTP. El binding `MAILBOX` apunta a la clase `MailboxDO` del script del inbox, y `EMAIL_AGENT` a `EmailAgent`. Comparten el mismo R2.

## Salida

`workers/email-out` consume la cola `Mail`. El binding `EMAIL` es `send_email` de Email Sending. No usa una API key.

El boletín (`newsletter.confirm`) sale de `hola@enrailar.com`, en HTML y texto plano, con `List-Unsubscribe` y `List-Unsubscribe-Post` apuntando a la baja en un clic de la API. Ese enlace usa `PUBLIC_API_ORIGIN`.

La verificación de cuenta (`auth.verify`) y la recuperación (`auth.reset`) salen de `EMAIL_FROM`. En prod es `no-responder@enrailar.com`, con el nombre visible Enrailar. El `replyTo` es `hola@enrailar.com`: el catch-all de Routing descarta lo que llega a `no-responder@`. Cada mensaje lleva HTML y texto plano, en el idioma de la cuenta. El enlace se arma con `APP_BASE_URL` más `/{locale}/cuenta/verificar` o `/{locale}/cuenta/recuperar`.

No se loguea el destinatario ni el token. Un cuerpo que no cumple el esquema se confirma y se descarta. Si falta `PUBLIC_API_ORIGIN` en el boletín, o `APP_BASE_URL` o `EMAIL_FROM` en la cuenta, el mensaje se reintenta.

En `prod`, Alchemy setea `PUBLIC_API_ORIGIN` en `https://api.enrailar.com`, `APP_BASE_URL` en `https://enrailar.com` y `EMAIL_FROM` en `no-responder@enrailar.com`. En `preview` y `pr-N`, `PUBLIC_API_ORIGIN` y `APP_BASE_URL` quedan vacíos: la cola reintenta y termina en la dead letter. Alchemy `2.0.0-beta.81` no deja pasar `worker.url` (puede ser `undefined`) como binding de texto. Cuando haga falta probar un correo en un preview, hay que completar ese origen con la URL pública del Worker que corresponde.

`EMAIL_FROM` y `APP_BASE_URL` no son secretos. Alchemy los declara. No van en `.env.example`. El binding `EMAIL` permite como remitentes las tres casillas de rol y `no-responder@enrailar.com`. No fija destinos, para no commitear direcciones. Si la cuenta exige destinos verificados uno por uno, el correo no sale hasta resolverlo en el dashboard.

## Verificación obligatoria

`EMAIL_VERIFICATION_REQUIRED` es una variable de texto del Worker de la web. No es un secreto y no está en `require-secrets.sh`. Alchemy la lee del entorno y, si falta, la deja vacía. En [`.env.example`](../.env.example) queda vacía. En los workflows de deploy se pasa como `secrets.EMAIL_VERIFICATION_REQUIRED`: si ese secreto no existe, el valor es vacío.

Vacío, `0` o `false` (el default): el alta no bloquea el ingreso. El worker igual intenta encolar `auth.verify` y `auth.reset`. Si falta el binding de la cola, o `send` tira porque Email Sending no está activo, el alta y la recuperación responden igual: se loguea `{ "status": "mail-skipped" }` y se sigue. Ese log no lleva destinatario, token ni el texto del error.

`1`, `true` o `yes`: hay que verificar el correo antes de ingresar. Un fallo al encolar el correo se propaga como hasta ahora.

## DNS

Email Routing (entrada) y Email Sending (salida) se onboarded por separado. En `prod`, Alchemy adopta o crea estos registros del ápice. Las prioridades de los MX son las que ya publica la zona, para no duplicarlas:

| Registro | Nombre | Valor |
| --- | --- | --- |
| MX | `@` | `route1.mx.cloudflare.net` prioridad 97, `route2.mx.cloudflare.net` prioridad 98, `route3.mx.cloudflare.net` prioridad 77 |
| TXT SPF | `@` | `v=spf1 include:_spf.mx.cloudflare.net ~all`. Uno solo. No se agrega un segundo SPF en el ápice. |
| TXT DMARC | `_dmarc` | `v=DMARC1; p=none; rua=mailto:hola@enrailar.com` |

Si Email Routing dejó esos MX o el SPF bloqueados, hay que abrirlos en Email Routing → Settings antes del deploy que los adopta. El contenido declarado es el que ya está en la zona. DMARC no estaba: este stack lo crea en `p=none`.

### DKIM y Email Sending

La clave DKIM no se copia a este repo. La pone el onboarding y el registro queda bloqueado.

| Uso | Nombre | Qué pasa |
| --- | --- | --- |
| DKIM de Routing | `cf2024-1._domainkey` | Ya lo publicó Email Routing. No se declara en Alchemy. |
| MX de Sending | `cf-bounce` | Hacia `route1.mx.cloudflare.net`, `route2.mx.cloudflare.net` y `route3.mx.cloudflare.net`. Los crea el onboarding de Email Sending. |
| TXT SPF de Sending | `cf-bounce` | `v=spf1 include:_spf.mx.cloudflare.net ~all`. Distinto del SPF del ápice. |
| TXT DKIM de Sending | `cf-bounce._domainkey` | Firma de salida. El selector y la clave los administra Cloudflare al onboarded Email Sending. |

`enrailar.com` tiene que estar onboarded en Email Sending antes del primer envío. Si ese onboarding quiere reescribir `_dmarc`, se deja el valor de esta tabla (`p=none` y `rua` a `hola@enrailar.com`) hasta mirar los reportes. No se mezcla el DKIM de Routing con el de Sending.
