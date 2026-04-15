/**
 * Hook de cola de participación — conectado al backend persistido.
 *
 * Para el ADMIN:
 *   - Hace polling de la cola completa cada `intervalMs` (2 s).
 *   - Expone helpers para aprobar, rechazar y finalizar turnos.
 *   - El cronómetro se calcula a partir de `speakingEndsAt` que viene del backend.
 *
 * Para el ASISTENTE:
 *   - Hace polling de su propio estado con el endpoint /my-state.
 *   - Solicitar la palabra, cancelar, ver cronómetro.
 *   - Tras reconexión, restaura el estado correcto desde el servidor.
 *
 * El job de expiración en el backend revoca permisos automáticamente;
 * el frontend solo necesita reflejar el estado real de la BD.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { SpeakerApproveInput, SpeakerQueueEntry } from "@kuoro/contracts";
import {
  approveSpeakerTurn,
  clearConferenceQueue,
  fetchParticipantState,
  fetchSpeakerQueue,
  finishSpeakerTurn,
  rejectSpeakerTurn,
  requestSpeakerTurn,
} from "../lib/api";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface UseSpeakerQueueOptions {
  propertyId: string;
  assemblyId: string;
  localIdentity: string;
  /** "admin" hace polling de cola completa; "attendee" hace polling de /my-state. */
  mode: "admin" | "attendee";
  /** true = sondeo activo. */
  enabled: boolean;
  intervalMs?: number;
  /** Callback cuando el turno del participante local expira/termina. */
  onTurnEnded?: (entry: SpeakerQueueEntry) => void;
}

interface UseSpeakerQueueReturn {
  queue: SpeakerQueueEntry[];
  currentSpeaker: SpeakerQueueEntry | null;
  myEntry: SpeakerQueueEntry | null;
  iAmWaiting: boolean;
  iAmSpeaking: boolean;
  iAmApproved: boolean;
  /** Segundos restantes del turno activo (0 si no hay). */
  secondsLeft: number;
  /** Segundos totales del turno activo (para calcular %). */
  totalSeconds: number;
  isLoading: boolean;
  error: string | null;
  requestTurn: (displayName: string) => Promise<void>;
  approveTurn: (entryId: string, input: SpeakerApproveInput) => Promise<void>;
  rejectTurn: (entryId: string) => Promise<void>;
  finishTurn: (entryId: string) => Promise<void>;
  clearQueue: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSpeakerQueue({
  propertyId,
  assemblyId,
  localIdentity,
  mode,
  enabled,
  intervalMs = 2000,
  onTurnEnded,
}: UseSpeakerQueueOptions): UseSpeakerQueueReturn {
  const [queue, setQueue]          = useState<SpeakerQueueEntry[]>([]);
  const [myEntry, setMyEntry]      = useState<SpeakerQueueEntry | null>(null);
  const [secondsLeft, setSecsLeft] = useState(0);
  const [totalSeconds, setTotal]   = useState(0);
  const [isLoading, setIsLoading]  = useState(false);
  const [error, setError]          = useState<string | null>(null);

  const timerRef        = useRef<number | null>(null);
  const pollRef         = useRef<number | null>(null);
  const endedNotifyRef  = useRef<Set<string>>(new Set());

  // ── Derivados ────────────────────────────────────────────────────────────────

  // El speaker activo de la cola completa (para el admin)
  const currentSpeaker = queue.find((e) => e.status === "speaking") ?? null;

  // Para el asistente usamos myEntry; para el admin buscamos en la cola completa
  const effectiveMyEntry = mode === "attendee"
    ? myEntry
    : (queue.find((e) => e.participantIdentity === localIdentity &&
        (e.status === "waiting" || e.status === "approved" || e.status === "speaking")) ?? null);

  const iAmWaiting  = effectiveMyEntry?.status === "waiting";
  const iAmApproved = effectiveMyEntry?.status === "approved";
  const iAmSpeaking = effectiveMyEntry?.status === "speaking";

  // ── Cronómetro ───────────────────────────────────────────────────────────────

  // El speaker que debemos cronometrar: mi turno si soy asistente, el speaker activo si soy admin
  const trackedEntry = iAmSpeaking ? effectiveMyEntry : currentSpeaker;

  useEffect(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);

    if (!trackedEntry?.speakingEndsAt || !trackedEntry.speakingStartedAt) {
      setSecsLeft(0);
      setTotal(0);
      return;
    }

    const endsAt    = new Date(trackedEntry.speakingEndsAt).getTime();
    const startedAt = new Date(trackedEntry.speakingStartedAt).getTime();
    const total     = Math.round((endsAt - startedAt) / 1000);
    setTotal(total);

    const update = () => {
      const remaining = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setSecsLeft(remaining);

      if (remaining === 0 && !endedNotifyRef.current.has(trackedEntry.id)) {
        endedNotifyRef.current.add(trackedEntry.id);
        onTurnEnded?.(trackedEntry);
      }
    };

    update();
    timerRef.current = window.setInterval(update, 1000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedEntry?.id, trackedEntry?.speakingEndsAt]);

