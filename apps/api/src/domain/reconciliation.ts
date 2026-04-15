/**
 * Servicio de reconciliación de operaciones LiveKit.
 *
 * ## Problema que resuelve
 * LiveKit puede fallar de forma transitoria (timeout, reinicio del servidor,
 * pérdida de red). Cuando eso ocurre, la base de datos ya refleja el estado
 * correcto, pero LiveKit queda desincronizado temporalmente.
 *
 * Este módulo ofrece:
 * 1. `enqueueLiveKitAction(...)` — registra una acción pendiente cuando
 *    la llamada inicial a LiveKit falla.
 * 2. `runReconciliation()` — reintenta las acciones pendientes con backoff.
 * 3. `startReconciliationJob()` / `stopReconciliationJob()` — arrancan el
 *    job periódico desde server.ts.
 *
 * ## Invariantes de seguridad
 * - NUNCA revoca permisos de una identity que empiece con "admin-".
 *   El admin tiene permisos permanentes y no debe ser afectado por la
 *   reconciliación del turno temporal de un asistente.
 * - Las acciones `elevate_speaker` y `revoke_speaker` solo aplican a
 *   identidades de asistentes.
 */

import { prisma } from "../lib/prisma";
import {
  elevateParticipantToSpeaker,
  revokeParticipantSpeaker,
  isAdminIdentity,
} from "./livekit";
import { logger } from "../lib/logger";
import type { SpeakModalidad } from "@kuoro/contracts";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PendingActionType = "revoke_speaker" | "elevate_speaker" | "mute_tracks";

