# QA Checklist — Validación Manual E2E

Documento para validar manualmente todos los flujos críticos del sistema de asamblea digital.

---

## Preparación del entorno

### 1. Variables de entorno

Copia `apps/api/.env.example` a `apps/api/.env` y completa:

```
DATABASE_URL=postgresql://...      # conexión a tu DB
LIVEKIT_API_KEY=APIfooBAR123       # desde https://cloud.livekit.io
LIVEKIT_API_SECRET=secret123       # secreto del proyecto
LIVEKIT_URL=wss://tu-proyecto.livekit.cloud
```

> **Sin LIVEKIT_API_KEY y LIVEKIT_API_SECRET la conferencia no funciona.**
> El servidor arrancará con advertencias si faltan. Revisa los logs al iniciar.

### 2. Arrancar el sistema

```bash
# Terminal 1 — API (puerto 4000)
npm --workspace @kuoro/api run dev

# Terminal 2 — Web (puerto 5173)
npm --workspace @kuoro/web run dev
```

Al iniciar, la API debe mostrar:
- `🚀 Kuoro API (@kuoro/api) en http://0.0.0.0:4000`
- `LiveKit: ✅ configurado` (o ❌ si faltan keys)
- Sin errores de DATABASE_URL

### 3. Seed del entorno demo

```bash
node apps/api/scripts/seed-demo.mjs
```

Al terminar imprime:
- Credenciales del admin (`demo@kuoro.io` / `Kuoro2026!`)
- IDs de propiedad y asamblea
- Links de acceso por unidad

Guarda esa salida — la necesitas para las pruebas.

---

## Bloque A — Conferencia básica

### A1. Admin entra a la sala

- [ ] Ingresar en `http://localhost:5173/login-admin`
- [ ] Email: `demo@kuoro.io` / Contraseña: `Kuoro2026!`
- [ ] Navegar a Asambleas → seleccionar "Asamblea General Demo 2026"
- [ ] Ir a pestaña "Sala en vivo" (ConferenceAdmin debe cargarse)
- [ ] Verificar: aparece "EN VIVO" y botón de debug (modo dev)
- [ ] Abrir panel Debug → verificar: Token obtenido, LiveKit URL, Identity con prefijo `admin-`
- [ ] Verificar: log muestra `✅ Conectado a LiveKit Room (admin)` al conectar
- [ ] Verificar: la sala no mezcla con otra asamblea (room name incluye assemblyId)

**Resultado esperado:** Admin conectado, ve su propio tile de cámara, puede publicar.

---

### A2. Asistente entra con acceso válido

- [ ] Copiar uno de los links de asistente del seed (formato `/asistente/...?token=...`)
- [ ] Abrir en otro navegador o ventana privada
- [ ] Verificar: pantalla de bienvenida muestra nombre del representante y unidad
- [ ] Verificar: tipo de representación visible (Propietario / Apoderado)
- [ ] Ingresar nombre y presionar "Unirse a la sala →"
- [ ] Verificar: panel de debug (modo dev) muestra identity con prefijo `owner-`
- [ ] Verificar: log muestra "Token asistente obtenido" y "✅ Conectado"
- [ ] Verificar: asistente aparece en lista de participantes del admin

**Resultado esperado:** Asistente conectado como solo-escucha.

---

### A3. Token inválido bloqueado

- [ ] Navegar a `/asistente?token=token-invalido`
- [ ] Verificar: pantalla de error "Token de acceso no encontrado o inválido."
- [ ] Verificar: no hay acceso a ningún dato de la asamblea

---

### A4. Admin publica audio/video/screen share

- [ ] En la sala admin, activar micrófono (botón Mic)
- [ ] Verificar: ícono de mic activo en tile del admin
- [ ] Activar cámara (botón Camera)
- [ ] Verificar: video aparece en tile del admin
- [ ] Activar screen share (botón ScreenShare si está disponible)
- [ ] Verificar: pantalla compartida visible para asistentes conectados
- [ ] En la vista del asistente: verificar que se ve/escucha al admin

---

### A5. Asistente no puede publicar sin permiso

- [ ] Desde la vista del asistente (sin turno de palabra)
- [ ] Verificar: no hay botón de micrófono o cámara visible
- [ ] Si intenta publicar por dev tools, el servidor de LiveKit lo rechaza (canPublish=false)
- [ ] Panel debug: `canPublish: no`

---

## Bloque B — Cola de participación

### B1. Solicitar turno de palabra

- [ ] Asistente presiona "✋ Solicitar la palabra"
- [ ] Verificar: aparece estado "Solicitud enviada. Esperando aprobación…"
- [ ] Verificar: en la vista admin, aparece la solicitud en la cola

### B2. Admin aprueba turno

