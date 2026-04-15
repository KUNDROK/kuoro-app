/**
 * Hook de representaciones de voto.
 *
 * Modos:
 *   admin    — lista todas las representaciones de la asamblea; expone
 *              acciones seed / createProxy / revoke / reactivate.
 *   attendee — lee la elegibilidad multi-unidad del representante en
 *              la sesión activa. Usado internamente por useVotingSession.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  AssemblyRepresentationSummary,
  CreateProxyRepresentationInput,
  SeedRepresentationsResult,
  VotingEligibilitySummary,
} from "@kuoro/contracts";
import {
  seedRepresentations,
  createRepresentation,
  fetchRepresentations,
  revokeRepresentation,
  reactivateRepresentation,
  fetchMyEligibility,
} from "../lib/api";

const POLL_INTERVAL = 4000; // ms

// ─── Modo admin ───────────────────────────────────────────────────────────────

export type UseRepresentationsAdminState = {
  representations: AssemblyRepresentationSummary[];
  loading: boolean;
  error: string | null;
  seed: () => Promise<SeedRepresentationsResult>;
  createProxy: (input: CreateProxyRepresentationInput) => Promise<AssemblyRepresentationSummary>;
  revoke: (representationId: string) => Promise<void>;
  reactivate: (representationId: string) => Promise<void>;
  refresh: () => void;
};

export function useRepresentationsAdmin(
  propertyId: string,
  assemblyId: string,
  enabled = true,
): UseRepresentationsAdminState {
  const [representations, setRepresentations] = useState<AssemblyRepresentationSummary[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState<string | null>(null);
  const intervalRef                           = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await fetchRepresentations(propertyId, assemblyId);
      setRepresentations(data.representations);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando representaciones");
    } finally {
      setLoading(false);
    }
  }, [propertyId, assemblyId, enabled]);

  useEffect(() => {
    if (!enabled) return;
    void load();
    intervalRef.current = setInterval(() => void load(), POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load, enabled]);

  const refresh = useCallback(() => void load(), [load]);

  const seed = useCallback(async (): Promise<SeedRepresentationsResult> => {
    const result = await seedRepresentations(propertyId, assemblyId);
    await load();
    return result;
  }, [propertyId, assemblyId, load]);

  const createProxy = useCallback(
    async (input: CreateProxyRepresentationInput): Promise<AssemblyRepresentationSummary> => {
      const data = await createRepresentation(propertyId, assemblyId, input);
      await load();
      return data.representation;
    },
    [propertyId, assemblyId, load],
  );

  const revoke = useCallback(
    async (representationId: string): Promise<void> => {
      await revokeRepresentation(propertyId, assemblyId, representationId);
      await load();
    },
    [propertyId, assemblyId, load],
  );

  const reactivate = useCallback(
    async (representationId: string): Promise<void> => {
      await reactivateRepresentation(propertyId, assemblyId, representationId);
      await load();
    },
    [propertyId, assemblyId, load],
  );

  return { representations, loading, error, seed, createProxy, revoke, reactivate, refresh };
}

// ─── Modo attendee ────────────────────────────────────────────────────────────

export type UseEligibilityState = {
  eligibility: VotingEligibilitySummary | null;
  loading: boolean;
  error: string | null;
  hasMultipleUnits: boolean;
};

/**
 * Devuelve la elegibilidad multi-unidad del asistente para una sesión dada.
 * Solo activo cuando sessionId está definido.
 */
export function useMyEligibility(
  propertyId:  string,
  assemblyId:  string,
  sessionId:   string | null,
  accessToken: string,
  enabled = true,
): UseEligibilityState {
  const [eligibility, setEligibility] = useState<VotingEligibilitySummary | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const intervalRef                   = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Evita parpadeo: solo el primer fetch muestra spinner; los re-pollings son silenciosos. */
  const initialLoadDoneRef            = useRef(false);

  useEffect(() => {
    initialLoadDoneRef.current = false;
  }, [propertyId, assemblyId, sessionId, accessToken, enabled]);

  const load = useCallback(async () => {
    if (!enabled || !sessionId || !accessToken) return;
    const first = !initialLoadDoneRef.current;
    if (first) setLoading(true);
    try {
      const data = await fetchMyEligibility(propertyId, assemblyId, sessionId, accessToken);
      setEligibility(data.eligibility);
      setError(null);
      initialLoadDoneRef.current = true;
    } catch {
      // Silenciar — si el token no tiene representaciones, usaremos el path legacy
      setEligibility(null);
      initialLoadDoneRef.current = true;
    } finally {
      setLoading(false);
    }
  }, [propertyId, assemblyId, sessionId, accessToken, enabled]);

  useEffect(() => {
    if (!enabled || !sessionId) return;
    void load();
    intervalRef.current = setInterval(() => void load(), POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load, enabled, sessionId]);

  return {
    eligibility,
    loading,
    error,
    hasMultipleUnits: (eligibility?.units.length ?? 0) > 1,
  };
}
