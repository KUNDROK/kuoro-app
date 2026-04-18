import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Trash2,
  UserPlus
} from "lucide-react";
import type { AuthResponse, DocumentType, PropertySummary, UnitCreateInput } from "@kuoro/contracts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PlatformShell } from "../components/PlatformShell";
import { deleteUnit, fetchMe, fetchUnit, getStoredToken, updateUnit } from "../lib/api";
import { LoadingModal } from "../components/ui/loading";
import { documentTypeOptions, validateUnitForm } from "../lib/ownerValidation";
import { formatUnitLabel } from "../lib/unitLabels";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createEmptyOwner() {
  return {
    fullName: "",
    documentType: undefined as DocumentType | undefined,
    email: "",
    phone: "",
    document: "",
    participationRole: "copropietario" as const,
    canVote: false,
    receivesInvitations: false,
    proxyDocumentName: undefined as string | undefined,
    proxyDocumentMimeType: undefined as string | undefined,
    proxyDocumentData: undefined as string | undefined,
    proxyApprovalStatus: "not_required" as const,
    proxyRequestToken: undefined as string | undefined,
    proxyRequestedAt: undefined as string | undefined,
    proxyLastSubmittedAt: undefined as string | undefined,
    proxySubmittedByName: undefined as string | undefined,
    proxySubmittedByEmail: undefined as string | undefined,
    proxySubmittedByRole: undefined as "propietario" | "copropietario" | "apoderado" | "otro" | undefined,
    proxyRejectionReasons: [] as string[],
    proxyRejectionNote: undefined as string | undefined,
    isPrimary: false,
    ownershipPercentage: undefined as number | undefined
  };
}

function toEditableUnitForm(unit: Awaited<ReturnType<typeof fetchUnit>>["unit"]): UnitCreateInput {
  return {
    unitType: unit.unitType,
    groupingKind: unit.groupingKind,
    groupingLabel: unit.groupingLabel,
    unitNumber: unit.unitNumber,
    floor: unit.floor ?? "",
    destination: unit.destination,
    privateArea: unit.privateArea,
    coefficient: unit.coefficient,
    contributionModule: unit.contributionModule,
    owners: unit.owners.length
      ? unit.owners.map((o) => ({
          id: o.id,
          fullName: o.fullName,
          documentType: o.documentType,
          email: o.email ?? "",
          phone: o.phone ?? "",
          document: o.document ?? "",
          participationRole: o.participationRole ?? "propietario",
          canVote: o.canVote ?? true,
          receivesInvitations: o.receivesInvitations ?? true,
          proxyDocumentName: o.proxyDocumentName,
          proxyDocumentMimeType: o.proxyDocumentMimeType,
          proxyDocumentData: o.proxyDocumentData,
          proxyApprovalStatus: o.proxyApprovalStatus ?? "not_required",
          proxyRequestToken: o.proxyRequestToken,
          proxyRequestedAt: o.proxyRequestedAt,
          proxyLastSubmittedAt: o.proxyLastSubmittedAt,
          proxySubmittedByName: o.proxySubmittedByName,
          proxySubmittedByEmail: o.proxySubmittedByEmail,
          proxySubmittedByRole: o.proxySubmittedByRole,
          proxyRejectionReasons: o.proxyRejectionReasons ?? [],
          proxyRejectionNote: o.proxyRejectionNote,
          isPrimary: o.isPrimary,
          ownershipPercentage: o.ownershipPercentage
        }))
      : [{ ...createEmptyOwner(), participationRole: "propietario", canVote: true, receivesInvitations: true, isPrimary: true, ownershipPercentage: 100 }]
  };
}

function getOwnerColors(tone: string): { bg: string; color: string } {
  if (tone === "status-live") return { bg: "var(--success-surface)", color: "var(--success)" };
  if (tone === "status-danger") return { bg: "var(--danger-surface)", color: "var(--danger)" };
  return { bg: "var(--warning-surface)", color: "var(--warning)" };
}

