# Motor de comunicaciones multicanal — Fase 1

## Principios

- **Canales primero** (`email` | `sms` | `whatsapp`), no proveedores concretos en dominio.
- **Proveedores** (`resend`, `twilio`, `console`, `noop`, …) se resuelven vía `providerBindings` en `CommunicationSettings` (por copropiedad).
- **Sin reglas por país en código**: `countryCode` + JSON de presets (`defaultChannelsByUseCase`) definen el comportamiento.
- **Multi-tenant**: todo queda ligado a `propertyId` (copropiedad); el admin es el dueño del tenant operativo.

## Modelos (Prisma)

| Modelo | Rol |
|--------|-----|
| `CommunicationSettings` | 1:1 con `Property` — canales habilitados, remitentes, bindings de proveedor, mapas JSON de casos de uso. |
| `CommunicationCampaign` | Campaña (borrador → envío → cierre); audiencia y canales; métricas en `statsJson` (Fase 2+). |
| `CommunicationDelivery` | Una fila por intento de entrega; `eventsJson` preparado para webhooks (`delivered`, `opened`, …). |
| `DocumentRequest` | Solicitud documental genérica; `kind = proxy_power` absorbe el flujo histórico de poderes. |
| `DocumentSubmission` | Cada carga de archivo (historial). |
| `DocumentReviewAction` | Aprobación / rechazo / corrección con actor admin y timestamps. |

Los campos **`Owner.proxy*`** se mantienen: el flujo público de poderes no cambia de contrato HTTP.

## Código

- `apps/api/src/domain/communications/` — `CommunicationService`, `providerRegistry`, proveedores `console` / `noop`.
- `apps/api/src/domain/communications/settingsRepo.ts` — persistencia de settings.
- `apps/api/src/domain/communications/campaignRepo.ts` — borradores de campaña (listado + crear).
- `apps/api/src/domain/documentRequests/proxySync.ts` — sincronía Owner ↔ `DocumentRequest` y registro de envíos/revisiones.

## API

### Configuración y motor

- `GET/PUT /api/v1/properties/:propertyId/communication-settings`
- `GET/POST /api/v1/properties/:propertyId/communication-campaigns` (POST = borrador)
- `POST /api/v1/properties/:propertyId/communication-campaigns/:campaignId/dispatch` — envío de prueba (`channel`, `testRecipient`)
- `GET /api/v1/properties/:propertyId/communication-deliveries?limit=`
- `GET/POST /api/v1/properties/:propertyId/communication-templates` — POST = upsert por `(templateKey, channel)` único
- `PUT/DELETE /api/v1/properties/:propertyId/communication-templates/:templateId`

### Documentos y público

- `GET /api/v1/properties/:propertyId/document-requests` — listado admin (historial + conteos)
- `GET /api/v1/public/document-requests/:token` — estado público (sin sesión admin)

### Webhooks (stub)

- `POST /api/v1/integrations/communications/webhooks/:provider` — body: `event`, `providerMessageId` o `trackingToken`. **Producción:** validar firma del proveedor antes de confiar.

## UI (Fase 2 aplicada)

- **`/comunicaciones`**: pestañas Bandeja (poderes), Registro documental, Canales, Campañas, Plantillas, Entregas.
- **`/documento/:token`**: vista destinatario con historial de envíos y revisiones; enlace a **`/poder/:token`** si corresponde carga/corrección.
- En **`/poder/:token`**, enlace “Ver estado de la solicitud” → `/documento/:token`.

## Próximo refinamiento (Fase 3)

- Conectores reales en `providerRegistry` (Resend, Twilio, Meta).
- Render de plantillas con variables y envío masivo por audiencia real.
- Validación de firmas en webhooks; segmentación y reenvíos automáticos.
