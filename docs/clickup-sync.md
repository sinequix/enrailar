# Sync ClickUp ↔ GitHub

El espacio de ClickUp Enrailar (`90177904660`) es donde se planifica. Cada tarea
de cualquiera de sus listas —incluye carpetas y subtareas— tiene un issue en
`sinequix/enrailar`. Desde que ese issue existe, GitHub manda el estado, el
asignado, las labels y las PR vinculadas.

No hay servidor propio ni un token nuevo de GitHub. Los workflows usan
`GITHUB_TOKEN` y el secreto `CLICKUP_API_TOKEN`.

## Dirección

| Momento                        | Quién manda | Qué pasa                                                                                                                      |
| ------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| La tarea no tiene issue        | ClickUp     | Se crea el issue: título, descripción en Markdown, tags, prioridad, link a la tarea y el marcador `<!-- clickup:TASK_ID -->`. |
| El issue ya existe             | GitHub      | Estado, asignados, labels y PRs se reflejan en la tarea. Un cambio de título o descripción en ClickUp no pisa el issue.       |
| Título o descripción distintos | ClickUp     | Un comentario avisa que el issue es la fuente de verdad.                                                                      |
| Comentarios de GitHub          | —           | No se copian. El vínculo queda en la tarea.                                                                                   |

La descripción de la tarea se publica en el issue. En este repositorio público
no van nombres de personas, correos ni montos.

## Mapeo de estados

El código está en `scripts/clickup-sync/state.ts`. Elige el primer estado que
exista en la lista, sin distinguir mayúsculas.

| Situación en GitHub                                                 | Estado que busca en ClickUp           |
| ------------------------------------------------------------------- | ------------------------------------- |
| Issue abierto, sin PR abierta ni PR mergeada que lo referencie      | `to do`                               |
| Issue abierto, con una PR abierta que lo referencia (también draft) | `in progress`                         |
| PR mergeada que lo referencia, o issue cerrado como completed       | `complete`                            |
| Issue cerrado como not planned o duplicate                          | `cancelled`, y si no existe, `closed` |

Una PR referencia al issue si el título o el cuerpo mencionan `#N` (o
`owner/repo#N`) o si GitHub la marca como PR que lo cierra (`Closes`, `Fixes`,
`Resolves`, también en el mensaje del commit). Si hay una PR abierta y otra ya
mergeada, sigue en progreso.

Al importar una tarea que ya está cerrada en ClickUp, el issue nace cerrado:
`complete` como completed, `cancelled` o `closed` como not planned.

### Bloqueo: faltan estados en el espacio

Hoy las listas del espacio solo tienen `to do` (open) y `complete` (closed). No
existen `in progress`, `cancelled` ni `closed`.

La sync no crea estados. Reemplazar el set por la API reescribe el espacio y
puede mover tareas. Si el estado buscado no está en la lista, la tarea no cambia
de estado y el comentario de sync lo dice.

Para completar el mapeo, en la configuración del espacio hay que agregar:

- `in progress`, tipo activo (custom)
- `cancelled`, tipo cerrado, o en su lugar `closed`, tipo cerrado

Con eso el mismo código aplica el mapeo de arriba. No hace falta otro cambio en
el repo.

## Issues y subtareas

Cada subtarea es su propio issue, con el mismo marcador. Se intenta colgarla
como sub-issue de GitHub. Si la API no lo permite, el issue padre lleva un
checklist entre `<!-- clickup-subtasks:start -->` y
`<!-- clickup-subtasks:end -->`.

Labels del issue nuevo:

- `clickup`
- una label por tag de ClickUp
- `priority/urgent`, `priority/high`, `priority/normal` o `priority/low`, según
  la prioridad 1–4

Esas labels están declaradas en [`.github/labels.json`](../.github/labels.json).
Si falta alguna al crear el issue, el workflow la crea.

Después, las labels del issue (salvo `clickup` y `priority/*`) vuelven como tags
de la tarea. `priority/*` actualiza la prioridad. Quitar esa label no la borra
en ClickUp: la API espera un entero y no un valor vacío.

## Link de vuelta

Si la tarea tiene un custom field de texto o URL llamado `GitHub`, ahí se guarda
la URL del issue. Hoy ese campo no existe en el espacio ni en la lista. En ese
caso hay un solo comentario `clickup-sync:github` (se actualiza, no se duplica)
y el link queda al final de la descripción.

## Idempotencia

Antes de crear un issue se listan los issues del repo, con paginación, y se
busca el marcador en el cuerpo. Si está, no se crea otro. El mismo id en la
misma corrida tampoco se crea dos veces.

Las listas salen de `GET /space/{id}/list` y de las carpetas del espacio. Las
tareas se piden de a 100 (`page`), con subtareas y cerradas, hasta una página
corta o `last_page`.

Los dos workflows comparten el grupo de concurrencia `clickup-github-sync`, sin
cancelar el que ya corre, para no crear dos issues de la misma tarea.

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

El script también acepta `--dry-run`: lee y no escribe.

## Rate limit

ClickUp Business permite 100 requests por minuto por token. El cliente se queda
en 90 y, ante un 429, espera hasta el Unix timestamp de `X-RateLimit-Reset` (más
250 ms, con un tope de 90 s) y reintenta.

## Cerrar la tarea

La plantilla de PR pide `Closes #N`. Al mergear, GitHub cierra el issue como
completed y la sync marca la tarea `complete`.
