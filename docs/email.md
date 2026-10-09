# Correo

Tres casillas de rol: `hola@enrailar.com`, `hackatrain@enrailar.com` y `prensa@enrailar.com`. El resto se descarta en el catch-all de Email Routing, y solo en el stage `prod`.

## Entrada

`workers/email-in` recibe el mensaje de Email Routing.

1. Rechaza si `FORWARD_TO` está vacío o si el sobre no es una de esas tres casillas.
2. Manda el MIME crudo al inbox por el service binding `INBOX`, a `POST /internal/inbound`.
3. Reenvía con `message.forward()` al valor de `FORWARD_TO`.

Ese valor es un binding secreto de Alchemy. Tiene que ser una dirección ya verificada en Email Routing de la cuenta. Sin esa verificación Cloudflare rechaza el reenvío. Sirve para que un buzón externo lea la copia. El valor no está en el repo.

El worker no escribe direcciones en los logs. Si el inbox no acepta el mensaje, no lo reenvía: Email Routing puede reintentar. El id del objeto es el SHA-256 del MIME, así un reintento pisa la misma fila.

## Inbox

`apps/inbox` guarda el raw en R2 (`raw/<sha256>`) y una fila en D1 (`inbound_messages`: buzón de rol, asunto, tamaño, fecha). No hay columna de remitente. El sobre del remitente queda solo dentro del objeto.

También escribe `mailboxes/<casilla>.json` en el mismo R2. Es la marca que [agentic-inbox](https://github.com/cloudflare/agentic-inbox) (`48039bb6785af34e592c2966f87cde2b255c4c80`) exige para no ignorar el correo. El campo `forwarding.email` de esa marca queda vacío: el reenvío lo hace `email-in`, no esa app.

La UI, los Durable Objects (`MailboxDO`, `EmailAgent`, `EmailMCP`) y Workers AI de agentic-inbox no están vendidos en este repo. Su entrypoint importa `virtual:react-router/server-build` y se despliega con Wrangler. Acá la única definición de despliegue es Alchemy, así que el inbox propio cubre guardar y leer, y deja esa marca en R2 para un reemplazo posterior del Worker `Inbox`.

Cloudflare Access ya cubre el Worker `Inbox` y el de admin: pasa una identidad de `enrailar.com`. El service binding no atraviesa Access, por eso `email-in` puede publicar en `/internal/inbound`. El tráfico público de ese path sí queda detrás de Access.

## Salida

`workers/email-out` consume la cola `Mail`. Hoy el único trabajo es `newsletter.confirm`: arma un texto plano desde `hola@enrailar.com` con `List-Unsubscribe` y `List-Unsubscribe-Post` apuntando a la baja en un clic de la API. No loguea el destinatario. Un cuerpo que no cumple el esquema se confirma y se descarta. Si falta `PUBLIC_API_ORIGIN`, reintenta.

En `prod`, Alchemy setea `PUBLIC_API_ORIGIN` en `https://api.enrailar.com`. En `preview` y `pr-N` queda vacío: la cola reintenta y termina en la dead letter. Alchemy `2.0.0-beta.81` no deja pasar `worker.url` (puede ser `undefined`) como binding de texto. Cuando haga falta probar el boletín en un preview, hay que completar ese origen con la URL pública del Worker de la API.

Enviar a suscriptores arbitrarios depende de que Email Sending de la cuenta permita destinos que no estén verificados uno por uno. `SendEmail` de Alchemy no fija una lista de destinos, justamente para no commitear direcciones. Si la cuenta igual exige destinos verificados, la confirmación del boletín no sale hasta resolver eso en el dashboard.
