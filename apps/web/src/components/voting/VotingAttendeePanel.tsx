/**
 * Panel de votación para el asistente.
 *
 * Modos de operación:
 *
 * A) Multi-unidad (modo representación)
 *    Cuando el backend devuelve representaciones activas para el accessToken,
 *    muestra una tarjeta por unidad representada con su estado de voto
 *    individual y un flujo de confirmación por unidad.
 *    Soporta tanto propietarios directos como apoderados.
 *
 * B) Unidad única (modo legacy — retrocompatible)
 *    Cuando no hay representaciones formales, usa el flujo anterior basado en
 *    AssemblyAccessGrant (una unidad por token).
 */

import { useState, useEffect } from "react";
import type { VoteValue, RepresentedUnitVoteStatus } from "@kuoro/contracts";
import { useVotingSessionAttendee } from "../../hooks/useVotingSession";
import { useMyEligibility } from "../../hooks/useRepresentations";
import { castVote as apiCastVote } from "../../lib/api";

interface Props {
  propertyId:  string;
  assemblyId:  string;
  accessToken: string;
  sessionId?:  string;
}

const VOTE_OPTIONS: { value: VoteValue; label: string; cls: string }[] = [
  { value: "yes",     label: "Sí",         cls: "yes" },
  { value: "no",      label: "No",         cls: "no" },
  { value: "abstain", label: "Abstención",  cls: "abstain" },
  { value: "blank",   label: "En blanco",  cls: "blank" },
];

const INELIGIBLE_MESSAGES: Record<string, string> = {
  no_access_grant: "Tu unidad no tiene acceso registrado para esta asamblea.",
  no_can_vote:     "Tu unidad no tiene habilitado el derecho a voto.",
  session_closed:  "La sesión de votación ya está cerrada.",
  already_voted:   "Ya emitiste tu voto en esta sesión.",
};

const VOTE_LABELS: Record<VoteValue, string> = {
  yes:     "Sí",
  no:      "No",
  abstain: "Abstención",
  blank:   "En blanco",
};

const TYPE_BADGE: Record<string, string> = {
  owner:                   "Propietario",
  proxy:                   "Apoderado",
  authorized_representative: "Representante",
};

// ─── Tarjeta de unidad representada ──────────────────────────────────────────

