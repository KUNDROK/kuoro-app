# Notas técnicas — Módulo de conferencia LiveKit

> **Fase 2 (producción)** — Persistencia real, job de expiración, endurecimiento multi-tenant.
> Actualizado: 2026-04-14

> Documento de decisiones técnicas y arquitectura del módulo de videoconferencia embebida.
> Actualizado: 2026-04-14

---

## 1. Arquitectura general

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (React)                       │
│                                                           │
│  ConferenceAdmin ──────────── ConferenceAttendee          │
│        │                             │                    │
│  useSpeakerQueue (polling 2s)  useSpeakerQueue            │
│        │                             │                    │
│  @livekit/components-react      @livekit/components-react  │
│        │                             │                    │
│  LiveKitRoom (JWT token)        LiveKitRoom (JWT token)   │
└───────────────────────┬─────────────┬────────────────────┘
                        │             │
                 WebRTC / WHIP/WHEP   │
                        │             │
               ┌────────▼─────────────▼────────┐
               │         LiveKit Server         │
               │  (Cloud o self-hosted)         │
               └────────────────────────────────┘
                        │
               ┌────────▼────────┐
               │  @kuoro/api (Node) │
               │                 │
               │  /conference/   │
               │    token        │  ← genera JWT admin
               │    attendee-token│ ← genera JWT asistente
               │    queue        │  ← cola en memoria
               │    queue/:id/   │
               │      approve    │  ← eleva permisos en LK
               │      reject     │
               │      finish     │  ← revoca permisos en LK
               └─────────────────┘
```

---

## 2. Nomenclatura de rooms

```
ph-{propertyId}-{assemblyId}
```

- El prefijo `ph-` evita colisiones en servidores LiveKit compartidos.
- `propertyId` y `assemblyId` son UUIDs generados por Prisma.
- Una misma propiedad puede tener múltiples asambleas, cada una en su propia room.
- Las rooms de distintos administradores son completamente independientes.

---

## 3. Roles y permisos

| Rol        | Publicar mic | Publicar cámara | Compartir pantalla | Moderar | Descripción                                    |
|------------|:---:|:---:|:---:|:---:|------------------------------------------------|
| `admin`    | ✅  | ✅  | ✅  | ✅  | El administrador de la asamblea                |
| `attendee` | ❌  | ❌  | ❌  | ❌  | Propietario/asistente en modo solo escucha     |
| `speaker`  | ✅  | ❌* | ❌  | ❌  | Asistente con turno activo (* cámara solo si la modalidad es `mic_camera`) |

Los permisos se codifican en el JWT en el momento de emitirlo. Para `speaker`, el backend además llama a `RoomServiceClient.updateParticipant()` al aprobar el turno para elevar dinámicamente los permisos en la room activa.

---

## 4. Cola de participación (in-memory)

La cola vive en `apps/api/src/domain/speakerQueue.ts` como un `Map<assemblyId, SpeakerQueueEntry[]>`.

**Estados de una entrada:**

```
waiting → approved → speaking → done
       ↘          ↗
        rejected
