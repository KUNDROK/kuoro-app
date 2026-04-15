/**
 * Panel de votación en tiempo real para el administrador.
 *
 * Funcionalidad:
 * - Abrir una nueva sesión de votación
 * - Ver conteos en vivo con actualización por polling
 * - Cerrar o cancelar la sesión activa
 * - Ver el resultado final y si fue aprobado
 */

import { useState, useEffect, useRef } from "react";
import type { VotingRule, VotingBasis, VotingSessionSummary, VotingLiveCounts } from "@kuoro/contracts";
import { useVotingSessionAdmin } from "../../hooks/useVotingSession";
import { VotingAdminRepresentationPanel } from "./VotingAdminRepresentationPanel";

interface Props {
  propertyId:  string;
  assemblyId:  string;
  votingBasis: VotingBasis;
  /** Cuando el admin abre una sesión API — sincroniza pregunta en la presentación para asistentes. */
  onLiveSessionOpened?: (session: VotingSessionSummary) => void;
  /** Cuando se cierra la sesión con cómputo definitivo — para mostrar resultados en el canvas. */
  onLiveSessionClosed?: (session: VotingSessionSummary) => void;
  /** Si se cancela la sesión antes de cerrarla. */
  onLiveSessionCancelled?: () => void;
}

const RULE_LABELS: Record<VotingRule, string> = {
  simple:       "Mayoría simple",
  dos_tercios:  "Dos tercios (2/3)",
  unanimidad:   "Unanimidad",
};

