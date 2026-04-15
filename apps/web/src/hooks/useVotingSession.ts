/**
 * Hook para gestionar el estado de una sesión de votación en tiempo real.
 *
 * Modos:
 * - "admin":    Accede a la sesión activa con conteos en vivo. No necesita accessToken.
 * - "attendee": Accede a la vista del asistente con su elegibilidad y voto. Requiere accessToken.
 *
 * Polling: 3 segundos (consistente con useSpeakerQueue).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type {
  VotingSessionSummary,
  VotingSessionAttendeeView,
  VoteValue,
  OpenVotingSessionInput,
} from "@kuoro/contracts";
import {
  fetchActiveVotingSession,
  fetchAttendeeVotingView,
  openVotingSession,
  castVote as apiCastVote,
  closeVotingSession,
  cancelVotingSession,
} from "../lib/api";

const POLL_INTERVAL_MS = 3_000;

// ─── Modo admin ───────────────────────────────────────────────────────────────

export interface UseVotingSessionAdminOptions {
  mode: "admin";
  propertyId: string;
  assemblyId: string;
}

export interface UseVotingSessionAdminResult {
  session:    VotingSessionSummary | null;
  isLoading:  boolean;
  error:      string | null;
  openSession:   (input: OpenVotingSessionInput) => Promise<VotingSessionSummary>;
  closeSession:  () => Promise<VotingSessionSummary | null>;
  cancelSession: () => Promise<void>;
  refresh:    () => void;
}

// ─── Modo attendee ────────────────────────────────────────────────────────────

export interface UseVotingSessionAttendeeOptions {
  mode: "attendee";
  propertyId:  string;
  assemblyId:  string;
  sessionId?:  string;
  accessToken: string;
}

export interface UseVotingSessionAttendeeResult {
  view:       VotingSessionAttendeeView | null;
  isLoading:  boolean;
  isVoting:   boolean;
  error:      string | null;
  castVote:   (value: VoteValue) => Promise<void>;
  refresh:    () => void;
}

// ─── Implementación admin ─────────────────────────────────────────────────────

export function useVotingSessionAdmin(
  opts: UseVotingSessionAdminOptions,
): UseVotingSessionAdminResult {
  const { propertyId, assemblyId } = opts;

  const [session, setSession]   = useState<VotingSessionSummary | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const pollRef                 = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    try {
      const res = await fetchActiveVotingSession(propertyId, assemblyId);
      setSession(res.session);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al obtener la sesión");
    } finally {
      setLoading(false);
    }
  }, [propertyId, assemblyId]);

  useEffect(() => {
    void fetch();
    pollRef.current = setInterval(() => { void fetch(); }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetch]);

  const openSession = useCallback(async (input: OpenVotingSessionInput) => {
    setError(null);
    try {
      const res = await openVotingSession(propertyId, assemblyId, input);
      setSession(res.session);
      return res.session;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al abrir la sesión";
      setError(msg);
      throw err;
    }
  }, [propertyId, assemblyId]);

  const closeSession = useCallback(async () => {
    if (!session) return null;
    setError(null);
    try {
      const res = await closeVotingSession(propertyId, assemblyId, session.id);
      setSession(res.session);
      return res.session;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cerrar la sesión";
      setError(msg);
      throw err;
    }
  }, [propertyId, assemblyId, session]);

  const cancelSession = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      await cancelVotingSession(propertyId, assemblyId, session.id);
      setSession(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cancelar la sesión";
      setError(msg);
      throw err;
    }
  }, [propertyId, assemblyId, session]);

  const refresh = useCallback(() => { void fetch(); }, [fetch]);

  return { session, isLoading, error, openSession, closeSession, cancelSession, refresh };
}

// ─── Implementación attendee ──────────────────────────────────────────────────

export function useVotingSessionAttendee(
  opts: UseVotingSessionAttendeeOptions,
): UseVotingSessionAttendeeResult {
  const { propertyId, assemblyId, accessToken } = opts;

  const [view, setView]         = useState<VotingSessionAttendeeView | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>(opts.sessionId);
  const pollRef                 = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    if (!accessToken) return;

    try {
      // Si no tenemos sessionId, buscamos la sesión activa
      if (!sessionId) {
        const activeRes = await fetchActiveVotingSession(propertyId, assemblyId);
        if (!activeRes.session) {
          setView(null);
          setError(null);   // Clear any stale error from previous transient failures
          setLoading(false);
          return;
        }
        setSessionId(activeRes.session.id);
        const res = await fetchAttendeeVotingView(propertyId, assemblyId, activeRes.session.id, accessToken);
        setView(res.view);
      } else {
        const res = await fetchAttendeeVotingView(propertyId, assemblyId, sessionId, accessToken);
        setView(res.view);
        // Si la sesión que seguíamos se cerró, podría haber una nueva
        if (res.view.status === "closed" || res.view.status === "cancelled") {
          const activeRes = await fetchActiveVotingSession(propertyId, assemblyId);
          if (activeRes.session && activeRes.session.id !== sessionId) {
            setSessionId(activeRes.session.id);
          }
        }
      }
      setError(null);
    } catch (err) {
      // Mostrar el error para facilitar diagnóstico sin saturar la consola
      const msg = err instanceof Error ? err.message : "Error al obtener sesión de votación";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [propertyId, assemblyId, accessToken, sessionId]);

  useEffect(() => {
    void fetch();
    pollRef.current = setInterval(() => { void fetch(); }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetch]);

  const castVote = useCallback(async (voteValue: VoteValue) => {
    if (!sessionId || !accessToken) return;
    setIsVoting(true);
    setError(null);
    try {
      await apiCastVote(propertyId, assemblyId, sessionId, { accessToken, voteValue });
      // Actualizar inmediatamente tras votar
      const res = await fetchAttendeeVotingView(propertyId, assemblyId, sessionId, accessToken);
      setView(res.view);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al emitir voto";
      setError(msg);
      throw err;
    } finally {
      setIsVoting(false);
    }
  }, [propertyId, assemblyId, sessionId, accessToken]);

  const refresh = useCallback(() => { void fetch(); }, [fetch]);

  return { view, isLoading, isVoting, error, castVote, refresh };
}