```

**Ciclo completo:**
1. Asistente llama `POST /conference/queue` → entra como `waiting`.
2. Admin llama `POST /conference/queue/:id/approve` con `{ modalidad, durationMinutes }`:
   - La cola pasa la entrada a `approved`.
   - El backend eleva permisos en LiveKit (`elevateParticipantToSpeaker`).
   - Inmediatamente pasa a `speaking` y registra `speakingEndsAt`.
3. El frontend hace polling cada 2 s para actualizar el estado.
4. El cronómetro se calcula en el cliente a partir de `speakingEndsAt`.
5. Cuando el tiempo caduca, el frontend llama `finishTurn` → el backend revoca los permisos.
6. El admin puede llamar `finish` en cualquier momento para terminar antes.

**Límite del MVP:** La cola vive en RAM. Si el proceso de la API se reinicia, la cola se pierde. Para producción:
- Mover la cola a la base de datos (nueva tabla `SpeakerQueueEntry` en Prisma).
- O usar Redis para persistencia y pub/sub en tiempo real.

---

## 5. Optimización de costos

- **`adaptiveStream: true`** — LiveKit ajusta la resolución según el ancho de banda disponible.
- **`dynacast: true`** — Solo se encoden los layers de simulcast que alguien está suscribiendo.
- **`stopLocalTrackOnUnpublish: true`** — Libera la cámara y el micrófono del hardware cuando se deja de publicar.
- **Publicación restringida** — Los asistentes no pueden publicar por defecto. Solo el admin y el orador activo generan tráfico de subida, reduciendo el costo por minuto de LiveKit.
- **`canPublishSources`** — Se especifican las fuentes exactas permitidas en el JWT, impidiendo que el cliente intente publicar fuentes no autorizadas.

---

## 6. Variables de entorno requeridas

```env
# En .env (raíz del monorepo)
LIVEKIT_API_KEY=APIdxxxxxxxxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LIVEKIT_URL=wss://tu-proyecto.livekit.cloud
```

Para desarrollo local con LiveKit Cloud (gratuito hasta cierto límite), crear un proyecto en https://cloud.livekit.io y copiar las credenciales.

Para self-hosted: https://docs.livekit.io/home/self-hosting/local/

---

## 7. Reconexión

`livekit-client` maneja la reconexión automática con backoff exponencial. Si un participante se desconecta y vuelve a conectar:

- El frontend volverá a llamar al endpoint de token (`/conference/token` o `/attendee-token`).
- El token tiene TTL de 8 horas, suficiente para una asamblea normal.
- Si el participante tenía un turno activo (`speaking`), el estado persiste en la cola mientras el proceso de la API no se haya reiniciado.

---

---

## Fase 2 — Persistencia y endurecimiento (2026-04-14)

### Cambios clave

#### Base de datos
- Nuevo modelo `SpeakerQueueEntry` en Prisma/PostgreSQL:
  - 7 estados: `waiting | approved | speaking | done | rejected | cancelled | expired`
  - Índices sobre `(assemblyId, status)`, `(assemblyId, participantIdentity)`, `(assemblyId, speakingEndsAt)`
  - `durationSeconds` en lugar de `durationMinutes` para mayor precisión
- Nuevo modelo `ConferenceAuditLog`: registro inmutable de eventos de conferencia

#### Servicio `speakerQueue.ts` (reescrito)
- `approveSpeaker` usa transacción de BD: verifica unicidad de speaker antes de aprobar
- `expireSpeaker` operación idempotente — si ya no está "speaking", es no-op
- Toda mutación de estado escribe un registro en `ConferenceAuditLog`

#### Job de expiración (`expiryJob.ts`)
- `setInterval` cada 5 segundos; arranca desde `server.ts`
- Busca `WHERE status = 'speaking' AND speakingEndsAt < NOW()`
- Actualiza BD primero, luego llama LiveKit (LK puede fallar sin afectar el estado)
- Funciona aunque el frontend del admin esté cerrado

#### Seguridad multi-tenant
- Todos los endpoints validan `property.adminId === admin.id`
- Los asistentes no pueden usar identidades con prefijo `admin-`
- El endpoint `/attendee-token` valida `assembly.status === "in_progress"` y `assembly.propertyId === propertyId`

#### Reconexión segura
- El endpoint `/attendee-token` verifica en BD si el participante tenía turno activo
- Si `status === "speaking"` y `speakingEndsAt > NOW()`, emite token con rol `speaker` y llama `elevateParticipantToSpeaker`
- Registra evento `speaker_reconnected` en auditoría

#### Prevención de dos speakers simultáneos
- Implementado via transacción en `approveSpeaker`:
  ```sql
  SELECT 1 FROM SpeakerQueueEntry WHERE assemblyId = ? AND status = 'speaking'
  ```
  Si hay resultado → 409 Conflict antes de cualquier cambio.

#### Hook `useSpeakerQueue` refactorizado
- Nuevo parámetro `mode: "admin" | "attendee"`
- Admin hace polling de `/conference/queue` (cola completa)
- Asistente hace polling de `/conference/queue/my-state` (solo su estado, más eficiente)
- `totalSeconds` se calcula desde `speakingEndsAt - speakingStartedAt` (fuente de verdad = BD)
- `onTurnEnded` no llama a `finishTurn` — la expiración es responsabilidad del backend

#### Nuevos endpoints
- `GET /conference/queue/my-state?identity=...` — estado del asistente (sin auth de admin)
- `GET /conference/audit?limit=N` — log de auditoría (solo admin)

### Cobertura de casos críticos

| Caso | Solución |
|------|----------|
| Admin aprueba y expira normalmente | Job de expiración en backend (cada 5s) |
| Admin finaliza antes del tiempo | `POST /finish` → `done` + revoke LK |
| Participante recarga mientras habla | `/attendee-token` detecta turno activo → token speaker + elevate LK |
| Backend reinicia | Cola en PostgreSQL; job arranca y revoca los expirados pendientes |
| Dos admins mezclan reuniones | `property.adminId !== admin.id` → 403 en todos los endpoints |
| Dos speakers simultáneos | Transacción BD en `approveSpeaker` → 409 si ya existe uno |
| Asistente intenta publicar sin permiso | LK rechaza por JWT sin `canPublish=true`; backend no emite token speaker sin aprobación |

---

---

## Fase 3 — Tests, seguridad y reconciliación

> Actualizado: 2026-04-14

### 3.1 Suite de tests automáticos

**Stack:** Vitest 4 con `environment: "node"`, mocks de Prisma y LiveKit.

**Ejecutar:**
```bash
npm --workspace @kuoro/api run test           # una vez
npm --workspace @kuoro/api run test:watch     # modo watch
npm --workspace @kuoro/api run test:coverage  # con cobertura
```

**Cobertura crítica (60 tests, 2 archivos):**

| Archivo | Tests | Qué cubre |
|---------|-------|-----------|
| `speakerQueue.test.ts` | 38 | Cola, estados, unicidad de speaker, audit log, reconexión, multi-tenant |
| `livekit.test.ts` | 22 | `buildRoomName`, `grantsForRole` por rol, privilegio mínimo, separación admin/speaker |

**Invariantes clave protegidas:**
- `INV-01`: Solo un asistente en `speaking` por asamblea (409 si ya hay uno)
- `INV-02`: Prefijo `admin-` nunca entra a la cola de asistentes
- `INV-03`: `expireSpeaker` es idempotente (seguro para múltiples invocaciones)
- `INV-04`: `cancelAllActive` solo afecta estados activos (no terminales)
- Admin y speaker pueden publicar simultáneamente sin conflicto de permisos

### 3.2 Seguridad de tokens e identidades

**TTLs reducidos:**
- `admin`: 4h (era 8h)
- `attendee`: 4h (era 8h)
- `speaker`: 30min (era 1h; el turno máximo son 5min)

**Funciones de validación en `livekit.ts`:**
- `adminIdentity(adminId)` — construye `admin-{id}` de forma centralizada
- `attendeeIdentity(identity)` — rechaza el prefijo `admin-`
- `isAdminIdentity(identity)` — detecta identidades de admin
- `validateAttendeeIdentity(identity)` — valida formato (charset, longitud, prefijo)

**Flujo endurecido:**
- Todos los endpoints de asistente usan `validateAttendeeIdentity` antes de procesar
- El endpoint `/conference/token` (admin) usa `adminIdentity()` para construir la identity
- Se previene spoofing de identidad a nivel de HTTP antes de consultar la BD

### 3.3 Reconciliación con LiveKit

**Problema:** Si LiveKit falla transitoriamente, la BD queda correcta pero LiveKit desincronizado.

**Solución:** Tabla `LiveKitPendingAction` + job de reconciliación.

**Flujo:**
1. Operación LiveKit falla (ej: revoke en `finishSpeaker`)
2. Backend captura la excepción y llama `enqueueLiveKitAction(...)`
3. Se crea un registro en `LiveKitPendingAction` con `status: pending`
4. El job de reconciliación (cada 10s) reintenta con backoff exponencial (2s, 4s, 8s…)
5. Tras 5 intentos fallidos → `status: failed` + log de error para intervención manual

**Garantía de seguridad:** El servicio de reconciliación **nunca** opera sobre identidades con prefijo `admin-`. Si por algún bug se encola una acción sobre un admin, se descarta con warning.

**Tipos de acciones:**
- `revoke_speaker` — revocar permisos de publicación del asistente
- `elevate_speaker` — elevar permisos (reconexión durante turno activo)
- `mute_tracks` — silenciar tracks activos

**Archivos nuevos:**
- `apps/api/src/domain/reconciliation.ts` — servicio + job
- Migración Prisma: modelo `LiveKitPendingAction`

### 3.4 Lifecycle de sala

**Archivo:** `apps/api/src/domain/roomLifecycle.ts`

**Endpoints añadidos:**
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/conference/close` | POST | Cierra sala: revoca speaker + cancela cola + marca assembly como "closed" |
| `/conference/admin-left` | POST | Notifica salida temporal del admin (no cierra sala) |
| `/conference/room-status` | GET | Estado derivado: assemblyStatus, hasActiveSpeaker, currentSpeaker |