function getOwnerStatus(owner: UnitCreateInput["owners"][number]) {
  if (owner.participationRole === "apoderado") {
    if (owner.proxyApprovalStatus === "approved") return { label: "poder aprobado", tone: "status-live" };
    if (owner.proxyApprovalStatus === "rejected") return { label: "poder rechazado", tone: "status-danger" };
    if (owner.proxyApprovalStatus === "pending_review") return { label: "en revisión", tone: "status-warn" };
    return { label: "pendiente de cargue", tone: "status-warn" };
  }
  if (owner.isPrimary) return { label: "titular principal", tone: "status-live" };
  return { label: owner.participationRole ?? "sin rol", tone: "status-warn" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 7,
  border: "0.5px solid var(--border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
  fontSize: 13,
  outline: "none",
  height: 36
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
      {children}
    </label>
  );
}

function ToggleCheckbox({
  label,
  checked,
  disabled,
  onChange
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 7,
        border: `0.5px solid ${checked ? "var(--primary)" : "var(--border)"}`,
        backgroundColor: checked ? "var(--accent)" : "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        style={{ accentColor: "var(--primary)", width: 13, height: 13 }}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span style={{ fontSize: 12, color: checked ? "var(--accent-foreground)" : "var(--foreground)" }}>
        {label}
      </span>
    </label>
  );
}

// ─── Owner card ───────────────────────────────────────────────────────────────

