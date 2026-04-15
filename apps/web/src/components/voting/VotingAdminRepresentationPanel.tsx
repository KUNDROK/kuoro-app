/**
 * Panel de gestión de representaciones para el administrador de la asamblea.
 *
 * Funcionalidades:
 *   - Botón "Generar representaciones" (seed automático desde UnitOwner + proxies aprobados).
 *   - Tabla de representaciones con tipo, estado, peso y token de acceso.
 *   - Acciones: revocar / reactivar.
 *   - Formulario modal para crear un apoderado manualmente.
 */

import { useState } from "react";
import type { AssemblyRepresentationSummary, CreateProxyRepresentationInput } from "@kuoro/contracts";
import { useRepresentationsAdmin } from "../../hooks/useRepresentations";

interface Props {
  propertyId: string;
  assemblyId: string;
}

const TYPE_LABELS: Record<string, string> = {
  owner:                   "Propietario",
  proxy:                   "Apoderado",
  authorized_representative: "Representante",
};

const STATUS_LABELS: Record<string, string> = {
  active:             "Activo",
  revoked:            "Revocado",
  pending_validation: "Pendiente",
};

// ─── Formulario de creación de apoderado ─────────────────────────────────────

interface ProxyFormProps {
  onSubmit:  (input: CreateProxyRepresentationInput) => Promise<void>;
  onCancel:  () => void;
  submitting: boolean;
  error:      string | null;
}