**Reglas de negocio implementadas:**
- El admin puede entrar/salir sin cerrar la sala
- La sala solo se cierra cuando el admin llama explícitamente a `/conference/close`
- Al cerrar: primero se revoca el speaker activo, luego se cancela la cola
- Si hay asistentes conectados pero no admin, la sala permanece activa
- La asamblea pasa a `status: "closed"` solo al cerrar explícitamente

### 3.5 Observabilidad

**Logger estructurado:** `apps/api/src/lib/logger.ts`

```bash
# Modo pretty (desarrollo, por defecto)
node server.js

# Modo JSON (producción / log aggregators)
LOG_FORMAT=json node server.js
```

**Formato JSON para Datadog/CloudWatch:**
```json
{"ts":"2026-04-14T12:00:00Z","level":"INFO","module":"expiryJob","msg":"Expirando turno","entryId":"...","participantIdentity":"owner-alice","assemblyId":"..."}
```

**Módulos actualizados con logger estructurado:**
- `expiryJob.ts` — expiraciones, fallidos LiveKit, arranque/parada del job
- `reconciliation.ts` — reintentos, acciones completadas, agotadas, bloqueadas
- `roomLifecycle.ts` — entradas/salidas de admin, cierres de sala

---

## 8. Roadmap / pendientes para producción