- [ ] Admin ve la solicitud en el panel de cola
- [ ] Admin presiona "Aprobar" (seleccionando modalidad: mic o mic+camera)
- [ ] Verificar (asistente): estado cambia a "Su turno fue aprobado. Active su micrófono."
- [ ] Asistente activa micrófono
- [ ] Verificar: admin oye/ve al asistente
- [ ] Panel debug del asistente: `canPublish: sí`
- [ ] Verificar: cronómetro visible en ambas vistas

### B3. Admin rechaza turno

- [ ] Repetir B1 con otro asistente (o el mismo después de terminar el turno)
- [ ] Admin presiona "Rechazar"
- [ ] Verificar (asistente): solicitud desaparece, puede volver a pedir

### B4. Admin termina turno manualmente

- [ ] Con un speaker activo, admin presiona "Terminar turno"
- [ ] Verificar (asistente): pierde permisos de publicación
- [ ] Verificar: cronómetro desaparece

### B5. Expiración automática del turno

- [ ] Si la asamblea tiene duración configurada, esperar que expire el tiempo
- [ ] O simular via API: `PATCH .../conference/queue/:id/expire`
- [ ] Verificar: asistente pierde permisos automáticamente
- [ ] Verificar: log muestra "speaking_expired" en backend

---

## Bloque C — Reconexión

### C1. Recarga de página del asistente en medio de la conferencia (sin turno)

- [ ] Asistente sin turno activo recarga la página (F5)
- [ ] Verifica: pantalla de bienvenida aparece de nuevo
- [ ] Al re-unirse, se conecta normalmente
- [ ] Verificar: no hay errores de "ya conectado" en logs

### C2. Recarga del admin

- [ ] Admin recarga la página
- [ ] Verificar: re-obtiene token y se reconecta
- [ ] Verificar: cola de participación se restaura (polling continuo)

### C3. Reconexión con turno de speaker activo

- [ ] Con asistente en estado "speaking", recargar su página
- [ ] Verificar: el backend detecta turno activo → emite token con rol `speaker`
- [ ] Verificar en log: "⚡ Reconexión: turno de speaker restaurado"
- [ ] Verificar: asistente recupera permisos de publicación
- [ ] Panel debug: connection state → connected, canPublish → sí

### C4. Reconexión después de expiración

- [ ] Asistente cuyo turno expiró recarga la página
- [ ] Verificar: obtiene token con rol `attendee` (no speaker)
- [ ] Verificar: no tiene permisos de publicación

---

## Bloque D — Votación digital

### D1. Admin abre sesión de votación

- [ ] En AssemblyHubPage → pestaña "Votación" (o tab correspondiente)
- [ ] Admin completa pregunta: "¿Se aprueba el presupuesto 2027?"
- [ ] Selecciona regla: Mayoría simple / Base: Por unidad
- [ ] Presiona "Abrir votación"
- [ ] Verificar: sesión aparece como "Abierta"

### D2. Asistente vota (modo unidad única)

- [ ] En la página del asistente, aparece la sesión activa con la pregunta
- [ ] Asistente presiona "Sí"
- [ ] Aparece pantalla de confirmación
- [ ] Confirma: "Confirmar: Sí"
- [ ] Verificar: badge "✓ Tu voto: Sí" aparece
- [ ] En la vista del admin: conteo actualiza (totalVoted ++)

### D3. Doble voto bloqueado

- [ ] Asistente intenta votar de nuevo (desde otra ventana con el mismo token)
- [ ] Verificar: error "Esta unidad ya emitió su voto en esta sesión." (409)

### D4. Conteo en vivo (admin)

- [ ] Con varios asistentes votando, verificar en la vista admin:
  - Barra de progreso actualiza
  - Conteos Sí/No/Abstención/Blanco actualizan
  - Porcentaje de participación visible

### D5. Cierre de votación

- [ ] Admin presiona "Cerrar y calcular resultado"
- [ ] Confirma el cierre
- [ ] Verificar: sesión cambia a "Cerrada"
- [ ] Verificar: resultado visible (Aprobado / No aprobado)
- [ ] En la vista del asistente: resultado final visible

### D6. Cancelar sesión

- [ ] Abrir nueva sesión
- [ ] Admin presiona "Cancelar sesión"
- [ ] Verificar: sesión queda en estado "Cancelada" sin resultado

---

## Bloque E — Representaciones y apoderados

### E1. Seed automático de representaciones

- [ ] Verificar que el seed-demo.mjs generó representaciones (ver tabla en hub o API)
- [ ] GET `/api/v1/properties/:pId/assemblies/:aId/representations` → lista de representaciones
- [ ] Verificar: unidad A-202 tiene tipo "proxy" (apoderado aprobado en los datos demo)

### E2. Crear apoderado manual

