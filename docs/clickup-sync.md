# Sync ClickUp ↔ GitHub

El espacio de ClickUp Enrailar (`90177904660`) es donde se planifica. Solo las
listas y carpetas de la allowlist tienen un issue en `sinequix/enrailar`. El
resto se salta. Desde que ese issue existe, GitHub manda el estado, el asignado,
las labels y las PR vinculadas.

No hay servidor propio ni un token nuevo de GitHub. Los workflows usan
`GITHUB_TOKEN` y el secreto `CLICKUP_API_TOKEN`.

## Dirección

| Momento                        | Quién manda | Qué pasa                                                                                                                      |
| ------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| La tarea no tiene issue        | ClickUp     | Se crea el issue: título, descripción en Markdown, tags, prioridad, link a la tarea y el marcador `<!-- clickup:TASK_ID -->`. |
| El issue ya existe             | GitHub      | Estado, asignados, labels y PRs se reflejan en la tarea. Un cambio de título o descripción en ClickUp no pisa el issue.       |
| Título o descripción distintos | ClickUp     | Un comentario avisa que el issue es la fuente de verdad.                                                                      |
| Comentarios de GitHub          | —           | No se copian. El vínculo queda en la tarea.                                                                                   |

La descripción de una tarea permitida se publica en el issue. En este
repositorio público no van nombres de personas, correos ni montos. Nada del CRM
se publica: ver [Privacidad](#privacidad).

## Mapeo de estados

El código está en `scripts/clickup-sync/state.ts`. Elige el primer estado que
exista en la lista, sin distinguir mayúsculas.

| Situación en GitHub                                                                            | Estado que busca en ClickUp                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Issue abierto, sin PR abierta                                                                  | `to do`, o el equivalente abierto de la lista: `por hacer`, `idea`, `planificada`, `identificado`, `pendiente`, `objetivo`, `detectada`, `preinscripto`. Si el nombre no está en la lista, el estado de tipo `open`. |
| Issue abierto, con una PR abierta que lo menciona o que aparece en el timeline (también draft) | `in progress`, `en curso`, `pr abierto`, `en preparación`, `priorizada` o `asignada a agente`                                                                                                                        |
| PR mergeada y el issue está en `closingIssuesReferences` de esa PR, sin otra PR abierta        | `complete`, `hecha`, `mergeada`, `publicado`, `listo`, `comunicada`, `participó` o `cerrada`. Si ninguno está, el primer estado de tipo `done`, o el único `closed` que no sea un descarte.                          |
| Issue cerrado como completed                                                                   | Los mismos nombres de cierre de la fila anterior.                                                                                                                                                                    |
| Issue cerrado como not planned o duplicate                                                     | `cancelled`, `closed`, `descartada`, `descartado`, `no avanza`, `no comunicable`, `no contactar` o `perdida`                                                                                                         |

Una PR abierta deja la tarea en progreso si el título o el cuerpo mencionan `#N`
(o `owner/repo#N`) o si el timeline del issue tiene un evento `cross-referenced`
o `connected` hacia esa PR. También cuenta un draft. Esa mención, y ese
cross-reference, no completan la tarea: si la PR se mergea sin más, el issue
sigue abierto y la tarea vuelve al estado de pendiente.

La tarea pasa a hecha por una PR solo cuando GitHub lista el issue en
`closingIssuesReferences` de esa PR y la PR está mergeada. Eso es lo que
escriben `Closes`, `Fixes` o `Resolves` (en el cuerpo de la PR o en el mensaje
del commit). Una PR cerrada sin merge no cuenta: no la deja en progreso ni la
completa. Si queda una PR abierta y otra ya mergeada que sí cierra el issue,
sigue en progreso.

Al importar una tarea que ya está cerrada en ClickUp, el issue nace cerrado:
`complete`, `hecha` o `mergeada` como completed; `cancelled`, `closed` o
`descartada` como not planned.

Cada lista puede tener su propio set. La de propuestas sigue en `to do` /
`complete`. Marketing y agentes usan nombres en español (`idea`, `planificada`,
`identificado`, `por hacer`, `mergeada`, `hecha`, …). El nombre se compara sin
distinguir mayúsculas y tiene que coincidir con el tipo: un `activo` de tipo
`done` no cuenta como pendiente. Si no hay un nombre conocido, el pendiente cae
al estado `open` y el cierre al estado `done`.

La sync no crea estados. Si el estado buscado no está en la lista, la tarea no
cambia de estado y el comentario de sync lo dice. Un fallo al leer o escribir
una tarea no cambia el estado que se informa de las demás.

## Issues y subtareas

Cada subtarea es su propio issue, con el mismo marcador. Se intenta colgarla
como sub-issue de GitHub. Si ya es sub-issue de ese padre, GitHub responde 422
(`duplicate sub-issues` / `only have one parent`) y la sync lo toma como hecho.
Si una subtarea falla de verdad, se anota esa tarea y se sigue con las demás. Si
la API no permite sub-issues, el issue padre lleva un checklist entre
`<!-- clickup-subtasks:start -->` y `<!-- clickup-subtasks:end -->`.

Labels del issue nuevo:

- `clickup`
- una label por tag de ClickUp
- `priority/urgent`, `priority/high`, `priority/normal` o `priority/low`, según
  la prioridad 1–4

Esas labels están declaradas en [`.github/labels.json`](../.github/labels.json).
Si falta alguna al crear el issue, el workflow la crea.

Después, las labels del issue (salvo `clickup`, `priority/*`, `agent:*` y
`needs:human`) vuelven como tags de la tarea. `priority/*` actualiza la
prioridad. Quitar esa label no la borra en ClickUp: la API espera un entero y no
un valor vacío.

Un issue que nace abierto lleva también `agent:plan`. El flujo de plan, revisión
e implementación está en [agent-workflow.md](agent-workflow.md). El mapeo de
estados de esta página no cambia.

## Link de vuelta

Si la tarea tiene un custom field de texto o URL llamado `GitHub`, ahí se guarda
la URL del issue. Hoy ese campo no existe en el espacio ni en la lista. En ese
caso hay un solo comentario `clickup-sync:github` (se actualiza, no se duplica)
y el link queda al final de la descripción.

## Idempotencia

Antes de crear un issue se listan los issues del repo, con paginación, y se
busca el marcador en el cuerpo. Si está, no se crea otro. El mismo id en la
misma corrida tampoco se crea dos veces.

El marcador del issue no es el único vínculo. `tombstones.json` guarda pares
`taskId` / número de issue. Al crear un issue, la tarea recibe un comentario
`clickup-sync:tombstone` que solo lleva la URL. También cuentan la URL de este
repo en la descripción, en el custom field `github` o en un comentario. Si ese
issue está cerrado, fue borrado o ya no tiene el marcador, la tarea queda como
lápida: no se crea otro issue y no se copia la descripción de ClickUp al issue.

Las listas salen de `GET /space/{id}/list` y de las carpetas del espacio. Solo
entran a GitHub las de la allowlist que no caen en el filtro de privacidad. Las
tareas se piden de a 100 (`page`), con subtareas y cerradas, hasta una página
corta o `last_page`. De una lista denegada solo se cuentan ids: no se crea el
issue ni se escribe el vínculo de vuelta.

Los dos workflows comparten el grupo de concurrencia `clickup-github-sync`, sin
cancelar el que ya corre, para no crear dos issues de la misma tarea.

## Privacidad

Nada del CRM llega a GitHub. La sync es fail closed: sin allowlist explícita no
se publica, y un motivo de denegación gana aunque la lista esté permitida. La
denegación también corta el camino inverso: no se crea el issue, no se cuelga
como sub-issue, no se escribe la URL de GitHub en la tarea y no se agregan
comentarios de sync ni de orquestación.

Allowlist, sin secretos, en
[`scripts/clickup-sync/allowlist.json`](../scripts/clickup-sync/allowlist.json).
Una entrada puede llevar `name`, `id`, o los dos. El nombre se compara sin
mayúsculas y sin distinguir `·`, `-` o `↔`. Vale igual si es lista o carpeta:
una carpeta permitida publica sus listas, salvo las denegadas.

Hoy los nombres permitidos son los de trabajo público que ya tenían issues:
`Producto↔Marketing`, `Cursor · Agentes`, `Propuesta Trenes Tandil` y
`Marketing`. Los ids numéricos de esas listas no están en el repo; se agregan en
el JSON cuando se confirman. Dos variables de entorno suman ids, no sacan
denegaciones:

| Variable                     | Qué suma                           |
| ---------------------------- | ---------------------------------- |
| `CLICKUP_SYNC_ALLOWLIST`     | ids de lista, separados por coma   |
| `CLICKUP_SYNC_ALLOW_FOLDERS` | ids de carpeta, separados por coma |

Denegación fija, en código. No se puede anular con el JSON ni con el entorno.

| Motivo            | Qué cubre                                                                                                                                                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deny-list`       | Cuentas `901717736443`, Contactos `901717736444`, Alianzas y sponsors `901717736445`, Voluntarios y Hackatrain `901717736446`. También una lista llamada `Contactos` o `Contactos y contexto`, aunque el id sea otro.                                            |
| `deny-folder`     | La carpeta CRM (el nombre es `crm`), una carpeta llamada `Contactos` o `Contactos y contexto`, y cualquier carpeta que contenga una lista CRM. Una lista nueva ahí también se salta.                                                                             |
| `deny-task`       | La tarea `86e3nbvhz`. Su id de lista no quedó en el issue después de retirar el cuerpo, así que se niega en cualquier lista.                                                                                                                                     |
| `deny-tag`        | Etiquetas `voluntario`, `contacto` o `lead`                                                                                                                                                                                                                      |
| `deny-fuente`     | Custom field `fuente` o `source` en `sumate`, `email` (el alta de `hola@`) o `hola@`. También las etiquetas `fuente-sumate`, `fuente-email` y `fuente-hola`.                                                                                                     |
| `deny-content`    | En una lista permitida, un correo cuyo dominio no es `enrailar.com` ni `sinequix.com` (los subdominios de esos dos sí pasan), el nombre o la frase `contactos y contexto`, o una línea que es solo `Contactos`. Una frase como "contactos de prensa" no alcanza. |
| `tombstone`       | La tarea ya tuvo issue. El vínculo está en `tombstones.json` o en la tarea, y el issue no se vuelve a crear.                                                                                                                                                     |
| `not-allowlisted` | Cualquier otra lista o carpeta                                                                                                                                                                                                                                   |

`email` es el valor que escribe el worker de `hola@`. No es una dirección.

El log de cada corrida imprime cantidades, no personas:

```text
skipped deny-list=0 deny-folder=0 deny-task=0 deny-tag=0 deny-fuente=0 deny-content=0 tombstone=0 not-allowlisted=0
```

`deny-task`, `deny-content` y `tombstone` también dejan una línea
`task=<id> skipped reason=<motivo>`. Esa línea no lleva nombre, correo, ciudad,
título ni cuerpo. El resto de los motivos solo suma en el contador.

Un issue que ya se haya publicado queda fuera de esta sync: no se borra ni se
actualiza desde una tarea denegada, y una lápida no lo republica.

Sumate y el correo a `hola@` siguen guardando la ficha en ClickUp y en D1. El
título y la descripción de esas tareas no llevan perfil, lugar, intenciones, id
de ficha, asunto ni cuerpo. Eso queda en un comentario con `notify_all` en
falso. La web no abre issues. Los logs de la API y de `email-in` anotan la ruta
y el id del registro, no el formulario.

## Personas

[`scripts/clickup-sync/user-map.json`](../scripts/clickup-sync/user-map.json)
mapea por id de ClickUp o por username, y por login de GitHub. No lleva correos.
Una entrada con `@` o con un campo de email se ignora.

```json
{
  "users": [
    {
      "clickupUserId": "123456",
      "clickupUsername": "usuario-clickup",
      "githubLogin": "usuario-github"
    }
  ]
}
```

No hay pares confirmados. El archivo del repo tiene `users` vacío. Sin par, el
issue se crea sin esa persona y la tarea no pierde asignados que el mapa no
conoce. El log usa el id de ClickUp o el login de GitHub, no el nombre.

## Workflows

`clickup-sync.yml` corre cada 5 minutos y con `workflow_dispatch` (input
`dry_run`). Lee ClickUp y crea los issues que faltan. En los que ya existen,
vuelve a aplicar el estado de GitHub sobre la tarea, así un cambio de label o de
asignado no depende de un evento que no escuchamos.

`github-to-clickup.yml` corre en `issues` (`opened`, `closed`, `reopened`) y en
`pull_request` (`opened`, `closed`, `reopened`, `ready_for_review`). No escucha
`issue_comment`. Actualiza solo la tarea cuyo issue tiene el marcador.

Permisos del workflow que escribe issues: `issues: write`,
`pull-requests: read`, `contents: read`. El otro solo lee.

Si `CLICKUP_API_TOKEN` no está, el proceso imprime un aviso y termina en cero.
No rompe el CI. El schedule de GitHub solo corre desde `main`, después del
merge.

Al crear un issue abierto, si existe `AGENT_MENTION_TOKEN`, la misma corrida
publica la mención de plan. Un issue creado con `GITHUB_TOKEN` no dispara otro
workflow. Si ese secreto no está, la sync avisa y sigue: el issue queda con
`agent:plan` y la mención espera a que el secreto exista.

El script también acepta `--dry-run`: lee y no escribe.

## Rate limit

ClickUp Business permite 100 requests por minuto por token. El cliente se queda
en 90 y, ante un 429, espera hasta el Unix timestamp de `X-RateLimit-Reset` (más
250 ms, con un tope de 90 s) y reintenta.

## Cerrar la tarea

La plantilla de PR pide `Closes #N`. Al mergear, GitHub cierra el issue como
completed y la sync marca la tarea `complete`.