function UnitVoteCard({
  unit,
  sessionId,
  propertyId,
  assemblyId,
  accessToken,
  disabled,
  onVoted,
}: {
  unit:        RepresentedUnitVoteStatus;
  sessionId:   string;
  propertyId:  string;
  assemblyId:  string;
  accessToken: string;
  disabled:    boolean;
  onVoted:     () => void;
}) {
  const [confirmVote, setConfirmVote] = useState<VoteValue | null>(null);
  const [castError,   setCastError]   = useState<string | null>(null);
  const [casting,     setCasting]     = useState(false);

  const handleCast = async (value: VoteValue) => {
    setCastError(null);
    setCasting(true);
    try {
      await apiCastVote(propertyId, assemblyId, sessionId, {
        accessToken,
        voteValue: value,
        unitId: unit.representedUnitId,
      });
      setConfirmVote(null);
      onVoted();
    } catch (err) {
      setCastError(err instanceof Error ? err.message : "Error al registrar voto");
    } finally {
      setCasting(false);
    }
  };

  return (
    <div className={`unit-vote-card ${unit.alreadyVoted ? "unit-vote-card--voted" : ""}`}>
      <div className="unit-vote-card__header">
        <div className="unit-vote-card__labels">
          <span className="unit-vote-card__unit-label">{unit.representedUnitLabel}</span>
          <span className={`unit-vote-card__type-badge unit-vote-card__type-badge--${unit.representationType}`}>
            {TYPE_BADGE[unit.representationType] ?? unit.representationType}
          </span>
          {unit.weight !== 1 && (
            <span className="unit-vote-card__weight">Peso: {unit.weight.toFixed(4)}</span>
          )}
        </div>

        {unit.alreadyVoted && unit.myVote && (
          <div className={`unit-vote-card__voted-badge unit-vote-card__voted-badge--${unit.myVote}`}>
            ✓ {VOTE_LABELS[unit.myVote]}
          </div>
        )}
      </div>

      {castError && <div className="unit-vote-card__error">{castError}</div>}

      {!unit.alreadyVoted && unit.canVote && (
        <>
          {confirmVote ? (
            <div className="unit-vote-card__confirm">
              <p>¿Confirmar: <strong>{VOTE_LABELS[confirmVote]}</strong>?</p>
              <div className="unit-vote-card__confirm-btns">
                <button
                  className={`voting-btn voting-btn--${confirmVote}`}
                  onClick={() => void handleCast(confirmVote)}
                  disabled={casting || disabled}
                >
                  {casting ? "Registrando…" : `Confirmar: ${VOTE_LABELS[confirmVote]}`}
                </button>
                <button
                  className="voting-btn voting-btn--ghost"
                  onClick={() => setConfirmVote(null)}
                  disabled={casting}
                >
                  Cambiar
                </button>
              </div>
            </div>
          ) : (
            <div className="unit-vote-card__options">
              {VOTE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`voting-btn voting-btn--${opt.cls} voting-btn--sm`}
                  onClick={() => setConfirmVote(opt.value)}
                  disabled={casting || disabled}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {!unit.canVote && !unit.alreadyVoted && (
        <p className="unit-vote-card__no-vote">Sin derecho a voto en esta sesión.</p>
      )}
    </div>
  );
}

// ─── Panel principal ──────────────────────────────────────────────────────────

export function VotingAttendeePanel({ propertyId, assemblyId, accessToken, sessionId }: Props) {
  // Flujo legacy (siempre activo como fallback)
  const { view, isLoading, isVoting, error, castVote } =
    useVotingSessionAttendee({ mode: "attendee", propertyId, assemblyId, accessToken, sessionId });

  // Flujo multi-unidad (activo si hay sesión abierta)
  const activeSessionId = view?.status === "open" ? (view?.id ?? sessionId ?? null) : null;
  const { eligibility, loading: eligLoading } = useMyEligibility(
    propertyId,
    assemblyId,
    activeSessionId,
    accessToken,
    !!activeSessionId,
  );

  const [castError,   setCastError]   = useState<string | null>(null);
  const [confirmVote, setConfirmVote] = useState<VoteValue | null>(null);
  const [refreshKey,  setRefreshKey]  = useState(0);

  // Al confirmarse el voto en el servidor, salir del paso "confirmar" (evita pantalla congelada).
  useEffect(() => {
    if (view?.myVote) {
      setConfirmVote(null);
      setCastError(null);
    }
  }, [view?.myVote]);

  // Determinar si usar modo multi-unidad
  const useMultiUnit = (eligibility?.units.length ?? 0) > 0;

  // ── Loading ──
  if (isLoading || eligLoading) {
    return (
      <div className="voting-attendee voting-attendee--loading">
        <div className="voting-attendee__spinner" />
        <span>Conectando a la sala de votación…</span>
      </div>
    );
  }

  // ── Sin sesión activa ──
  if (!view) {
    return (
      <div className="voting-attendee voting-attendee--idle">
        <div className="voting-attendee__idle-icon">🗳</div>
        <p className="voting-attendee__idle-text">No hay ninguna votación activa.</p>
        <p className="voting-attendee__idle-hint">El administrador iniciará la votación cuando corresponda.</p>
        {error && (
          <p className="voting-attendee__error voting-attendee__error--small">
            ⚠️ {error}
          </p>
        )}
      </div>
    );
  }

  // ── Handler legacy ──
  const handleLegacyVote = async (value: VoteValue) => {
    setCastError(null);
    setConfirmVote(null);
    try {
      await castVote(value);
    } catch (err) {
      setCastError(err instanceof Error ? err.message : "No se pudo registrar el voto");
    }
  };

  return (
    <div className="voting-attendee">
      {/* Cabecera de estado */}
      <div className="voting-attendee__header">
        {view.status === "open" && (
          <span className="voting-attendee__status voting-attendee__status--open">
            <span className="voting-attendee__pulse" /> Votación abierta
          </span>
        )}
        {view.status === "closed" && (
          <span className="voting-attendee__status voting-attendee__status--closed">
            Votación cerrada
          </span>
        )}
        {view.status === "cancelled" && (
          <span className="voting-attendee__status voting-attendee__status--cancelled">
            Votación cancelada
          </span>
        )}
      </div>

      {/* Pregunta */}
      <p className="voting-attendee__question">{view.question}</p>

      {error    && <div className="voting-attendee__error">{error}</div>}
      {castError && <div className="voting-attendee__error">{castError}</div>}

      {/* ── Sesión abierta ── */}
      {view.status === "open" && (
        <>
          {/* Modo multi-unidad (representaciones formales) */}
          {useMultiUnit ? (
            <div className="unit-vote-list">
              <p className="unit-vote-list__hint">
                Representas {eligibility!.units.length} unidad{eligibility!.units.length !== 1 ? "es" : ""}.
                Vota por cada una de forma independiente.
              </p>
              {eligibility!.units.map(unit => (
                <UnitVoteCard
                  key={`${unit.representationId}-${refreshKey}`}
                  unit={unit}
                  sessionId={view.id}
                  propertyId={propertyId}
                  assemblyId={assemblyId}
                  accessToken={accessToken}
                  disabled={isVoting}
                  onVoted={() => setRefreshKey(k => k + 1)}
                />
              ))}
            </div>
          ) : (
            /* Modo unidad única (legacy) */
            <>
              {view.myVote && (
                <div className={`voting-attendee__voted-badge voting-attendee__voted-badge--${view.myVote}`}>
                  <span className="voting-attendee__voted-icon">✓</span>
                  Tu voto: <strong>{VOTE_LABELS[view.myVote]}</strong>
                </div>
              )}

              {view.isEligible && !view.myVote && (
                <>
                  {confirmVote ? (
                    <div className="voting-attendee__confirm">
                      <p className="voting-attendee__confirm-text">
                        ¿Confirmar tu voto: <strong>{VOTE_LABELS[confirmVote]}</strong>?
                      </p>
                      <div className="voting-attendee__confirm-btns">
                        <button
                          className={`voting-btn voting-btn--${confirmVote} voting-btn--lg`}
                          onClick={() => void handleLegacyVote(confirmVote)}
                          disabled={isVoting}
                        >
                          {isVoting ? "Registrando…" : `Confirmar: ${VOTE_LABELS[confirmVote]}`}
                        </button>
                        <button
                          className="voting-btn voting-btn--ghost"
                          onClick={() => setConfirmVote(null)}
                          disabled={isVoting}
                        >
                          Cambiar opción
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="voting-attendee__options">
                      <p className="voting-attendee__options-hint">Selecciona tu opción:</p>
                      <div className="voting-attendee__buttons">
                        {VOTE_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            className={`voting-btn voting-btn--${opt.cls}`}
                            onClick={() => setConfirmVote(opt.value)}
                            disabled={isVoting}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {!view.isEligible && (
                <div className="voting-attendee__ineligible">
                  {INELIGIBLE_MESSAGES[view.ineligibleReason ?? ""] ??
                   "No tienes derecho a voto en esta sesión."}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Sesión cerrada: resultado ── */}
      {view.status === "closed" && (
        <div className="voting-attendee__result">
          {view.approved !== undefined && (
            <div className={`voting-attendee__result-badge ${view.approved ? "voting-attendee__result-badge--approved" : "voting-attendee__result-badge--rejected"}`}>
              {view.approved ? "Aprobado" : "No aprobado"}
            </div>
          )}
          {view.myVote && (
            <p className="voting-attendee__result-vote">
              Tu voto: <strong>{VOTE_LABELS[view.myVote]}</strong>
            </p>
          )}
          {view.counts && (
            <div className="voting-attendee__result-counts">
              <span>Sí: {view.counts.yesCount}</span>
              <span>No: {view.counts.noCount}</span>
              <span>Abstención: {view.counts.abstainCount}</span>
              <span>Blanco: {view.counts.blankCount}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
