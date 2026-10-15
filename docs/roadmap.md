# Roadmap Enrailar — gestión de infraestructura ferroviaria

_Actualizado: 13 oct 2026._

## 1. Estado actual (prod, enrailar.com)

- Monorepo en Cloudflare con Alchemy: `apps/web` (vinext/React en Workers), `apps/api` (Express en Worker, `api.enrailar.com`), `apps/inbox` (inbox agéntico), workers `email-in` / `email-out`, D1, Queues (Mail, Audit + DLQ), R2, Turnstile.
- Sitio público ES/EN, Sumate, blog, footer Sinequix; stack de estilos (#36–#45) desplegado.
- Auth: Better Auth en el Worker de la web (`/api/auth/*`), correo+contraseña con verificación obligatoria, Turnstile en alta/recuperación, TOTP + passkeys, roles `user`/`admin`, `/app` y `/app/admin` (admin exige 2FA), auditoría append-only, rate limit en D1.
- CI: `ci` requerido, preview por PR, CodeQL, gitleaks, deploy a `production` con aprobación; ClickUp⇄GitHub y ciclo @cursor/tebabot.
- Conocido: el envío de correos transaccionales (verificación/reset) depende de `send_email` y Email Sending de Cloudflare en `enrailar.com` todavía no está configurado (ver §2).

## 2. Fase 0 — Endurecer auth/RBAC (1 semana)

| Tarea | Estimación |
| --- | --- |
| Habilitar Cloudflare Email Sending (SPF/DKIM/DMARC en enrailar.com) o proveedor transaccional; alerta sobre la DLQ `MailDeadLetter` | 1 d |
| Test e2e real de alta → verificación → reset → TOTP → `/app/admin` (Playwright con Turnstile test keys en preview) | 1 d |
| Roles finos: `viewer`, `operator`, `editor`, `admin` + permisos por recurso (línea/red) con el `ac` del plugin admin | 2 d |
| Panel de usuarios: invitaciones, ban, revocar sesiones, ver auditoría | 1 d |
| Observabilidad: Workers Logs/Logpush, métricas de login fallido, alertas | 0.5 d |

## 3. Fase 1 — Explorador público del mapa (sin registro) (3–4 semanas)

**Front**
- MapLibre GL JS en `/{locale}/mapa` (isla cliente, SSR del shell). Base: tiles vectoriales OSM propios (Protomaps/PMTiles) — no usar `tile.openstreetmap.org` en producción por su política de uso.
- Capa OpenRailwayMap (infraestructura, velocidades, electrificación, señalización) como overlay raster con atribución, o regenerada desde nuestros datos.
- Filtros por estado (operativa, restringida, fuera de servicio, en obra), operador, trocha, línea; búsqueda de estaciones; ficha de cada elemento con incidentes vigentes; enlaces compartibles (estado en la URL).
- Atribución ODbL “© OpenStreetMap contributors” visible siempre.

**Datos**
- Importador (Worker + Cron Trigger o GitHub Action) que consulta Overpass (`railway=rail|station|halt|level_crossing|...` en Argentina), normaliza y hace upsert en D1. Para volumen nacional: extracto Geofabrik `.osm.pbf` → `osmium`/`tippecanoe` en CI → PMTiles en R2.
- Versionado del snapshot (fecha de extracto) y diffs para detectar cambios.

**Cloudflare geo**
- D1: tablas de activos con bbox (`min_lat/max_lat/min_lon/max_lon`) indexadas + geohash/H3 para consultas por viewport; GeoJSON en columna JSON.
- R2: PMTiles (base + capa ferroviaria) servidos por un Worker con soporte Range y cache en el edge (Cache API).
- Workers: `GET /api/geo/assets?bbox=&z=` (GeoJSON paginado), `GET /api/geo/assets/:id`, `GET /api/geo/status` con KV/Cache para lo caliente.
- `request.cf` (país/ciudad) para centrar el mapa inicial.
- Alternativa si crecen las consultas espaciales: Postgres+PostGIS (Neon/Supabase) vía Hyperdrive; D1 sigue para auth y cosas de la app.

## 4. Modelo de activos (Fase 1–2)

- `network` (red/operador), `line` (línea comercial), `segment` (tramo entre nodos, LineString, km inicio/fin, trocha, electrificación, vía simple/doble, velocidad máx.), `station` (Point, tipo, accesibilidad), `asset` (puente, PaN, señal, desvío…), `status` (histórico por elemento: estado, causa, desde/hasta, fuente), `incident` (tipo, severidad, geometría, afectados, visibilidad pública/privada), `source` (OSM id, importación, edición manual), `attachment` (R2).
- Todo con `osm_id` opcional, `updated_by`, `updated_at` y auditoría en `audit_events`.

## 5. Fase 2 — Edición admin (3 semanas)

- Editor en `/app/admin/mapa`: seleccionar en el mapa, editar atributos, cambiar estado, cargar incidentes, dibujar/ajustar geometrías (maplibre-gl-draw / terra-draw).
- Flujo de cambios: borrador → revisión → publicado; historial y rollback.
- Importación CSV/GeoJSON; conflictos con la siguiente importación OSM (las ediciones locales ganan, marcadas).
- Permisos por red/línea (Fase 0).

## 6. Fase 3 — Operación y datos abiertos (4+ semanas)

- Feed público de incidentes (RSS/JSON), suscripciones por línea (correo vía Queues), webhooks.
- API pública con rate limit y API keys; export GeoJSON/CSV; GTFS si suman horarios.
- Indicadores: km por estado, disponibilidad, tiempo medio de resolución.
- Inspecciones de campo desde el móvil (PWA offline, fotos en R2).

## 7. Hitos

| Hito | Contenido | Estimación |
| --- | --- | --- |
| M0 | Correos transaccionales + e2e auth + RBAC fino | 1 sem |
| M1 | Mapa público MVP: base PMTiles, capa ferroviaria de OSM, filtros, fichas | 2 sem |
| M2 | Importador Overpass/Geofabrik + modelo de activos en D1 + API geo | 2 sem |
| M3 | Estados e incidentes públicos + historial | 1–2 sem |
| M4 | Editor admin con flujo de revisión | 3 sem |
| M5 | Datos abiertos, suscripciones, PWA de campo | 4+ sem |

## 8. Riesgos

- Licencia ODbL: la base derivada de OSM se comparte bajo ODbL; separar datos propios (estados/incidentes) como base independiente.
- Precisión de OSM en ramales en desuso: validar con fuentes oficiales.
- Límites de D1 (10 GB, sin índices espaciales): planificar Hyperdrive+PostGIS si hace falta.
- Turnstile y bots: el explorador público no lo usa; la API pública con rate limit en el edge.