function OwnerCard({
  owner,
  ownerIndex,
  totalOwners,
  onUpdate,
  onMarkAsPrimary,
  onRemove,
  onCopyLink,
  onOpenProxy
}: {
  owner: UnitCreateInput["owners"][number];
  ownerIndex: number;
  totalOwners: number;
  onUpdate: (field: keyof UnitCreateInput["owners"][number], value: string | boolean | number | DocumentType | undefined) => void;
  onMarkAsPrimary: () => void;
  onRemove: () => void;
  onCopyLink: () => void;
  onOpenProxy: () => void;
}) {
  const [expanded, setExpanded] = useState(ownerIndex === 0);
  const status = getOwnerStatus(owner);
  const statusColors = getOwnerColors(status.tone);
  const proxyLink =
    owner.proxyRequestToken && typeof window !== "undefined"
      ? `${window.location.origin}/poder/${owner.proxyRequestToken}`
      : "";
  const canShareProxyLink = Boolean(owner.id && owner.proxyRequestToken);
  const canOpenApprovedProxy =
    owner.participationRole === "apoderado" &&
    owner.proxyApprovalStatus === "approved" &&
    Boolean(owner.proxyDocumentData);
  const title = owner.fullName.trim() || (owner.isPrimary ? "Titular principal" : `Persona ${ownerIndex + 1}`);

  return (
    <div
      className="card-base"
      style={{ overflow: "hidden" }}
    >
      {/* Summary row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 16px",
          width: "100%",
          border: "none",
          backgroundColor: "transparent",
          cursor: "pointer",
          textAlign: "left"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: owner.isPrimary ? "var(--accent)" : "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 600,
              color: owner.isPrimary ? "var(--accent-foreground)" : "var(--text-secondary)",
              flexShrink: 0
            }}
          >
            {title.slice(0, 1).toUpperCase() || "?"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{title}</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
              {[
                owner.participationRole ?? "sin rol",
                owner.canVote ? "con voto" : "sin voto",
                owner.receivesInvitations ? "recibe convocatoria" : "sin convocatoria"
              ].join(" · ")}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {owner.isPrimary && (
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 20,
                fontSize: 10,
                fontWeight: 600,
                backgroundColor: "var(--muted)",
                color: "var(--text-secondary)",
                letterSpacing: "0.03em"
              }}
            >
              TITULAR
            </span>
          )}
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 500,
              backgroundColor: statusColors.bg,
              color: statusColors.color
            }}
          >
            {status.label}
          </span>
          {expanded ? (
            <ChevronUp size={14} style={{ color: "var(--text-tertiary)" }} />
          ) : (
            <ChevronDown size={14} style={{ color: "var(--text-tertiary)" }} />
          )}
        </div>
      </button>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                padding: "0 16px 16px",
                borderTop: "0.5px solid var(--border)",
                paddingTop: 16,
                display: "flex",
                flexDirection: "column",
                gap: 16
              }}
            >
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
                  {owner.isPrimary ? "Titular principal" : `Persona ${ownerIndex + 1}`}
                </span>
                {totalOwners > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onRemove}
                    style={{ fontSize: 11, borderRadius: 7, color: "var(--danger)", gap: 4 }}
                  >
                    <Trash2 size={12} />
                    Quitar
                  </Button>
                )}
              </div>

              {/* Form grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
                  <FieldLabel>Nombre completo</FieldLabel>
                  <Input
                    value={owner.fullName}
                    style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                    onChange={(e) => onUpdate("fullName", e.target.value)}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <FieldLabel>Relación con la unidad</FieldLabel>
                  <select
                    value={owner.participationRole ?? "propietario"}
                    style={selectStyle}
                    onChange={(e) =>
                      onUpdate("participationRole", e.target.value as UnitCreateInput["owners"][number]["participationRole"])
                    }
                  >
                    <option value="propietario">Propietario</option>
                    <option value="copropietario">Copropietario</option>
                    <option value="apoderado">Apoderado</option>
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <FieldLabel>Tipo de documento</FieldLabel>
                  <select
                    value={owner.documentType ?? ""}
                    style={selectStyle}
                    onChange={(e) =>
                      onUpdate("documentType", (e.target.value as DocumentType) || undefined)
                    }
                  >
                    <option value="">Selecciona una opción</option>
                    {documentTypeOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <FieldLabel>Número de documento</FieldLabel>
                  <Input
                    value={owner.document ?? ""}
                    style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                    onChange={(e) => onUpdate("document", e.target.value)}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <FieldLabel>Correo electrónico</FieldLabel>
                  <Input
                    type="email"
                    value={owner.email ?? ""}
                    style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                    onChange={(e) => onUpdate("email", e.target.value)}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <FieldLabel>Teléfono</FieldLabel>
                  <Input
                    value={owner.phone ?? ""}
                    style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                    onChange={(e) => onUpdate("phone", e.target.value)}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <FieldLabel>Participación (%)</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={owner.ownershipPercentage ?? ""}
                    style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                    onChange={(e) =>
                      onUpdate("ownershipPercentage", e.target.value ? Number(e.target.value) : undefined)
                    }
                  />
                </div>
              </div>

              {/* Toggles */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: 7,
                    border: `0.5px solid ${owner.isPrimary ? "var(--primary)" : "var(--border)"}`,
                    backgroundColor: owner.isPrimary ? "var(--accent)" : "transparent",
                    cursor: "pointer"
                  }}
                >
                  <input
                    type="radio"
                    name="primary-owner"
                    checked={owner.isPrimary ?? false}
                    style={{ accentColor: "var(--primary)", width: 13, height: 13 }}
                    onChange={onMarkAsPrimary}
                  />
                  <span style={{ fontSize: 12, color: owner.isPrimary ? "var(--accent-foreground)" : "var(--foreground)" }}>
                    Titular principal
                  </span>
                </label>

                <ToggleCheckbox
                  label="Puede votar"
                  checked={owner.canVote ?? true}
                  disabled={owner.participationRole === "apoderado" && owner.proxyApprovalStatus !== "approved"}
                  onChange={(v) => onUpdate("canVote", v)}
                />
                <ToggleCheckbox
                  label="Recibe convocatoria"
                  checked={owner.receivesInvitations ?? true}
                  disabled={owner.participationRole === "apoderado" && owner.proxyApprovalStatus !== "approved"}
                  onChange={(v) => onUpdate("receivesInvitations", v)}
                />
              </div>

              {/* Proxy section */}
              {owner.participationRole === "apoderado" && (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    backgroundColor: "var(--muted)",
                    border: "0.5px solid var(--border)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", marginBottom: 4 }}>
                        Gestión del poder
                      </div>
                      <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                        Guarda primero la unidad y luego comparte el enlace para que puedan adjuntar el poder.
                      </p>
                    </div>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 500,
                        backgroundColor: statusColors.bg,
                        color: statusColors.color,
                        flexShrink: 0
                      }}
                    >
                      {status.label}
                    </span>
                  </div>

                  {!canOpenApprovedProxy && (
                    <div style={{ marginBottom: 10 }}>
                      <FieldLabel>Enlace para cargar poder</FieldLabel>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          padding: "8px 10px",
                          borderRadius: 7,
                          border: "0.5px solid var(--border)",
                          backgroundColor: "var(--background)"
                        }}
                      >
                        <span style={{ flex: 1, fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {canShareProxyLink ? proxyLink : "Guarda la unidad para activar este enlace"}
                        </span>
                      </div>
                      <p style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4, lineHeight: 1.4 }}>
                        {canShareProxyLink
                          ? "Comparte este enlace con el propietario o apoderado para que envíe el poder."
                          : "Primero guarda la unidad. Después verás aquí el enlace válido."}
                      </p>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8 }}>
                    {canOpenApprovedProxy ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={onOpenProxy}
                        style={{ fontSize: 11, borderRadius: 7, gap: 4 }}
                      >
                        <FileText size={12} />
                        Ver poder aprobado
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={!canShareProxyLink}
                        onClick={onCopyLink}
                        style={{ fontSize: 11, borderRadius: 7, gap: 4 }}
                      >
                        <Copy size={12} />
                        Copiar enlace
                      </Button>
                    )}
                  </div>

                  {(owner.proxyDocumentName || owner.proxyRejectionReasons?.length) && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "0.5px solid var(--border)" }}>
                      {owner.proxyDocumentName && (
                        <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "0 0 4px" }}>
                          Último archivo: <strong>{owner.proxyDocumentName}</strong>
                          {owner.proxySubmittedByName ? ` · enviado por ${owner.proxySubmittedByName}` : ""}
                        </p>
                      )}
                      {owner.proxyRejectionReasons?.length ? (
                        <p style={{ fontSize: 11, color: "var(--danger)", margin: 0 }}>
                          Rechazado por: {owner.proxyRejectionReasons.join(", ")}
                          {owner.proxyRejectionNote ? ` · ${owner.proxyRejectionNote}` : ""}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function UnitDetailPage() {
  const navigate = useNavigate();
  const { unitId } = useParams();
  const [searchParams] = useSearchParams();
  const propertyId = searchParams.get("propertyId");

  const [admin, setAdmin] = useState<AuthResponse["admin"] | null>(null);
  const [property, setProperty] = useState<PropertySummary | null>(null);
  const [form, setForm] = useState<UnitCreateInput | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!propertyId || !unitId) return;

    Promise.all([
      fetchMe(),
      fetchUnit(propertyId, unitId)
    ])
      .then(([meData, unitData]) => {
        setAdmin(meData.admin);
        setProperty(meData.properties.find((p) => p.id === propertyId) ?? meData.properties[0] ?? null);
        setForm(toEditableUnitForm(unitData.unit));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No fue posible cargar la ficha de la unidad"))
      .finally(() => setIsLoading(false));
  }, [propertyId, unitId]);

  if (!getStoredToken()) return <Navigate to="/login-admin" replace />;

  function updateOwnerField(
    ownerIndex: number,
    field: keyof UnitCreateInput["owners"][number],
    value: string | boolean | number | DocumentType | undefined
  ) {
    setForm((cur) =>
      cur
        ? {
            ...cur,
            owners: cur.owners.map((owner, i) =>
              i === ownerIndex ? { ...owner, ...applyOwnerRules({ ...owner, [field]: value }) } : owner
            )
          }
        : cur
    );
  }

  function applyOwnerRules(owner: UnitCreateInput["owners"][number]) {
    if (owner.participationRole !== "apoderado") {
      return {
        ...owner,
        proxyDocumentName: undefined,
        proxyDocumentMimeType: undefined,
        proxyDocumentData: undefined,
        proxyApprovalStatus: "not_required" as const,
        proxyRequestToken: undefined,
        proxyRequestedAt: undefined,
        proxyLastSubmittedAt: undefined,
        proxySubmittedByName: undefined,
        proxySubmittedByEmail: undefined,
        proxySubmittedByRole: undefined,
        proxyRejectionReasons: [],
        proxyRejectionNote: undefined
      };
    }
    const approvalStatus =
      !owner.proxyApprovalStatus || owner.proxyApprovalStatus === "not_required"
        ? owner.proxyDocumentData
          ? "pending_review"
          : "awaiting_upload"
        : owner.proxyApprovalStatus;
    return {
      ...owner,
      proxyRequestToken: owner.proxyRequestToken ?? crypto.randomUUID(),
      proxyRequestedAt: owner.proxyRequestedAt ?? new Date().toISOString(),
      proxyApprovalStatus: approvalStatus,
      canVote: approvalStatus === "approved" ? (owner.canVote ?? true) : false,
      receivesInvitations: approvalStatus === "approved" ? (owner.receivesInvitations ?? true) : false
    };
  }

  function markAsPrimary(ownerIndex: number) {
    setForm((cur) =>
      cur
        ? {
            ...cur,
            owners: cur.owners.map((owner, i) => ({
              ...owner,
              isPrimary: i === ownerIndex,
              participationRole: i === ownerIndex ? "propietario" : owner.participationRole
            }))
          }
        : cur
    );
  }

  function addOwner() {
    setForm((cur) => (cur ? { ...cur, owners: [...cur.owners, createEmptyOwner()] } : cur));
  }

  function removeOwner(ownerIndex: number) {
    setForm((cur) => {
      if (!cur) return cur;
      const next = cur.owners.filter((_, i) => i !== ownerIndex);
      if (!next.length) {
        return {
          ...cur,
          owners: [{ ...createEmptyOwner(), participationRole: "propietario", canVote: true, receivesInvitations: true, isPrimary: true, ownershipPercentage: 100 }]
        };
      }
      if (!next.some((o) => o.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true, participationRole: "propietario" };
      }
      return { ...cur, owners: next };
    });
  }

  function getProxyLink(owner: UnitCreateInput["owners"][number]) {
    if (!owner.proxyRequestToken || typeof window === "undefined") return "";
    return `${window.location.origin}/poder/${owner.proxyRequestToken}`;
  }

  function openProxyDocument(owner: UnitCreateInput["owners"][number]) {
    if (!owner.proxyDocumentData) {
      setError("Este apoderado todavía no tiene un poder adjunto");
      return;
    }
    try {
      const [header, content] = owner.proxyDocumentData.split(",", 2);
      const mimeType =
        owner.proxyDocumentMimeType ||
        header.match(/^data:(.*?)(;base64)?$/)?.[1] ||
        "application/octet-stream";
      const binary = window.atob(content ?? "");
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const objectUrl = window.URL.createObjectURL(new Blob([bytes], { type: mimeType }));
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000);
      setError("");
    } catch {
      setError("No fue posible abrir el poder aprobado");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!propertyId || !unitId || !form) return;
    const validationError = validateUnitForm(form);
    if (validationError) { setError(validationError); return; }

    setError("");
    setSuccessMessage("");
    setIsSubmitting(true);
    try {
      const response = await updateUnit(propertyId, unitId, form);
      setForm(toEditableUnitForm(response.unit));
      setSuccessMessage("Ficha actualizada correctamente");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible actualizar la unidad");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!propertyId || !unitId) return;
    setError("");
    setIsSubmitting(true);
    try {
      await deleteUnit(propertyId, unitId);
      navigate(`/unidades?propertyId=${propertyId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible eliminar la unidad");
      setIsSubmitting(false);
    }
  }

  const totalOwners = form?.owners.length ?? 0;
  const eligibleVoters = form?.owners.filter((o) => o.canVote).length ?? 0;
  const invitationRecipients = form?.owners.filter((o) => o.receivesInvitations).length ?? 0;
  const pendingProxyOwners =
    form?.owners.filter((o) => o.participationRole === "apoderado" && o.proxyApprovalStatus !== "approved").length ?? 0;

  const unitLabel = form
    ? formatUnitLabel({
        groupingKind: form.groupingKind,
        groupingLabel: form.groupingLabel,
        unitType: form.unitType,
        unitNumber: form.unitNumber
      })
    : "Ficha de unidad";

  const kpiCards = [
    { label: "Personas", value: totalOwners, sub: "Registradas en la unidad" },
    { label: "Votantes", value: eligibleVoters, sub: "Habilitados para votar" },
    { label: "Convocatoria", value: invitationRecipients, sub: "Reciben la invitación" },
    { label: "Poderes pend.", value: pendingProxyOwners, sub: "Sin aprobar", warn: pendingProxyOwners > 0 }
  ];

  return (
    <PlatformShell
      activeSection="units"
      admin={admin}
      assistantScope={property ? { propertyId: property.id } : undefined}
      property={property}
      title={unitLabel}
    >
      <LoadingModal visible={isSubmitting} message="Guardando cambios..." />
      {isLoading ? (
        <LoadingModal variant="section" visible message="Cargando ficha de unidad..." minHeight={320} />
      ) : form ? (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Header card */}
          <motion.div
            className="card-base"
            style={{ padding: 24 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div>
                <span className="text-label" style={{ display: "block", marginBottom: 6 }}>
                  Ficha de la unidad
                </span>
                <h1
                  style={{
                    fontSize: 22,
                    fontWeight: 500,
                    letterSpacing: "-0.02em",
                    color: "var(--foreground)",
                    margin: "0 0 8px"
                  }}
                >
                  {unitLabel}
                </h1>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                  {[form.unitType, form.destination, form.floor ? `Piso ${form.floor}` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                {propertyId && (
                  <Link
                    to={`/unidades?propertyId=${propertyId}`}
                    style={{
                      padding: "7px 12px",
                      backgroundColor: "var(--secondary)",
                      color: "var(--secondary-foreground)",
                      borderRadius: 7,
                      fontSize: 12,
                      fontWeight: 500,
                      textDecoration: "none"
                    }}
                  >
                    ← Ver unidades
                  </Link>
                )}
              </div>
            </div>
          </motion.div>

          {/* KPI strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {kpiCards.map((kpi, i) => (
              <motion.div
                key={kpi.label}
                className="card-base"
                style={{ padding: "14px 16px", display: "flex", flexDirection: "column" }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
              >
                <span className="text-label" style={{ marginBottom: 8 }}>{kpi.label}</span>
                <span
                  className="text-metric"
                  style={{ color: kpi.warn ? "var(--warning)" : "var(--foreground)" }}
                >
                  {kpi.value}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{kpi.sub}</span>
              </motion.div>
            ))}
          </div>

          {/* Unit data */}
          <div className="card-base" style={{ padding: 24 }}>
            <h2 className="text-subtitle" style={{ marginBottom: 4 }}>Datos base de la unidad</h2>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 20 }}>
              Ajusta nomenclatura, destino y datos técnicos antes de revisar la representación.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <FieldLabel>Agrupación (torre, bloque...)</FieldLabel>
                <Input
                  value={form.groupingLabel}
                  style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                  onChange={(e) => setForm((c) => (c ? { ...c, groupingLabel: e.target.value } : c))}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <FieldLabel>Número de unidad</FieldLabel>
                <Input
                  value={form.unitNumber}
                  style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                  onChange={(e) => setForm((c) => (c ? { ...c, unitNumber: e.target.value } : c))}
                />
              </div>

              {form.unitType !== "casa" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <FieldLabel>Piso o nivel</FieldLabel>
                  <Input
                    value={form.floor ?? ""}
                    style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                    onChange={(e) => setForm((c) => (c ? { ...c, floor: e.target.value } : c))}
                  />
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <FieldLabel>Destino</FieldLabel>
                <Input
                  value={form.destination}
                  style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                  onChange={(e) => setForm((c) => (c ? { ...c, destination: e.target.value } : c))}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <FieldLabel>Área privada (m²)</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.privateArea ?? ""}
                  style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                  onChange={(e) =>
                    setForm((c) => (c ? { ...c, privateArea: e.target.value ? Number(e.target.value) : undefined } : c))
                  }
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <FieldLabel>Coeficiente</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  step="0.0001"
                  value={form.coefficient ?? ""}
                  style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                  onChange={(e) =>
                    setForm((c) => (c ? { ...c, coefficient: e.target.value ? Number(e.target.value) : undefined } : c))
                  }
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <FieldLabel>Módulo de contribución</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  step="0.0001"
                  value={form.contributionModule ?? ""}
                  style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                  onChange={(e) =>
                    setForm((c) => (c ? { ...c, contributionModule: e.target.value ? Number(e.target.value) : undefined } : c))
                  }
                />
              </div>
            </div>
          </div>

          {/* Owners section */}
          <div className="card-base" style={{ padding: 24 }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 20
              }}
            >
              <div>
                <h2 className="text-subtitle" style={{ marginBottom: 4 }}>Propietarios y apoderados</h2>
                <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  Gestiona titular principal, copropietarios, apoderados y derechos de voto o convocatoria.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addOwner}
                style={{ fontSize: 12, borderRadius: 7, gap: 6, flexShrink: 0 }}
              >
                <UserPlus size={13} />
                Agregar persona
              </Button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {form.owners.map((owner, ownerIndex) => (
                <OwnerCard
                  key={owner.id ?? `owner-${ownerIndex}`}
                  owner={owner}
                  ownerIndex={ownerIndex}
                  totalOwners={form.owners.length}
                  onUpdate={(field, value) => updateOwnerField(ownerIndex, field, value)}
                  onMarkAsPrimary={() => markAsPrimary(ownerIndex)}
                  onRemove={() => removeOwner(ownerIndex)}
                  onCopyLink={() => {
                    void navigator.clipboard.writeText(getProxyLink(owner));
                    setSuccessMessage("Enlace del poder copiado al portapapeles");
                  }}
                  onOpenProxy={() => openProxyDocument(owner)}
                />
              ))}
            </div>
          </div>

          {/* Feedback */}
          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: "10px 14px",
                backgroundColor: "var(--danger-surface)",
                borderRadius: 7,
                border: "0.5px solid var(--danger)"
              }}
            >
              <AlertCircle size={13} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: "var(--danger)" }}>{error}</span>
            </div>
          )}
          {successMessage && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                backgroundColor: "var(--success-surface)",
                borderRadius: 7,
                border: "0.5px solid var(--success)"
              }}
            >
              <CheckCircle size={13} style={{ color: "var(--success)" }} />
              <span style={{ fontSize: 12, color: "var(--success)" }}>{successMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderRadius: 10,
              border: "0.5px solid var(--border)",
              backgroundColor: "var(--card)"
            }}
          >
            {!showDeleteConfirm ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{ fontSize: 12, borderRadius: 7, color: "var(--danger)", gap: 6 }}
                >
                  <Trash2 size={13} />
                  Eliminar unidad
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    backgroundColor: "var(--primary)",
                    color: "#FFFFFF",
                    borderRadius: 7,
                    fontSize: 13,
                    fontWeight: 500,
                    height: 38
                  }}
                >
                  {isSubmitting ? "Guardando..." : "Guardar cambios"}
                </Button>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
                <span style={{ fontSize: 12, color: "var(--foreground)", flex: 1 }}>
                  ¿Confirmas que quieres eliminar esta unidad? Esta acción no se puede deshacer.
                </span>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{ fontSize: 12, borderRadius: 7 }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    disabled={isSubmitting}
                    size="sm"
                    onClick={() => void handleDelete()}
                    style={{
                      backgroundColor: "var(--danger)",
                      color: "#FFFFFF",
                      borderRadius: 7,
                      fontSize: 12
                    }}
                  >
                    {isSubmitting ? "Eliminando..." : "Sí, eliminar"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </form>
      ) : (
        <div style={{ padding: "48px 0", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {error || "No fue posible cargar la ficha de esta unidad."}
          </p>
        </div>
      )}
    </PlatformShell>
  );
}
