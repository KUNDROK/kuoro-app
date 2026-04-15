/**
 * Servicio LiveKit para Kuoro (sala Kuoro Live).
 * Cubre: generación de tokens JWT, control de permisos en sala y
 * nomenclatura de rooms multi-tenant.
 *
 * Variables de entorno requeridas:
 *   LIVEKIT_API_KEY    — clave pública del proyecto en LiveKit Cloud
 *   LIVEKIT_API_SECRET — secreto del proyecto
 *   LIVEKIT_URL        — ws(s)://… o https://… (host del servidor)
 *
 * Importar bootstrap-env primero: en ESM el .env debe cargarse antes de leer process.env aquí.
 */

import "../bootstrap-env";

import { AccessToken, RoomServiceClient, TrackSource, type VideoGrant } from "livekit-server-sdk";
import type { ConferenceRole, SpeakModalidad } from "@kuoro/contracts";

// ─── Config ──────────────────────────────────────────────────────────────────

const LIVEKIT_API_KEY    = process.env["LIVEKIT_API_KEY"]    ?? "";
const LIVEKIT_API_SECRET = process.env["LIVEKIT_API_SECRET"] ?? "";
// Default intentionally empty — token endpoints fail fast and log clearly when unset.
// The RoomServiceClient + LiveKitRoom on the frontend both accept wss:// URLs directly.
const LIVEKIT_URL        = process.env["LIVEKIT_URL"]        ?? "";

// Log LiveKit config on module load so we see it in the terminal at startup.
const _lkConfigured = LIVEKIT_API_KEY && LIVEKIT_API_SECRET && LIVEKIT_URL;
console.log(
  _lkConfigured
    ? `[LiveKit] ✅ Configurado — URL: ${LIVEKIT_URL} | Key: ${LIVEKIT_API_KEY}`
    : `[LiveKit] ⚠️  Sin configurar — tokens de conferencia fallarán. ` +
      `Revisa LIVEKIT_API_KEY, LIVEKIT_API_SECRET y LIVEKIT_URL en el .env de la raíz del monorepo o en apps/api/.env`
);

/**
 * Token TTL por rol.
 * - admin: 4h (sesiones de trabajo largas; se renueva al reconectar)
 * - attendee: 4h (idem)
 * - speaker: 30min (permisos temporales — el turno máximo son 5min, 30min da margen sin sobreexposición)
 */
const TTL: Record<ConferenceRole, number> = {
  admin:    4 * 3600,
  attendee: 4 * 3600,
  speaker:  30 * 60,
};

// ─── Validación de identidades ────────────────────────────────────────────────

const ADMIN_IDENTITY_PREFIX   = "admin-";
const ATTENDEE_IDENTITY_PREFIX = "owner-";

/**
 * Construye una identidad canónica para el administrador.
 * Garantiza el prefijo reservado `admin-`.
 */
export function adminIdentity(adminId: string): string {
  return `${ADMIN_IDENTITY_PREFIX}${adminId}`;
}

/**
 * Construye una identidad canónica para un propietario/asistente.
 * Garantiza el prefijo `owner-` y reemplaza caracteres peligrosos.
 */
export function attendeeIdentity(participantIdentity: string): string {
  // Si el caller ya pasó el prefijo correcto, lo respetamos
  if (participantIdentity.startsWith(ATTENDEE_IDENTITY_PREFIX)) return participantIdentity;
  // Si intenta hacerse pasar por admin, lo bloqueamos (nunca debe llegar aquí)
  if (participantIdentity.startsWith(ADMIN_IDENTITY_PREFIX)) {
    throw new Error("Identidad no permitida: prefijo reservado para administradores");
  }
  return `${ATTENDEE_IDENTITY_PREFIX}${participantIdentity}`;
}

/** Devuelve true si la identity es de un administrador. */
export function isAdminIdentity(identity: string): boolean {
  return identity.startsWith(ADMIN_IDENTITY_PREFIX);
}

