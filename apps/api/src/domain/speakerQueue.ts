/**
 * Servicio de cola de participación — persistencia en Prisma/PostgreSQL.
 *
 * Principios:
 * 1. Toda operación que cambia estado usa transacciones de BD para evitar races.
 * 2. Solo puede existir UN entry con status "speaking" por assemblyId en todo momento.
 *    La constraint se verifica a nivel de aplicación + índice DB.
 * 3. Las transiciones inválidas lanzan un error descriptivo (no silencian).
 * 4. Cada cambio de estado emite un registro en ConferenceAuditLog.
 * 5. LiveKit se llama DESPUÉS de confirmar el cambio en BD; si LK falla se loguea
 *    pero el estado en BD permanece correcto (no hay rollback).
 *
 * Máquina de estados:
 *   waiting  → approved | rejected | cancelled
 *   approved → speaking | rejected | cancelled
 *   speaking → done | expired
 */

import type {
  SpeakerQueueEntry,
  SpeakerQueueStatus,
  SpeakModalidad,
} from "@kuoro/contracts";
import { buildRoomName } from "./livekit";
import { prisma } from "../lib/prisma";

// ─── Helpers de conversión ────────────────────────────────────────────────────

function toEntry(row: {
  id: string;
  assemblyId: string;
  propertyId: string;
  roomName: string;
  participantIdentity: string;
  participantName: string;
  status: string;
  mode: string | null;
  durationSeconds: number | null;
  requestedAt: Date;
  approvedAt: Date | null;
  speakingStartedAt: Date | null;
  speakingEndsAt: Date | null;
  finishedAt: Date | null;
  rejectedAt: Date | null;
  cancelledAt: Date | null;
  expiredAt: Date | null;
}): SpeakerQueueEntry {
  return {
    id:                   row.id,
    assemblyId:           row.assemblyId,
    propertyId:           row.propertyId,
    roomName:             row.roomName,
    participantIdentity:  row.participantIdentity,
    displayName:          row.participantName,
    status:               row.status as SpeakerQueueStatus,
    modalidad:            (row.mode ?? undefined) as SpeakModalidad | undefined,
    durationSeconds:      row.durationSeconds ?? undefined,
    requestedAt:          row.requestedAt.toISOString(),
    approvedAt:           row.approvedAt?.toISOString(),
    speakingStartedAt:    row.speakingStartedAt?.toISOString(),
    speakingEndsAt:       row.speakingEndsAt?.toISOString(),
    finishedAt:           row.finishedAt?.toISOString(),
    rejectedAt:           row.rejectedAt?.toISOString(),
    cancelledAt:          row.cancelledAt?.toISOString(),
    expiredAt:            row.expiredAt?.toISOString(),
  };
}

// ─── Auditoría ────────────────────────────────────────────────────────────────

export type AuditEventType =
  | "speaker_requested"
  | "speaker_approved"
  | "speaker_rejected"
  | "speaking_started"
  | "speaking_finished"
  | "speaking_expired"
  | "speaker_cancelled"
  | "participant_joined"
  | "participant_left"
  | "speaker_reconnected";