- [ ] En AssemblyHubPage → pestaña Votación → sección Representaciones
- [ ] Presionar "+ Agregar apoderado"
- [ ] Completar: unitId de B-101, nombre "Juan Sustituto", email opcional
- [ ] Guardar
- [ ] Verificar: representación aparece en la lista con estado "Activo"
- [ ] Copiar el accessToken generado

### E3. Representante con varias unidades (mismo token)

- [ ] Crear segundo apoderado para B-102 usando el mismo `sharedAccessToken` del paso E2
- [ ] Verificar: ambas representaciones tienen el mismo accessToken
- [ ] Abrir `/asistente?token=<ese-token>`
- [ ] Verificar: pantalla muestra bienvenida (o va directamente a sala)
- [ ] Verificar: en el panel de votación aparecen 2 tarjetas: B-101 y B-202 ("Con la palabra")
- [ ] Votar por cada unidad de forma independiente
- [ ] Verificar: conteo del admin suma 2 votos

### E4. Revocar representación

- [ ] En el panel de representaciones, presionar "Revocar" en una fila
- [ ] Verificar: estado cambia a "Revocado"
- [ ] Intentar votar con el token de esa representación revocada
- [ ] Verificar: voto rechazado (403)

### E5. Reactivar representación

- [ ] Presionar "Reactivar" en la fila revocada
- [ ] Verificar: estado vuelve a "Activo"
- [ ] Verificar: puede votar nuevamente (si la sesión está abierta)

---

## Bloque F — Aislamiento multi-tenant

### F1. Dos asambleas simultáneas no se mezclan

- [ ] Crear una segunda asamblea para la misma propiedad (o una propiedad diferente)
- [ ] Iniciar ambas en `in_progress`
- [ ] Abrir dos ventanas admin, una por asamblea
- [ ] Verificar: los tokens de LiveKit tienen room names diferentes (`ph-...-asm1` vs `ph-...-asm2`)
- [ ] Verificar: un asistente de la asamblea 1 NO aparece en la cola de la asamblea 2
- [ ] Verificar: una votación en asamblea 1 NO aparece en asamblea 2
- [ ] Verificar: un voto en asamblea 1 NO cuenta en asamblea 2

### F2. Token de una asamblea no accede a otra

- [ ] Intentar usar el accessToken de una asamblea para obtener token de conferencia en la otra
- [ ] Verificar: error 403 "El token no corresponde a esta asamblea."

---

## Bloque G — Errores esperables

| Escenario | Respuesta esperada |
|-----------|-------------------|
| Token expirado o inválido | 403/404 + mensaje claro |
| Asamblea no en `in_progress` | 403 "Assembly is not currently in progress" |
| Votar sin sesión activa | 404 "Sesión de votación no encontrada" |
| Doble voto | 409 "Esta unidad ya emitió su voto" |
| Admin sin LIVEKIT_API_KEY | Token generado falla con error de SDK |
| LiveKit URL incorrecta | Error de conexión visible en debug panel |
| Reconexión con turno expirado | Token emitido con rol `attendee` (no speaker) |
| Representación revocada intenta votar | 403 "No tienes representación activa" |

---

## Checklist de smoke test rápido (5 minutos)

Para validar que el sistema funciona mínimamente:

- [ ] `node apps/api/scripts/seed-demo.mjs` → completa sin errores
- [ ] API arranca con LiveKit ✅ en los logs
- [ ] Admin entra a la sala → token OK → LiveKit conectado (debug log)
- [ ] Asistente abre link del seed → pantalla de bienvenida → se une
- [ ] Admin abre votación → asistente vota → admin ve el conteo
- [ ] Admin cierra votación → resultado visible en ambos lados
- [ ] Doble voto produce error 409

---

## Referencias rápidas

```
Admin:     http://localhost:5173/login-admin
Hub:       http://localhost:5173/asambleas/:assemblyId
Asistente: http://localhost:5173/asistente/:propertyId/:assemblyId?token=<token>

API health: GET http://localhost:4000/api/v1/ (404 esperado — no hay root handler)
Representations: GET http://localhost:4000/api/v1/properties/:pId/assemblies/:aId/representations
Voting sessions: GET http://localhost:4000/api/v1/properties/:pId/assemblies/:aId/voting-sessions
Attendee info: GET http://localhost:4000/api/v1/attendee-info?accessToken=<token>
```

---

## Variables que debo verificar antes de cada sesión

1. `LIVEKIT_API_KEY` y `LIVEKIT_API_SECRET` están configuradas
2. `LIVEKIT_URL` apunta al servidor correcto (`wss://...`)
3. `DATABASE_URL` conecta a la base de datos activa
4. Asamblea está en estado `in_progress`
5. Existen access grants + representaciones (correr seed si no)
