# Correo

Tres casillas de rol: `hola@enrailar.com`, `hackatrain@enrailar.com` y `prensa@enrailar.com`. El resto se descarta en el catch-all de Email Routing, y solo en el stage `prod`.

## Entrada

`workers/email-in` recibe el mensaje de Email Routing.

1. Rechaza si `FORWARD_TO` está vacío o si el sobre no es una de esas tres casillas.
2. Asegura en R2 la marca `mailboxes/<casilla>.json` de las tres casillas de rol. `forwarding.email` queda vacío: el reenvío no lo hace esa marca.
3. Llama a `receiveEmail` de agentic-inbox. Ese código escribe en el Durable Object `MailboxDO` del inbox (binding cruzado `MAILBOX`) y avisa a `EmailAgent`.
4. Reenvía con `message.forward()` al valor de `FORWARD_TO`.

Ese valor es un binding secreto de Alchemy. Tiene que ser una dirección ya verificada en Email Routing de la cuenta. Sin esa verificación Cloudflare rechaza el reenvío. Sirve para que un buzón externo lea la copia. El valor no está en el repo.

El worker no escribe direcciones en los logs. Si la entrega al Durable Object tira, no reenvía: Email Routing puede reintentar. `receiveEmail` elige el buzón por el destinatario del MIME, no por el sobre, y solo si está en `EMAIL_ADDRESSES`.

## Inbox

`apps/inbox` es [agentic-inbox](https://github.com/cloudflare/agentic-inbox) en el commit `48039bb6785af34e592c2966f87cde2b255c4c80`, bajo Apache-2.0. El detalle de licencia y de por qué no entra al workspace de pnpm está en [`inbox.md`](inbox.md).

El inbox propio (R2 `raw/<sha256>` y la tabla D1 `inbound_messages`) salió con ese reemplazo. La migración `0002_inbound.sql` sigue en `apps/api/migrations` porque borrar una migración ya aplicada no es lo que hace Alchemy en un stage nuevo: un stage nuevo igual la corre. Esa tabla no la usa agentic-inbox.

Alchemy despliega ese árbol con `Cloudflare.Website.Vite`: bundle de React Router, Worker con assets, Durable Objects `MailboxDO` y `EmailAgent` (y `EmailMCP` para `/mcp`), R2 y Workers AI. Access cubre el Worker, o sea la UI y el MCP. El detalle está en [`inbox.md`](inbox.md).

`email-in` no usa un service binding HTTP. El binding `MAILBOX` apunta a la clase `MailboxDO` del script del inbox, y `EMAIL_AGENT` a `EmailAgent`. Comparten el mismo R2.

## Salida

`workers/email-out` consume la cola `Mail`. Hoy el único trabajo es `newsletter.confirm`: arma un texto plano desde `hola@enrailar.com` con `List-Unsubscribe` y `List-Unsubscribe-Post` apuntando a la baja en un clic de la API. No loguea el destinatario. Un cuerpo que no cumple el esquema se confirma y se descarta. Si falta `PUBLIC_API_ORIGIN`, reintenta.

En `prod`, Alchemy setea `PUBLIC_API_ORIGIN` en `https://api.enrailar.com`. En `preview` y `pr-N` queda vacío: la cola reintenta y termina en la dead letter. Alchemy `2.0.0-beta.81` no deja pasar `worker.url` (puede ser `undefined`) como binding de texto. Cuando haga falta probar el boletín en un preview, hay que completar ese origen con la URL pública del Worker de la API.

Enviar a suscriptores arbitrarios depende de que Email Sending de la cuenta permita destinos que no estén verificados uno por uno. `SendEmail` de Alchemy no fija una lista de destinos, justamente para no commitear direcciones. Si la cuenta igual exige destinos verificados, la confirmación del boletín no sale hasta resolver eso en el dashboard.