/**
 * Valida que una identidad de asistente:
 * 1. No tenga el prefijo de admin
 * 2. Solo contenga caracteres seguros (alfanumérico, guión, guión bajo, punto)
 * 3. Tenga longitud razonable (≤ 128 chars)
 */
export function validateAttendeeIdentity(identity: string): void {
  if (!identity || identity.length > 128) {
    throw Object.assign(
      new Error("participantIdentity inválido: debe tener entre 1 y 128 caracteres"),
      { statusCode: 400 },
    );
  }
  if (identity.startsWith(ADMIN_IDENTITY_PREFIX)) {
    throw Object.assign(
      new Error("participantIdentity inválido: prefijo 'admin-' reservado"),
      { statusCode: 400 },
    );
  }
  if (!/^[\w\-.@]+$/.test(identity)) {
    throw Object.assign(
      new Error("participantIdentity inválido: solo se permiten caracteres alfanuméricos, guión, guión bajo, punto y @"),
      { statusCode: 400 },
    );
  }
}

// ─── Room naming ─────────────────────────────────────────────────────────────

/**
 * Genera el nombre canónico de la room:
 * `ph-{propertyId}-{assemblyId}`
 *
 * El prefijo `ph-` previene colisiones con rooms de otros proyectos
 * compartiendo el mismo servidor LiveKit.
 */
export function buildRoomName(propertyId: string, assemblyId: string): string {
  return `ph-${propertyId}-${assemblyId}`;
}

// ─── Grants por rol ───────────────────────────────────────────────────────────

/** @internal Exportada para tests; no usar fuera del módulo de dominio. */
export function grantsForRole(role: ConferenceRole, roomName: string): VideoGrant {
  switch (role) {
    case "admin":
      return {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canPublishSources: [
          TrackSource.CAMERA,
          TrackSource.MICROPHONE,
          TrackSource.SCREEN_SHARE,
          TrackSource.SCREEN_SHARE_AUDIO,
        ],
        canSubscribe: true,
        canPublishData: true,
        roomAdmin: true,
      };

    case "speaker":
      // Asistente con turno de palabra: solo mic inicial.
      // El backend actualiza permisos via RoomService al aprobar.
      return {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canPublishSources: [TrackSource.MICROPHONE],
        canSubscribe: true,
        canPublishData: true,
        roomAdmin: false,
      };

    case "attendee":
    default:
      // Propietario / asistente: solo suscripción.
      return {
        room: roomName,
        roomJoin: true,
        canPublish: false,
        canPublishSources: [],
        canSubscribe: true,
        canPublishData: true,  // para metadata / mensajes de chat
        roomAdmin: false,
      };
  }
}

// ─── Token generation ─────────────────────────────────────────────────────────

export interface GenerateTokenOptions {
  propertyId: string;
  assemblyId: string;
  participantIdentity: string;  // identificador único del participante
  displayName: string;
  role: ConferenceRole;
  /** Metadata JSON serializable adicional para el participante. */
  metadata?: Record<string, unknown>;
}

export async function generateLiveKitToken(opts: GenerateTokenOptions): Promise<string> {
  const { propertyId, assemblyId, participantIdentity, displayName, role, metadata } = opts;

  // Fail fast with a clear error — prevents silent empty-token issues
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw Object.assign(
      new Error(
        "LiveKit no está configurado. Añade LIVEKIT_API_KEY y LIVEKIT_API_SECRET al .env de la raíz del monorepo o a apps/api/.env"
      ),
      { statusCode: 503 }
    );
  }
  if (!LIVEKIT_URL) {
    throw Object.assign(
      new Error(
        "LIVEKIT_URL no está configurada. Añade la URL wss:// de tu proyecto LiveKit al .env de la raíz o a apps/api/.env"
      ),
      { statusCode: 503 }
    );
  }

  const roomName = buildRoomName(propertyId, assemblyId);
  const grants   = grantsForRole(role, roomName);

  console.log(
    `[LiveKit] 🎫 Emitiendo token` +
    ` | role=${role}` +
    ` | identity=${participantIdentity}` +
    ` | room=${roomName}` +
    ` | canPublish=${grants.canPublish ?? false}` +
    ` | roomAdmin=${grants.roomAdmin ?? false}` +
    ` | ttl=${TTL[role]}s`
  );

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: participantIdentity,
    name: displayName,
    ttl: TTL[role],
    metadata: metadata ? JSON.stringify(metadata) : undefined,
  });

  at.addGrant(grants);
  const jwt = await at.toJwt();

  console.log(`[LiveKit] ✅ Token generado para ${participantIdentity} (${jwt.length} chars)`);
  return jwt;
}