export function VotingAdminPanel({
  propertyId,
  assemblyId,
  votingBasis,
  onLiveSessionOpened,
  onLiveSessionClosed,
  onLiveSessionCancelled,
}: Props) {
  const { session, isLoading, error, openSession, closeSession, cancelSession } =
    useVotingSessionAdmin({ mode: "admin", propertyId, assemblyId });

  const [question,    setQuestion]    = useState("");
  const [votingRule,  setVotingRule]  = useState<VotingRule>("simple");
  const [agendaItemId, setAgendaItemId] = useState("");
  const [isOpening,   setIsOpening]   = useState(false);
  const [isClosing,   setIsClosing]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formError,   setFormError]   = useState<string | null>(null);
  const lastSyncedOpenIdRef = useRef<string | null>(null);

  // Si ya había una sesión abierta (p. ej. admin recargó o reabrió el panel), sincronizar pregunta en la presentación.
  useEffect(() => {
    if (session?.status === "open") {
      if (session.id !== lastSyncedOpenIdRef.current) {
        lastSyncedOpenIdRef.current = session.id;
        onLiveSessionOpened?.(session);
      }
    } else {
      lastSyncedOpenIdRef.current = null;
    }
  }, [session, onLiveSessionOpened]);

  const handleOpen = async () => {
    if (!question.trim()) {
      setFormError("La pregunta es requerida.");
      return;
    }
    setFormError(null);
    setIsOpening(true);
    try {
      const opened = await openSession({
        question: question.trim(),
        votingRule,
        votingBasis,
        agendaItemId: agendaItemId.trim() || undefined,
      });
      onLiveSessionOpened?.(opened);
      setQuestion("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al abrir la sesión");
    } finally {
      setIsOpening(false);
    }
  };

  const handleClose = async () => {
    setIsClosing(true);
    try {
      const closed = await closeSession();
      if (closed?.status === "closed") {
        onLiveSessionClosed?.(closed);
      }
      setShowConfirm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al cerrar la sesión");
    } finally {
      setIsClosing(false);
    }
  };

  const handleCancel = async () => {
    setIsClosing(true);
    try {
      await cancelSession();
      onLiveSessionCancelled?.();
      setShowConfirm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al cancelar la sesión");
    } finally {
      setIsClosing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="voting-panel voting-panel--loading">
        <div className="voting-panel__spinner" />
        <span>Cargando estado de votación…</span>
      </div>
    );
  }

  return (
    <div className="voting-panel">
      {error && <div className="voting-panel__error">{error}</div>}
      {formError && <div className="voting-panel__error">{formError}</div>}

      {/* ── Sin sesión activa: formulario para abrir ── */}
      {!session && (
        <div className="voting-panel__open-form">
          <h3 className="voting-panel__title">Nueva votación</h3>

          <label className="voting-panel__label">
            Pregunta o proposición
            <textarea
              className="voting-panel__textarea"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Ej: ¿Se aprueba el presupuesto para el año 2026?"
              rows={3}
            />
          </label>

          <label className="voting-panel__label">
            Regla de aprobación
            <select
              className="voting-panel__select"
              value={votingRule}
              onChange={e => setVotingRule(e.target.value as VotingRule)}
            >
              {(Object.entries(RULE_LABELS) as [VotingRule, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </label>

          <div className="voting-panel__basis-badge">
            Base de cómputo: <strong>{votingBasis}</strong>
          </div>

          <button
            className="voting-panel__btn voting-panel__btn--primary"
            onClick={handleOpen}
            disabled={isOpening}
          >
            {isOpening ? "Abriendo…" : "Abrir votación"}
          </button>
        </div>
      )}

      {/* ── Sesión activa ── */}
      {session && session.status === "open" && (
        <div className="voting-panel__live">
          <div className="voting-panel__header">
            <span className="voting-panel__pulse" />
            <h3 className="voting-panel__title">Votación en curso</h3>
          </div>

          <p className="voting-panel__question">{session.question}</p>

          <div className="voting-panel__rule-badge">
            {RULE_LABELS[session.votingRule]} · Base: {session.votingBasis}
          </div>

          <VotingProgress counts={session.counts} />

          <VotingBars counts={session.counts} rule={session.votingRule} votingBasis={session.votingBasis} />

          <div className="voting-panel__actions">
            <button
              className="voting-panel__btn voting-panel__btn--danger"
              onClick={() => setShowConfirm(true)}
              disabled={isClosing}
            >
              Cerrar votación
            </button>
          </div>

          {showConfirm && (
            <ConfirmDialog
              voteCount={session.counts.totalVoted}
              eligible={session.counts.totalEligible}
              onClose={handleClose}
              onCancel={handleCancel}
              onDismiss={() => setShowConfirm(false)}
              isLoading={isClosing}
            />
          )}
        </div>
      )}

      {/* ── Sesión cerrada: mostrar resultado ── */}
      {session && session.status === "closed" && (
        <VotingResult session={session} onNewVoting={() => {
          setQuestion("");
          setFormError(null);
        }} />
      )}

      {/* ── Panel de representaciones (siempre visible para el admin) ── */}
      <div className="voting-panel__section voting-panel__section--representations">
        <VotingAdminRepresentationPanel
          propertyId={propertyId}
          assemblyId={assemblyId}
        />
      </div>
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function VotingProgress({ counts }: { counts: VotingAdminPanel.Counts }) {
  const pct = counts.totalEligible > 0
    ? Math.round((counts.totalVoted / counts.totalEligible) * 100)
    : 0;

  return (
    <div className="voting-progress">
      <div className="voting-progress__label">
        <span className="voting-progress__voted">{counts.totalVoted}</span>
        <span className="voting-progress__sep"> de </span>
        <span className="voting-progress__eligible">{counts.totalEligible} unidades elegibles</span>
        <span className="voting-progress__pct">{pct}%</span>
      </div>
      <div className="voting-progress__bar">
        <div className="voting-progress__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function VotingBars({
  counts,
  rule,
  votingBasis,
}: {
  counts: VotingAdminPanel.Counts;
  rule: VotingRule;
  votingBasis: VotingBasis;
}) {
  const total = counts.totalWeight || 1;
  const showWeights = votingBasis !== "unidad";

  const bars: { label: string; count: number; weight: number; cls: string }[] = [
    { label: "Sí",         count: counts.yesCount,     weight: counts.yesWeight,     cls: "yes" },
    { label: "No",         count: counts.noCount,       weight: counts.noWeight,      cls: "no" },
    { label: "Abstención", count: counts.abstainCount,  weight: counts.abstainWeight, cls: "abstain" },
    { label: "En blanco",  count: counts.blankCount,    weight: 0,                    cls: "blank" },
  ];

  return (
    <div className="voting-bars">
      {bars.map(b => (
        <div key={b.cls} className={`voting-bar voting-bar--${b.cls}`}>
          <div className="voting-bar__meta">
            <span className="voting-bar__label">{b.label}</span>
            <span className="voting-bar__count">{b.count}</span>
          </div>
          <div className="voting-bar__track">
            <div
              className="voting-bar__fill"
              style={{ width: b.weight > 0 ? `${(b.weight / total) * 100}%` : "0%" }}
            />
          </div>
          {showWeights && b.weight > 0 && (
            <span className="voting-bar__weight">{b.weight.toFixed(4)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function VotingResult({
  session,
  onNewVoting,
}: {
  session: VotingSessionSummary;
  onNewVoting: () => void;
}) {
  const approved = session.approved;

  return (
    <div className="voting-result">
      <div className={`voting-result__badge ${approved ? "voting-result__badge--approved" : "voting-result__badge--rejected"}`}>
        {approved ? "Aprobado" : "No aprobado"}
      </div>
      <p className="voting-result__question">{session.question}</p>
      <div className="voting-result__counts">
        <span>Sí: {session.counts.yesCount}</span>
        <span>No: {session.counts.noCount}</span>
        <span>Abstención: {session.counts.abstainCount}</span>
        <span>Blanco: {session.counts.blankCount}</span>
      </div>
      <p className="voting-result__rule">
        Regla: {RULE_LABELS[session.votingRule]} · {session.counts.totalVoted} votos de {session.counts.totalEligible}
      </p>
      <button
        className="voting-panel__btn voting-panel__btn--secondary"
        onClick={onNewVoting}
      >
        Nueva votación
      </button>
    </div>
  );
}

function ConfirmDialog({
  voteCount,
  eligible,
  onClose,
  onCancel,
  onDismiss,
  isLoading,
}: {
  voteCount: number;
  eligible:  number;
  onClose:   () => void;
  onCancel:  () => void;
  onDismiss: () => void;
  isLoading: boolean;
}) {
  const pending = eligible - voteCount;

  return (
    <div className="voting-confirm-overlay">
      <div className="voting-confirm">
        <h4 className="voting-confirm__title">¿Cerrar votación?</h4>
        <p className="voting-confirm__body">
          Han votado <strong>{voteCount}</strong> de <strong>{eligible}</strong> unidades
          elegibles.
          {pending > 0 && ` Quedan ${pending} sin votar.`}
        </p>
        <div className="voting-confirm__actions">
          <button
            className="voting-panel__btn voting-panel__btn--primary"
            onClick={onClose}
            disabled={isLoading}
          >
            {isLoading ? "Cerrando…" : "Cerrar y calcular resultado"}
          </button>
          <button
            className="voting-panel__btn voting-panel__btn--ghost"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancelar sesión (sin resultado)
          </button>
          <button
            className="voting-panel__btn voting-panel__btn--ghost"
            onClick={onDismiss}
            disabled={isLoading}
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}

// Tipo auxiliar para evitar repetición
namespace VotingAdminPanel {
  export type Counts = VotingLiveCounts;
}
