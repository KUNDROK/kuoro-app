/**
 * Job de expiración de turnos de conferencia.
 *
 * Corre cada POLL_INTERVAL_MS milisegundos y:
 * 1. Busca en BD todos los entries "speaking" cuyo speakingEndsAt ya pasó.
 * 2. Los marca como "expired".
 * 3. Revoca permisos en LiveKit.
 *
 * Funciona aunque el frontend del admin esté cerrado.
 * Es seguro ejecutar en múltiples instancias del backend: la actualización
 * de BD usa el campo de estado como guard (solo procesa entradas "speaking").
 */

import { findExpiredSpeakers, expireSpeaker } from "./speakerQueue";
import { revokeParticipantSpeaker } from "./livekit";
import { enqueueLiveKitAction } from "./reconciliation";
import { logger } from "../lib/logger";

const POLL_INTERVAL_MS = 5_000; // revisar cada 5 segundos

let jobHandle: NodeJS.Timeout | null = null;

async function runExpiryCheck(): Promise<void> {
  try {
    const expired = await findExpiredSpeakers();

    for (const entry of expired) {
      logger.info("expiryJob", "Expirando turno", {
        entryId:             entry.id,
        participantIdentity: entry.participantIdentity,
        assemblyId:          entry.assemblyId,
        speakingEndsAt:      entry.speakingEndsAt,
      });

      // 1. Actualizar estado en BD (puede ser no-op si ya fue procesado por otro proceso)
      const updated = await expireSpeaker(entry.assemblyId, entry.propertyId, entry.id);
      if (!updated) {
        logger.debug("expiryJob", "Turno ya procesado (no-op)", { entryId: entry.id });
        continue;
      }

      // 2. Revocar permisos en LiveKit (puede fallar si el participante ya se desconectó)
      try {
        await revokeParticipantSpeaker(
          entry.propertyId,
          entry.assemblyId,
          entry.participantIdentity,
        );
        logger.info("expiryJob", "Permisos revocados en LiveKit", {
          participantIdentity: entry.participantIdentity,
          assemblyId:          entry.assemblyId,
        });
      } catch (lkErr) {
        logger.error("expiryJob", "LiveKit revoke failed — encolando para reintento", {
          participantIdentity: entry.participantIdentity,
          assemblyId:          entry.assemblyId,
          error:               lkErr instanceof Error ? lkErr.message : String(lkErr),
        });
        // Registrar para reintento — la BD ya refleja "expired"
        await enqueueLiveKitAction({
          assemblyId:          entry.assemblyId,
          propertyId:          entry.propertyId,
          roomName:            entry.roomName,
          participantIdentity: entry.participantIdentity,
          actionType:          "revoke_speaker",
        });
      }
    }
  } catch (err) {
    logger.error("expiryJob", "Error durante la revisión de expiración", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Inicia el job de expiración. Llamar una sola vez desde server.ts. */
export function startExpiryJob(): void {
  if (jobHandle) return;

  logger.info("expiryJob", "Job iniciado", { intervalMs: POLL_INTERVAL_MS });

  // Primera ejecución inmediata al arrancar
  void runExpiryCheck();

  jobHandle = setInterval(() => {
    void runExpiryCheck();
  }, POLL_INTERVAL_MS);
}

/** Detiene el job (útil en tests o shutdown graceful). */
export function stopExpiryJob(): void {
  if (jobHandle) {
    clearInterval(jobHandle);
    jobHandle = null;
    logger.info("expiryJob", "Job detenido");
  }
}