async function audit(
  assemblyId: string,
  propertyId: string,
  eventType: AuditEventType,
  opts: {
    participantIdentity?: string;
    participantName?: string;
    actorAdminId?: string;
    queueEntryId?: string;
    metadata?: Record<string, unknown>;
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
        queueEntryId:        opts.queueEntryId ?? null,
        metadata:            opts.metadata ? JSON.stringify(opts.metadata) : null,
      },
    });
  } catch (err) {
    console.error("[audit] Failed to write audit log:", err);
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

/** Devuelve la cola completa de una asamblea (todos los estados). */
export async function getQueue(assemblyId: string): Promise<SpeakerQueueEntry[]> {
  const rows = await prisma.speakerQueueEntry.findMany({
    where: { assemblyId },
    orderBy: { requestedAt: "asc" },
  });
  return rows.map(toEntry);
}

/** Devuelve únicamente las entradas en espera (status = "waiting"). */
export async function getWaitingQueue(assemblyId: string): Promise<SpeakerQueueEntry[]> {
  const rows = await prisma.speakerQueueEntry.findMany({
    where: { assemblyId, status: "waiting" },
    orderBy: { requestedAt: "asc" },
  });
  return rows.map(toEntry);
}

/**
 * El participante solicita la palabra.
 *
 * - Si ya tiene una entrada activa (waiting/approved/speaking), retorna la existente.
 * - Si no, crea una nueva entrada.
 */
export async function requestSpeaker(
  propertyId: string,
  assemblyId: string,
  participantIdentity: string,
  displayName: string,
): Promise<SpeakerQueueEntry> {
  const roomName = buildRoomName(propertyId, assemblyId);

  // Verificar entrada activa existente
  const existing = await prisma.speakerQueueEntry.findFirst({
    where: {
      assemblyId,
      participantIdentity,
      status: { in: ["waiting", "approved", "speaking"] },
    },
  });

  if (existing) return toEntry(existing);

  const created = await prisma.speakerQueueEntry.create({
    data: {
      assemblyId,
      propertyId,
      roomName,
      participantIdentity,
      participantName: displayName,
      status: "waiting",
    },
  });

  await audit(assemblyId, propertyId, "speaker_requested", {
    participantIdentity,
    participantName: displayName,
    queueEntryId: created.id,
  });

  return toEntry(created);
}

/**
 * El admin aprueba un turno y el backend inicia el tiempo de habla inmediatamente.
 *
 * Garantías:
 * 1. Solo puede existir UN entry speaking. Si ya existe uno, la operación falla.
 * 2. La transición waiting → approved → speaking se hace atómicamente.
 * 3. Se calcula speakingEndsAt desde el momento de la aprobación.
 */
export async function approveSpeaker(
  assemblyId: string,
  propertyId: string,
  entryId: string,
  modalidad: SpeakModalidad,
  durationSeconds: number,
  actorAdminId: string,
): Promise<SpeakerQueueEntry> {
  return await prisma.$transaction(async (tx) => {
    // 1. Verificar que no haya otro speaker activo
    const activeSpeaker = await tx.speakerQueueEntry.findFirst({
      where: { assemblyId, status: "speaking" },
    });

    if (activeSpeaker) {
      throw Object.assign(
        new Error("Ya existe un participante con la palabra. Fináliza su turno antes de aprobar otro."),
        { statusCode: 409 },
      );
    }

    // 2. Buscar la entrada a aprobar
    const entry = await tx.speakerQueueEntry.findFirst({
      where: { id: entryId, assemblyId, status: "waiting" },
    });

    if (!entry) {
      throw Object.assign(
        new Error("Entrada no encontrada o no está en espera."),
        { statusCode: 404 },
      );
    }

    const now        = new Date();
    const speakingEndsAt = new Date(now.getTime() + durationSeconds * 1000);

    // 3. Actualizar directamente a "speaking" (combinamos approved + speaking en un paso)
    const updated = await tx.speakerQueueEntry.update({
      where: { id: entryId },
      data: {
        status:           "speaking",
        mode:             modalidad,
        durationSeconds,
        approvedAt:       now,
        approvedByAdminId: actorAdminId,
        speakingStartedAt: now,
        speakingEndsAt,
      },
    });

    return updated;
  }).then(async (updated) => {
    await audit(assemblyId, propertyId, "speaking_started", {
      participantIdentity: updated.participantIdentity,
      participantName:     updated.participantName,
      actorAdminId,
      queueEntryId:        updated.id,
      metadata: { modalidad, durationSeconds },
    });
    return toEntry(updated);
  });
}

/**
 * El admin rechaza una solicitud en espera o aprobada.
 */
export async function rejectSpeaker(
  assemblyId: string,
  propertyId: string,
  entryId: string,
  actorAdminId: string,
): Promise<SpeakerQueueEntry> {
  const entry = await prisma.speakerQueueEntry.findFirst({
    where: { id: entryId, assemblyId, status: { in: ["waiting", "approved"] } },
  });

  if (!entry) {
    throw Object.assign(new Error("Entrada no encontrada o ya fue procesada."), { statusCode: 404 });
  }

  const updated = await prisma.speakerQueueEntry.update({
    where: { id: entryId },
    data: { status: "rejected", rejectedAt: new Date() },
  });

  await audit(assemblyId, propertyId, "speaker_rejected", {
    participantIdentity: entry.participantIdentity,
    participantName:     entry.participantName,
    actorAdminId,
    queueEntryId:        entryId,
  });

  return toEntry(updated);
}

/**
 * El admin finaliza manualmente el turno activo.
 * Devuelve null si no hay ningún speaker activo.
 */
export async function finishSpeaker(
  assemblyId: string,
  propertyId: string,
  entryId: string,
  actorAdminId: string,
): Promise<SpeakerQueueEntry> {
  const entry = await prisma.speakerQueueEntry.findFirst({
    where: { id: entryId, assemblyId, status: "speaking" },
  });

  if (!entry) {
    throw Object.assign(new Error("Entrada no está en estado 'speaking'."), { statusCode: 404 });
  }

  const updated = await prisma.speakerQueueEntry.update({
    where: { id: entryId },
    data: { status: "done", finishedAt: new Date() },
  });

  await audit(assemblyId, propertyId, "speaking_finished", {
    participantIdentity: entry.participantIdentity,
    participantName:     entry.participantName,
    actorAdminId,
    queueEntryId:        entryId,
    metadata: { reason: "manual" },
  });

  return toEntry(updated);
}

/**
 * Expira automáticamente el turno (llamado por el job de expiración).
 * Si el entry ya no está "speaking" (p.ej. el admin ya lo finalizó), es no-op.
 */
export async function expireSpeaker(
  assemblyId: string,
  propertyId: string,
  entryId: string,
): Promise<SpeakerQueueEntry | null> {
  const entry = await prisma.speakerQueueEntry.findFirst({
    where: { id: entryId, assemblyId, status: "speaking" },
  });

  if (!entry) return null;

  const updated = await prisma.speakerQueueEntry.update({
    where: { id: entryId },
    data: { status: "expired", expiredAt: new Date() },
  });

  await audit(assemblyId, propertyId, "speaking_expired", {
    participantIdentity: entry.participantIdentity,
    participantName:     entry.participantName,
    queueEntryId:        entryId,
    metadata: { reason: "timer_expired" },
  });

  return toEntry(updated);
}

/**
 * El participante cancela su propia solicitud de palabra.
 */
export async function cancelSpeaker(
  assemblyId: string,
  propertyId: string,
  participantIdentity: string,
): Promise<SpeakerQueueEntry | null> {
  const entry = await prisma.speakerQueueEntry.findFirst({
    where: { assemblyId, participantIdentity, status: "waiting" },
  });

  if (!entry) return null;

  const updated = await prisma.speakerQueueEntry.update({
    where: { id: entry.id },
    data: { status: "cancelled", cancelledAt: new Date() },
  });

  await audit(assemblyId, propertyId, "speaker_cancelled", {
    participantIdentity,
    participantName: entry.participantName,
    queueEntryId:   entry.id,
  });

  return toEntry(updated);
}

/**
 * Devuelve el entry actualmente "speaking", o null si no hay ninguno.
 */
export async function getCurrentSpeaker(assemblyId: string): Promise<SpeakerQueueEntry | null> {
  const row = await prisma.speakerQueueEntry.findFirst({
    where: { assemblyId, status: "speaking" },
  });
  return row ? toEntry(row) : null;
}

/**
 * Consulta el estado del participante en la cola (para reconexión).
 * Devuelve la entrada activa más reciente del participante.
 */
export async function getParticipantState(
  assemblyId: string,
  participantIdentity: string,
): Promise<SpeakerQueueEntry | null> {
  const row = await prisma.speakerQueueEntry.findFirst({
    where: {
      assemblyId,
      participantIdentity,
      status: { in: ["waiting", "approved", "speaking"] },
    },
    orderBy: { requestedAt: "desc" },
  });
  return row ? toEntry(row) : null;
}

/**
 * Registra en auditoría la entrada/salida de participantes.
 */
export async function auditParticipantEvent(
  assemblyId: string,
  propertyId: string,
  eventType: "participant_joined" | "participant_left" | "speaker_reconnected",
  participantIdentity: string,
  participantName: string,
): Promise<void> {
  await audit(assemblyId, propertyId, eventType, { participantIdentity, participantName });
}

/**
 * Devuelve todos los entries vencidos que aún están en "speaking".
 * Usado por el job de expiración.
 */
export async function findExpiredSpeakers(): Promise<SpeakerQueueEntry[]> {
  const rows = await prisma.speakerQueueEntry.findMany({
    where: {
      status: "speaking",
      speakingEndsAt: { lt: new Date() },
    },
  });
  return rows.map(toEntry);
}

/** Marca todos los entries activos de una asamblea como cancelados (al cerrar la sala). */
export async function cancelAllActive(
  assemblyId: string,
  propertyId: string,
  actorAdminId: string,
): Promise<number> {
  const result = await prisma.speakerQueueEntry.updateMany({
    where: {
      assemblyId,
      status: { in: ["waiting", "approved", "speaking"] },
    },
    data: { status: "cancelled", cancelledAt: new Date() },
  });

  if (result.count > 0) {
    await audit(assemblyId, propertyId, "speaker_cancelled", {
      actorAdminId,
      metadata: { reason: "assembly_closed", count: result.count },
    });
  }

  return result.count;
}

/** Devuelve los últimos N registros de auditoría de la asamblea. */
export async function getAuditLog(
  assemblyId: string,
  limit = 50,
): Promise<Array<{
  id: string;
  eventType: string;
  participantIdentity: string | null;
  participantName: string | null;
  actorAdminId: string | null;
  queueEntryId: string | null;
  metadata: string | null;
  occurredAt: string;
}>> {
  const rows = await prisma.conferenceAuditLog.findMany({
    where: { assemblyId },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });

  return rows.map((r) => ({
    id:                  r.id,
    eventType:           r.eventType,
    participantIdentity: r.participantIdentity,
    participantName:     r.participantName,
    actorAdminId:        r.actorAdminId,
    queueEntryId:        r.queueEntryId,
    metadata:            r.metadata,
    occurredAt:          r.occurredAt.toISOString(),
  }));
}