function ProxyForm({ onSubmit, onCancel, submitting, error }: ProxyFormProps) {
  const [form, setForm] = useState<CreateProxyRepresentationInput>({
    representedUnitId:      "",
    representativeFullName: "",
    representativeEmail:    "",
    proofDocumentRef:       "",
    notes:                  "",
    sharedAccessToken:      "",
  });

  const set = (k: keyof typeof form, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input: CreateProxyRepresentationInput = {
      representedUnitId:      form.representedUnitId.trim(),
      representativeFullName: form.representativeFullName.trim(),
      representativeEmail:    form.representativeEmail?.trim() || undefined,
      proofDocumentRef:       form.proofDocumentRef?.trim() || undefined,
      notes:                  form.notes?.trim() || undefined,
      sharedAccessToken:      form.sharedAccessToken?.trim() || undefined,
    };
    await onSubmit(input);
  };

  return (
    <form className="rep-proxy-form" onSubmit={(e) => void handleSubmit(e)}>
      <h4 className="rep-proxy-form__title">Nuevo apoderado</h4>

      {error && <div className="rep-proxy-form__error">{error}</div>}

      <label className="rep-proxy-form__label">
        ID de Unidad representada *
        <input
          className="rep-proxy-form__input"
          value={form.representedUnitId}
          onChange={e => set("representedUnitId", e.target.value)}
          placeholder="UUID de la unidad"
          required
        />
      </label>

      <label className="rep-proxy-form__label">
        Nombre completo del apoderado *
        <input
          className="rep-proxy-form__input"
          value={form.representativeFullName}
          onChange={e => set("representativeFullName", e.target.value)}
          placeholder="Ej. María García Pérez"
          required
        />
      </label>

      <label className="rep-proxy-form__label">
        Email del apoderado
        <input
          className="rep-proxy-form__input"
          type="email"
          value={form.representativeEmail ?? ""}
          onChange={e => set("representativeEmail", e.target.value)}
          placeholder="opcional"
        />
      </label>

      <label className="rep-proxy-form__label">
        Referencia del poder notarial
        <input
          className="rep-proxy-form__input"
          value={form.proofDocumentRef ?? ""}
          onChange={e => set("proofDocumentRef", e.target.value)}
          placeholder="Nombre/número del documento"
        />
      </label>

      <label className="rep-proxy-form__label">
        Token compartido (si ya creaste otra unidad para este apoderado)
        <input
          className="rep-proxy-form__input"
          value={form.sharedAccessToken ?? ""}
          onChange={e => set("sharedAccessToken", e.target.value)}
          placeholder="Pegar el accessToken existente"
        />
        <span className="rep-proxy-form__hint">
          Deja vacío para generar un nuevo token.
        </span>
      </label>

      <label className="rep-proxy-form__label">
        Notas
        <textarea
          className="rep-proxy-form__textarea"
          value={form.notes ?? ""}
          onChange={e => set("notes", e.target.value)}
          placeholder="Observaciones opcionales"
          rows={2}
        />
      </label>

      <div className="rep-proxy-form__actions">
        <button
          type="submit"
          className="rep-btn rep-btn--primary"
          disabled={submitting}
        >
          {submitting ? "Guardando…" : "Crear apoderado"}
        </button>
        <button
          type="button"
          className="rep-btn rep-btn--ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─── Fila de representación ───────────────────────────────────────────────────

function RepRow({
  rep,
  onRevoke,
  onReactivate,
  busy,
}: {
  rep:          AssemblyRepresentationSummary;
  onRevoke:     (id: string) => void;
  onReactivate: (id: string) => void;
  busy:         boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copyToken = async () => {
    await navigator.clipboard.writeText(rep.accessToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <tr className={`rep-row rep-row--${rep.status}`}>
      <td className="rep-row__unit" title={rep.representedUnitId}>
        {rep.representedUnitLabel}
      </td>
      <td>
        <span className={`rep-badge rep-badge--type-${rep.representationType}`}>
          {TYPE_LABELS[rep.representationType] ?? rep.representationType}
        </span>
      </td>
      <td className="rep-row__name" title={rep.representativeEmail}>
        {rep.representativeFullName}
      </td>
      <td>
        <span className={`rep-badge rep-badge--status-${rep.status}`}>
          {STATUS_LABELS[rep.status] ?? rep.status}
        </span>
      </td>
      <td className="rep-row__weight">{rep.weight.toFixed(4)}</td>
      <td>
        <button
          className="rep-btn rep-btn--token"
          onClick={() => void copyToken()}
          title="Copiar token de acceso"
        >
          {copied ? "¡Copiado!" : "Copiar token"}
        </button>
      </td>
      <td>
        {rep.status === "active" ? (
          <button
            className="rep-btn rep-btn--danger"
            onClick={() => onRevoke(rep.id)}
            disabled={busy}
          >
            Revocar
          </button>
        ) : (
          <button
            className="rep-btn rep-btn--success"
            onClick={() => onReactivate(rep.id)}
            disabled={busy}
          >
            Reactivar
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Panel principal ──────────────────────────────────────────────────────────

export function VotingAdminRepresentationPanel({ propertyId, assemblyId }: Props) {
  const {
    representations,
    loading,
    error,
    seed,
    createProxy,
    revoke,
    reactivate,
  } = useRepresentationsAdmin(propertyId, assemblyId);

  const [showForm,    setShowForm]    = useState(false);
  const [formError,   setFormError]   = useState<string | null>(null);
  const [formBusy,    setFormBusy]    = useState(false);
  const [seedResult,  setSeedResult]  = useState<string | null>(null);
  const [actionBusy,  setActionBusy]  = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleSeed = async () => {
    setActionBusy(true);
    setActionError(null);
    setSeedResult(null);
    try {
      const result = await seed();
      setSeedResult(
        `Generadas: ${result.created} | Omitidas: ${result.skipped}` +
        (result.errors.length ? ` | Errores: ${result.errors.length}` : ""),
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error al generar representaciones");
    } finally {
      setActionBusy(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setActionBusy(true);
    setActionError(null);
    try { await revoke(id); } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error al revocar");
    } finally { setActionBusy(false); }
  };

  const handleReactivate = async (id: string) => {
    setActionBusy(true);
    setActionError(null);
    try { await reactivate(id); } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error al reactivar");
    } finally { setActionBusy(false); }
  };

  const handleProxySubmit = async (input: CreateProxyRepresentationInput) => {
    setFormBusy(true);
    setFormError(null);
    try {
      await createProxy(input);
      setShowForm(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error al crear apoderado");
    } finally {
      setFormBusy(false);
    }
  };

  return (
    <div className="rep-panel">
      <div className="rep-panel__header">
        <h3 className="rep-panel__title">Representaciones de voto</h3>
        <div className="rep-panel__actions">
          <button
            className="rep-btn rep-btn--primary"
            onClick={() => void handleSeed()}
            disabled={actionBusy}
            title="Genera representaciones para propietarios directos y apoderados aprobados"
          >
            {actionBusy ? "Generando…" : "Generar representaciones"}
          </button>
          <button
            className="rep-btn rep-btn--secondary"
            onClick={() => { setShowForm(v => !v); setFormError(null); }}
            disabled={actionBusy}
          >
            {showForm ? "Cancelar" : "+ Agregar apoderado"}
          </button>
        </div>
      </div>

      {seedResult  && <div className="rep-panel__info">{seedResult}</div>}
      {error       && <div className="rep-panel__error">{error}</div>}
      {actionError && <div className="rep-panel__error">{actionError}</div>}

      {showForm && (
        <ProxyForm
          onSubmit={handleProxySubmit}
          onCancel={() => setShowForm(false)}
          submitting={formBusy}
          error={formError}
        />
      )}

      {loading ? (
        <div className="rep-panel__loading">Cargando representaciones…</div>
      ) : representations.length === 0 ? (
        <div className="rep-panel__empty">
          No hay representaciones registradas. Usa "Generar representaciones" o agrega apoderados manualmente.
        </div>
      ) : (
        <div className="rep-panel__table-wrapper">
          <table className="rep-table">
            <thead>
              <tr>
                <th>Unidad</th>
                <th>Tipo</th>
                <th>Representante</th>
                <th>Estado</th>
                <th>Peso</th>
                <th>Token</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {representations.map(rep => (
                <RepRow
                  key={rep.id}
                  rep={rep}
                  onRevoke={id => void handleRevoke(id)}
                  onReactivate={id => void handleReactivate(id)}
                  busy={actionBusy}
                />
              ))}
            </tbody>
          </table>

          <div className="rep-panel__summary">
            {representations.filter(r => r.status === "active").length} activas ·{" "}
            {representations.filter(r => r.status === "revoked").length} revocadas
          </div>
        </div>
      )}
    </div>
  );
}