  // ── Polling ──────────────────────────────────────────────────────────────────

  const poll = useCallback(async () => {
    if (!propertyId || !assemblyId) return;

    try {
      if (mode === "admin") {
        const res = await fetchSpeakerQueue(propertyId, assemblyId);
        setQueue(res.queue);
      } else {
        // Asistente: solo necesita su propio estado
        const res = await fetchParticipantState(propertyId, assemblyId, localIdentity);
        setMyEntry(res.entry);

        // También actualiza la cola para mostrar el speaker activo en el componente
        // (se hace en segundo plano, no bloquea el estado propio del asistente)
        fetchSpeakerQueue(propertyId, assemblyId)
          .then((r) => setQueue(r.queue))
          .catch(() => {});
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar la cola");
    }
  }, [propertyId, assemblyId, mode, localIdentity]);

  useEffect(() => {
    if (!enabled) {
      if (pollRef.current) window.clearInterval(pollRef.current);
      return;
    }

    void poll();
    pollRef.current = window.setInterval(() => void poll(), intervalMs);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [enabled, intervalMs, poll]);

  // ── Acciones ─────────────────────────────────────────────────────────────────

  const requestTurn = useCallback(async (displayName: string) => {
    setIsLoading(true);
    try {
      await requestSpeakerTurn(propertyId, assemblyId, {
        participantIdentity: localIdentity,
        displayName,
      });
      await poll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al solicitar la palabra");
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, assemblyId, localIdentity, poll]);

  const approveTurn = useCallback(async (entryId: string, input: SpeakerApproveInput) => {
    setIsLoading(true);
    try {
      await approveSpeakerTurn(propertyId, assemblyId, entryId, input);
      await poll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al aprobar el turno");
      throw err; // re-lanzar para que el componente muestre el error
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, assemblyId, poll]);

  const rejectTurn = useCallback(async (entryId: string) => {
    setIsLoading(true);
    try {
      await rejectSpeakerTurn(propertyId, assemblyId, entryId);
      await poll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al rechazar el turno");
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, assemblyId, poll]);

  const finishTurn = useCallback(async (entryId: string) => {
    setIsLoading(true);
    try {
      await finishSpeakerTurn(propertyId, assemblyId, entryId);
      await poll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al finalizar el turno");
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, assemblyId, poll]);

  const handleClearQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      await clearConferenceQueue(propertyId, assemblyId);
      setQueue([]);
      setMyEntry(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al limpiar la cola");
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, assemblyId]);

  return {
    queue,
    currentSpeaker,
    myEntry: effectiveMyEntry,
    iAmWaiting,
    iAmSpeaking,
    iAmApproved,
    secondsLeft,
    totalSeconds,
    isLoading,
    error,
    requestTurn,
    approveTurn,
    rejectTurn,
    finishTurn,
    clearQueue: handleClearQueue,
  };
}