interface ElevatePayload {
  modalidad: SpeakModalidad;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const RECONCILIATION_INTERVAL_MS = 10_000;  // revisar cada 10 segundos
const MAX_ATTEMPTS               = 5;
const BASE_BACKOFF_MS            = 2_000;   // 2s, 4s, 8s, 16s, 32s

let jobHandle: NodeJS.Timeout | null = null;

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Registra una acción LiveKit pendiente de reintentar.
 * Llamar cuando una operación LiveKit falla (en catch blocks).
 */
export async function enqueueLiveKitAction(opts: {
  assemblyId:          string;
  propertyId:          string;
  roomName:            string;
  participantIdentity: string;
  actionType:          PendingActionType;
  payload?:            Record<string, unknown>;
}): Promise<void> {
  // Guardia de seguridad: nunca encolar acciones sobre el admin
  if (isAdminIdentity(opts.participantIdentity)) {
    logger.warn("reconciliation", "Acción sobre identity de admin ignorada", {
      identity:   opts.participantIdentity,
      actionType: opts.actionType,
    });
    return;
  }

  try {
    await prisma.liveKitPendingAction.create({
      data: {
        assemblyId:          opts.assemblyId,
        propertyId:          opts.propertyId,
        roomName:            opts.roomName,
        participantIdentity: opts.participantIdentity,
        actionType:          opts.actionType,
        payload:             opts.payload ? JSON.stringify(opts.payload) : null,
        status:              "pending",
        maxAttempts:         MAX_ATTEMPTS,
      },
    });

    logger.info("reconciliation", "Acción encolada para reintento", {
      actionType:  opts.actionType,
      identity:    opts.participantIdentity,
      assemblyId:  opts.assemblyId,
    });
  } catch (err) {
    logger.error("reconciliation", "No se pudo encolar la acción pendiente", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Ejecuta un ciclo de reconciliación:
 * 1. Carga acciones en estado "pending" con backoff adecuado.
 * 2. Las reintenta según su actionType.
 * 3. Actualiza el estado (done / failed / retry counter).
 */
export async function runReconciliation(): Promise<void> {
  try {
    await runReconciliationInner();
  } catch (err) {
    // Evita unhandledRejection: void runReconciliation() al arrancar tumbaría el proceso si la BD no responde o faltan tablas.
    logger.error("reconciliation", "Ciclo de reconciliación abortado", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function runReconciliationInner(): Promise<void> {
  const now = new Date();

  // Buscar acciones pendientes que ya pasaron el tiempo de backoff
  const pending = await prisma.liveKitPendingAction.findMany({
    where: {
      status: { in: ["pending", "retrying"] },
      attempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  for (const action of pending) {
    // Calcular backoff exponencial: 2s, 4s, 8s, …
    const backoffMs = BASE_BACKOFF_MS * Math.pow(2, action.attempts);
    const nextRetryAt = action.lastAttemptAt
      ? new Date(action.lastAttemptAt.getTime() + backoffMs)
      : new Date(action.createdAt.getTime());

    if (now < nextRetryAt) continue;

    // Guardia de seguridad en la ejecución también
    if (isAdminIdentity(action.participantIdentity)) {
      await prisma.liveKitPendingAction.update({
        where: { id: action.id },
        data:  { status: "failed", lastError: "Blocked: admin identity", resolvedAt: now },
      });
      logger.warn("reconciliation", "Acción sobre admin bloqueada en reconciliación", {
        actionId: action.id,
        identity: action.participantIdentity,
      });
      continue;
    }

    await prisma.liveKitPendingAction.update({
      where: { id: action.id },
      data:  { status: "retrying", attempts: { increment: 1 }, lastAttemptAt: now },
    });

    let success = false;
    let errorMsg = "";

    try {
      await executeAction(action.actionType as PendingActionType, {
        propertyId:          action.propertyId,
        assemblyId:          action.assemblyId,
        participantIdentity: action.participantIdentity,
        payload:             action.payload ? JSON.parse(action.payload) as Record<string, unknown> : undefined,
      });
      success = true;
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err);
      logger.warn("reconciliation", "Reintento fallido", {
        attempt:    action.attempts + 1,
        maxAttempts: action.maxAttempts,
        actionType: action.actionType,
        actionId:   action.id,
        error:      errorMsg,
      });
    }

    const newAttempts = action.attempts + 1;
    if (success) {
      await prisma.liveKitPendingAction.update({
        where: { id: action.id },
        data:  { status: "done", resolvedAt: now, lastError: null },
      });
      logger.info("reconciliation", "Acción completada", {
        actionType: action.actionType,
        actionId:   action.id,
        attempts:   newAttempts,
      });
    } else if (newAttempts >= action.maxAttempts) {
      await prisma.liveKitPendingAction.update({
        where: { id: action.id },
        data:  { status: "failed", lastError: errorMsg, resolvedAt: now },
      });
      logger.error("reconciliation", "Acción agotó reintentos — requiere intervención manual", {
        actionType:  action.actionType,
        actionId:    action.id,
        maxAttempts: action.maxAttempts,
        lastError:   errorMsg,
        identity:    action.participantIdentity,
        assemblyId:  action.assemblyId,
      });
    } else {
      await prisma.liveKitPendingAction.update({
        where: { id: action.id },
        data:  { status: "pending", lastError: errorMsg },
      });
    }
  }
}

/** Ejecuta la acción LiveKit correspondiente. */
async function executeAction(
  actionType: PendingActionType,
  opts: {
    propertyId:          string;
    assemblyId:          string;
    participantIdentity: string;
    payload?:            Record<string, unknown>;
  },
): Promise<void> {
  switch (actionType) {
    case "revoke_speaker":
      await revokeParticipantSpeaker(opts.propertyId, opts.assemblyId, opts.participantIdentity);
      break;

    case "elevate_speaker": {
      const p = opts.payload as ElevatePayload | undefined;
      const modalidad: SpeakModalidad = p?.modalidad ?? "mic";
      await elevateParticipantToSpeaker(opts.propertyId, opts.assemblyId, opts.participantIdentity, modalidad);
      break;
    }

    case "mute_tracks":
      // Para mute, usamos revokeParticipantSpeaker que incluye el silenciado de tracks
      await revokeParticipantSpeaker(opts.propertyId, opts.assemblyId, opts.participantIdentity);
      break;

    default:
      throw new Error(`actionType desconocido: ${String(actionType)}`);
  }
}

// ─── Job periódico ────────────────────────────────────────────────────────────

export function startReconciliationJob(): void {
  if (jobHandle) return;

  logger.info("reconciliation", "Job iniciado", { intervalMs: RECONCILIATION_INTERVAL_MS });
  void runReconciliation();

  jobHandle = setInterval(() => {
    void runReconciliation();
  }, RECONCILIATION_INTERVAL_MS);
}

export function stopReconciliationJob(): void {
  if (jobHandle) {
    clearInterval(jobHandle);
    jobHandle = null;
    logger.info("reconciliation", "Job detenido");
  }
}

// ─── Helpers de consulta (para monitoreo) ─────────────────────────────────────

/** Devuelve el número de acciones pendientes (útil para healthcheck). */
export async function countPendingActions(): Promise<number> {
  return prisma.liveKitPendingAction.count({
    where: { status: { in: ["pending", "retrying"] } },
  });
}

/** Devuelve las acciones fallidas recientes (para alertas). */
export async function getFailedActions(assemblyId?: string, limit = 20) {
  return prisma.liveKitPendingAction.findMany({
    where: {
      status: "failed",
      ...(assemblyId ? { assemblyId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}