| Prioridad | Tarea |
|-----------|-------|
| Alta | ~~Persistir la cola de participación en la BD~~ ✅ COMPLETADO |
| Alta | ~~Tests automáticos de flujos críticos~~ ✅ COMPLETADO |
| Alta | ~~Reconciliación LiveKit con retry~~ ✅ COMPLETADO |
| Alta | ~~Lifecycle de sala y cierre explícito~~ ✅ COMPLETADO |
| Alta | ~~Seguridad de identidades y TTLs~~ ✅ COMPLETADO |
| Alta | ~~Logger estructurado~~ ✅ COMPLETADO |
| Alta | Reemplazar polling por WebSocket o SSE para actualizaciones en tiempo real |
| Alta | Validar el `AssemblyAccessGrant` del propietario antes de emitir token de asistente |
| Media | Vista del participante (`ConferenceAttendee`) integrada en la app del propietario |
| Media | Página de ingreso del propietario (validar token de acceso de asamblea) |
| Media | Grabar la sesión usando LiveKit Egress |
| Baja | Soporte para intérpretes / idiomas alternos (múltiples pistas de audio) |
| Baja | Chat textual en sala (LiveKit DataChannel) |

---

## 9. Archivos creados/modificados

| Archivo | Rol |
|---------|-----|
| `apps/api/src/domain/livekit.ts` | Servicio LiveKit: generación de tokens, permisos, RoomService |
| `apps/api/src/domain/speakerQueue.ts` | Cola de participación en memoria |
| `apps/api/src/routes.ts` | Nuevos endpoints `/conference/*` |
| `packages/contracts/src/index.ts` | Tipos: `ConferenceRole`, `SpeakerQueueEntry`, etc. |
| `apps/web/src/lib/api.ts` | Funciones cliente para los nuevos endpoints |
| `apps/web/src/hooks/useConferenceRoom.ts` | Hook para conexión a la room de LiveKit |
| `apps/web/src/hooks/useSpeakerQueue.ts` | Hook con polling, cronómetro y acciones de cola |
| `apps/web/src/components/conference/ConferenceAdmin.tsx` | Vista completa del administrador |
| `apps/web/src/components/conference/ConferenceAttendee.tsx` | Vista completa del asistente |
| `apps/web/src/components/conference/SpeakerQueue.tsx` | Panel de cola (admin) |
| `apps/web/src/components/conference/ParticipantTile.tsx` | Tile de vídeo de un participante |
| `apps/web/src/components/conference/MediaControls.tsx` | Barra de controles de medios |
| `apps/web/src/components/conference/ConferenceTimer.tsx` | Cronómetro circular de intervención |
| `apps/web/src/styles.css` | Estilos del módulo de conferencia |
| `apps/web/src/pages/AssemblyHubPage.tsx` | Integración de `ConferenceAdmin` en pestaña Sala |
| `prisma/schema.prisma` | Modelos `SpeakerQueueEntry` + `ConferenceAuditLog` |
| `apps/api/src/domain/speakerQueue.ts` | Servicio reescrito con Prisma (máquina de estados) |
| `apps/api/src/domain/expiryJob.ts` | Job de expiración automática de turnos |
| `apps/api/src/server.ts` | Arranque del job al iniciar el servidor |