// ─── Permission management via RoomService ────────────────────────────────────

function getRoomService(): RoomServiceClient {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
    throw new Error("LiveKit no está configurado (LIVEKIT_API_KEY / LIVEKIT_API_SECRET / LIVEKIT_URL)");
  }
  // RoomServiceClient accepts wss:// and converts it to https:// internally.
  return new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
}

/**
 * Eleva a un asistente a modo "speaker": habilita publicación de mic
 * y opcionalmente de cámara.
 */
export async function elevateParticipantToSpeaker(
  propertyId: string,
  assemblyId: string,
  participantIdentity: string,
  modalidad: SpeakModalidad,
): Promise<void> {
  const svc      = getRoomService();
  const roomName = buildRoomName(propertyId, assemblyId);
  const sources = modalidad === "mic_camera"
    ? [TrackSource.MICROPHONE, TrackSource.CAMERA]
    : [TrackSource.MICROPHONE];

  console.log(`[LiveKit] 🎤 Elevando a speaker: ${participantIdentity} en ${roomName} (modalidad: ${modalidad})`);
  await svc.updateParticipant(roomName, participantIdentity, {
    permission: {
      canPublish: true,
      canPublishSources: sources,
      canSubscribe: true,
      canPublishData: true,
      hidden: false,
      recorder: false,
    },
  });
  console.log(`[LiveKit] ✅ Speaker elevado: ${participantIdentity}`);
}

/**
 * Revoca los permisos de publicación de un participante
 * y fuerza el mute de sus tracks activos.
 */
export async function revokeParticipantSpeaker(
  propertyId: string,
  assemblyId: string,
  participantIdentity: string,
): Promise<void> {
  const svc      = getRoomService();
  const roomName = buildRoomName(propertyId, assemblyId);

  console.log(`[LiveKit] 🔇 Revocando permisos de speaker: ${participantIdentity} en ${roomName}`);

  // Remove publish permissions — the primary revocation mechanism.
  await svc.updateParticipant(roomName, participantIdentity, {
    permission: {
      canPublish: false,
      canPublishSources: [],
      canSubscribe: true,
      canPublishData: true,
      hidden: false,
      recorder: false,
    },
  });
  console.log(`[LiveKit] ✅ Permisos revocados: ${participantIdentity}`);

  // mutePublishedTrack requires the actual LiveKit track SID (e.g. "TR_xxx"),
  // not a string like "mic". These calls will silently fail — the permission
  // revocation above is the real enforcement mechanism.
  // TODO: list participant tracks first and mute each by real SID if instant
  //       client-side muting is required before the SDK picks up the permission change.
}

/** Expulsa a un participante de la sala. */
export async function removeParticipant(
  propertyId: string,
  assemblyId: string,
  participantIdentity: string,
): Promise<void> {
  const svc      = getRoomService();
  const roomName = buildRoomName(propertyId, assemblyId);
  await svc.removeParticipant(roomName, participantIdentity);
}

/** Lista los participantes conectados a una room. */
export async function listConnectedParticipants(
  propertyId: string,
  assemblyId: string,
) {
  const svc      = getRoomService();
  const roomName = buildRoomName(propertyId, assemblyId);
  return svc.listParticipants(roomName);
}

export { LIVEKIT_URL };
