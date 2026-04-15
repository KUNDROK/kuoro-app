/**
 * Gestión del ciclo de vida de la sala de conferencia.
 *
 * ## Reglas de negocio
 * 1. El admin puede entrar/salir libremente — sus permisos son permanentes.
 * 2. Al entrar el admin se registra en auditoría (participant_joined).
 * 3. Al salir el admin NO se cierra la sala automáticamente — puede reconectar.
 * 4. Si el admin cierra la sala explícitamente (closeRoom), se:
 *    a. Cancela toda la cola activa.
 *    b. Revoca permisos del speaker activo si existe.
 *    c. Registra evento room_closed en auditoría.
 * 5. Si la sala queda vacía (todos los asistentes salen), el sistema registra
 *    el evento pero NO cierra la asamblea — solo el admin puede cerrarla.
 * 6. La asamblea se marca como "closed" en BD solo al cerrarla explícitamente.
 *
 * ## Estados del ciclo de vida
 * Assembly.status:
 *   - "pending"      — configurada, no ha comenzado
 *   - "in_progress"  — en curso (la sala está activa)
 *   - "closed"       — cerrada por el admin
 */

import { prisma } from "../lib/prisma";
import { cancelAllActive, getCurrentSpeaker, auditParticipantEvent } from "./speakerQueue";
import { revokeParticipantSpeaker } from "./livekit";
import { enqueueLiveKitAction } from "./reconciliation";

// ─── Auditoría de lifecycle ────────────────────────────────────────────────────

type LifecycleEvent =
  | "room_admin_joined"
  | "room_admin_left"
  | "room_all_attendees_left"
  | "room_closed"
  | "room_assembly_started"
  | "room_assembly_closed";

async function auditLifecycle(
  assemblyId: string,
  propertyId: string,
  eventType: LifecycleEvent,
  opts: {
    participantIdentity?: string;
    participantName?:     string;
    actorAdminId?:       string;
    metadata?:           Record<string, unknown>;
  } = {},
): Promise<void> {
  try {
    await prisma.conferenceAuditLog.create({
      data: {
        assemblyId,
        propertyId,
        eventType,
        participantIdentity: opts.participantIdentity ?? null,
        participantName:     opts.participantName ?? null,
        actorAdminId:        opts.actorAdminId ?? null,
        queueEntryId:        null,
        metadata:            opts.metadata ? JSON.stringify(opts.metadata) : null,
      },
    });
  } catch (err) {
    console.error("[roomLifecycle] audit failed:", err);
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Registra la entrada del administrador a la sala.
 * No cambia el estado de la asamblea — ya debe estar "in_progress".
 */
export async function onAdminJoined(
  assemblyId: string,
  propertyId: string,
  adminId:    string,
  adminName:  string,
): Promise<void> {
  await auditLifecycle(assemblyId, propertyId, "room_admin_joined", {
    participantIdentity: `admin-${adminId}`,
    participantName:     adminName,
    actorAdminId:        adminId,
  });

  console.log(`[roomLifecycle] Admin ${adminName} (${adminId}) entró a la sala ${assemblyId}`);
}

/**
 * Registra la salida temporal del administrador.
 * La sala permanece activa — el admin puede reconectar.
 */
export async function onAdminLeft(
  assemblyId: string,
  propertyId: string,
  adminId:    string,
  adminName:  string,
): Promise<void> {
  await auditLifecycle(assemblyId, propertyId, "room_admin_left", {
    participantIdentity: `admin-${adminId}`,
    participantName:     adminName,
    actorAdminId:        adminId,
    metadata:            { note: "Reconexión posible; sala sigue activa" },
  });

  console.log(
    `[roomLifecycle] Admin ${adminName} (${adminId}) salió temporalmente de la sala ${assemblyId}`,
  );
}

/**
 * Registra que todos los asistentes han salido de la sala.
 * No cierra la sala — el admin puede seguir conectado.
 */
export async function onAllAttendeesLeft(
  assemblyId: string,
  propertyId: string,
): Promise<void> {
  await auditLifecycle(assemblyId, propertyId, "room_all_attendees_left", {
    metadata: { note: "No hay asistentes; sala sigue abierta para el admin" },
  });

  console.log(`[roomLifecycle] Todos los asistentes salieron de la sala ${assemblyId}`);
}

/**
 * Cierre explícito de la sala por parte del administrador.
 *
 * Efectos:
 * 1. Cancela toda la cola activa (waiting, approved, speaking).
 * 2. Si hay un speaker activo, revoca sus permisos en LiveKit.
 * 3. Marca la asamblea como "closed" en BD.
 * 4. Registra room_closed en auditoría.
 *
 * Retorna el número de entradas de cola canceladas.
 */
export async function closeRoom(
  assemblyId: string,
  propertyId: string,
  adminId:    string,
): Promise<{ cancelledEntries: number }> {
  console.log(`[roomLifecycle] Cerrando sala ${assemblyId} por admin ${adminId}`);

  // 1. Revocar permisos del speaker activo antes de cancelar la cola
  const currentSpeaker = await getCurrentSpeaker(assemblyId);
  if (currentSpeaker) {
    try {
      await revokeParticipantSpeaker(propertyId, assemblyId, currentSpeaker.participantIdentity);
      console.log(
        `[roomLifecycle] Permisos revocados del speaker ${currentSpeaker.participantIdentity} al cerrar sala`,
      );
    } catch (lkErr) {
      console.error("[roomLifecycle] Fallo al revocar speaker al cerrar sala — encolando:", lkErr);
      await enqueueLiveKitAction({
        assemblyId,
        propertyId,
        roomName:            currentSpeaker.roomName,
        participantIdentity: currentSpeaker.participantIdentity,
        actionType:          "revoke_speaker",
      });
    }
  }

  // 2. Cancelar cola activa
  const cancelledEntries = await cancelAllActive(assemblyId, propertyId, adminId);
  console.log(`[roomLifecycle] ${cancelledEntries} entradas de cola canceladas`);

  // 3. Marcar asamblea como closed
  try {
    await prisma.assembly.update({
      where: { id: assemblyId },
      data:  { status: "closed" },
    });
  } catch (err) {
    console.error("[roomLifecycle] No se pudo actualizar el status de la asamblea a closed:", err);
  }

  // 4. Auditar
  await auditLifecycle(assemblyId, propertyId, "room_closed", {
    actorAdminId: adminId,
    metadata:     { cancelledEntries },
  });

  return { cancelledEntries };
}

/**
 * Verifica el estado actual de la sala derivado de la BD.
 *
 * Retorna:
 *  - assemblyStatus: el estado actual de la asamblea
 *  - hasActiveSpeaker: si hay un asistente con la palabra
 *  - currentSpeaker: el entry del speaker activo, o null
 */
export async function getRoomStatus(
  assemblyId: string,
  propertyId: string,
): Promise<{
  assemblyStatus: string;
  hasActiveSpeaker: boolean;
  currentSpeaker: Awaited<ReturnType<typeof getCurrentSpeaker>>;
}> {
  const [assembly, currentSpeaker] = await Promise.all([
    prisma.assembly.findFirst({ where: { id: assemblyId, propertyId } }),
    getCurrentSpeaker(assemblyId),
  ]);

  return {
    assemblyStatus:   assembly?.status ?? "unknown",
    hasActiveSpeaker: currentSpeaker !== null,
    currentSpeaker,
  };
}
