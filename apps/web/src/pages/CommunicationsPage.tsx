import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, FileText, CheckCircle, XCircle, Layers } from "lucide-react";
import type { AuthResponse, PendingProxyRequestSummary, PropertySummary } from "@kuoro/contracts";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PlatformShell } from "../components/PlatformShell";
import { fetchMe, fetchPendingProxyRequests, getStoredToken, reviewProxyRequest } from "../lib/api";
import { ChannelsSettingsPanel } from "./communications/ChannelsSettingsPanel";
import { CampaignsPanel } from "./communications/CampaignsPanel";
import { TemplatesPanel } from "./communications/TemplatesPanel";
import { DocumentRegistryPanel } from "./communications/DocumentRegistryPanel";
import { DeliveriesPanel } from "./communications/DeliveriesPanel";

type CommTab = "bandeja" | "registro" | "canales" | "campanas" | "plantillas" | "entregas";

const rejectionReasonOptions = [
  "Documento ilegible",
  "Falta firma",
  "No identifica claramente al poderdante",
  "No corresponde a la unidad",
  "Datos inconsistentes",
  "Formato incompleto"
];

export function CommunicationsPage() {
  const [admin, setAdmin] = useState<AuthResponse["admin"] | null>(null);
  const [property, setProperty] = useState<PropertySummary | null>(null);
  const [requests, setRequests] = useState<PendingProxyRequestSummary[]>([]);
  const [reviewState, setReviewState] = useState<Record<string, { reasons: string[]; note: string }>>({});
  const [error, setError] = useState("");
  const [tab, setTab] = useState<CommTab>("bandeja");

  useEffect(() => {
    fetchMe()
      .then(async (data) => {
        const selected = data.properties[0] ?? null;
        setAdmin(data.admin);
        setProperty(selected);
        if (selected) {
          const res = await fetchPendingProxyRequests(selected.id);
          setRequests(res.requests);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No fue posible cargar comunicaciones"));
  }, []);

  if (!getStoredToken()) return <Navigate to="/login-admin" replace />;

  const pendingReviewRequests = requests.filter((r) => r.proxyApprovalStatus === "pending_review").length;
  const requestsWithFile = requests.filter((r) => Boolean(r.proxyDocumentData)).length;
  const requestsWithoutFile = Math.max(requests.length - requestsWithFile, 0);
  const submittedByThirdParty = requests.filter((r) => Boolean(r.proxySubmittedByName)).length;

  async function handleReview(ownerId: string, decision: "approved" | "rejected") {
    if (!property) return;
    const state = reviewState[ownerId] ?? { reasons: [], note: "" };
    if (decision === "rejected" && !state.reasons.length) {
      setError("Debes seleccionar al menos una razón para rechazar el poder");
      return;
    }
    setError("");
    try {
      await reviewProxyRequest(property.id, ownerId, {
        decision,
        reasons: decision === "rejected" ? state.reasons : undefined,
        note: decision === "rejected" ? state.note : undefined
      });
      const res = await fetchPendingProxyRequests(property.id);
      setRequests(res.requests);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible revisar el poder");
    }
  }

  function handleOpenProxyDocument(request: PendingProxyRequestSummary) {
    if (!request.proxyDocumentData) {
      setError("Esta solicitud todavía no tiene un archivo adjunto para revisar");
      return;
    }
    setError("");
    try {
      const [header, content] = request.proxyDocumentData.split(",", 2);
      const mimeType =
        request.proxyDocumentMimeType ||
        header.match(/^data:(.*?)(;base64)?$/)?.[1] ||
        "application/octet-stream";
      const binary = window.atob(content ?? "");
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const objectUrl = window.URL.createObjectURL(new Blob([bytes], { type: mimeType }));
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      setError("No fue posible abrir el archivo adjunto");
    }
  }

  const kpiCards = [
    { label: "Pendientes", value: requests.length, sub: "Solicitudes por resolver" },
    { label: "En revisión", value: pendingReviewRequests, sub: "Listas para decisión formal" },
    { label: "Con archivo", value: requestsWithFile, sub: `${requestsWithoutFile} sin adjunto` },
    { label: "Por tercero", value: submittedByThirdParty, sub: "Requieren lectura del emisor" }
  ];

  return (
    <PlatformShell
      activeSection="communications"
      admin={admin}
      assistantScope={property ? { propertyId: property.id } : undefined}
      notificationCount={requests.length}
      property={property}
      title="Comunicaciones"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header */}
        <motion.div
          className="card-base"
          style={{ padding: 24 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <span
                style={{
                  display: "inline-flex",
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 500,
                  marginBottom: 12,
                  backgroundColor: requests.length ? "var(--warning-surface)" : "var(--success-surface)",
                  color: requests.length ? "var(--warning)" : "var(--success)"
                }}
              >
                {requests.length ? "Requiere revisión" : "Sin pendientes"}
              </span>
              <span className="text-label" style={{ display: "block", marginBottom: 6 }}>
                Poderes y documentos
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
                Comunicaciones
              </h1>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
                Revisa poderes enviados, valida soportes y deja trazabilidad antes de habilitar representación y voto.
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: "0.5px solid var(--border)"
                }}
              >
                {(
                  [
                    ["bandeja", "Bandeja poderes"],
                    ["registro", "Registro documental"],
                    ["canales", "Canales"],
                    ["campanas", "Campañas"],
                    ["plantillas", "Plantillas"],
                    ["entregas", "Entregas"]
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 7,
                      fontSize: 12,
                      fontWeight: 500,
                      border: `0.5px solid ${tab === id ? "var(--primary)" : "var(--border)"}`,
                      background: tab === id ? "var(--accent)" : "transparent",
                      color: "var(--foreground)",
                      cursor: "pointer"
                    }}
                  >
                    {label === "Canales" ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Layers size={12} /> {label}
                      </span>
                    ) : (
                      label
                    )}
                  </button>
                ))}
              </div>
              {error && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>{error}</p>}
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <Link
                to="/asambleas"
                style={{
                  padding: "8px 14px",
                  backgroundColor: "var(--primary)",
                  color: "#FFFFFF",
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: "none"
                }}
              >
                Revisar representación
              </Link>
              {property && (
                <Link
                  to={`/unidades?propertyId=${property.id}`}
                  style={{
                    padding: "8px 14px",
                    backgroundColor: "var(--secondary)",
                    color: "var(--secondary-foreground)",
                    borderRadius: 7,
                    fontSize: 13,
                    fontWeight: 500,
                    textDecoration: "none"
                  }}
                >
                  Ver unidades
                </Link>
              )}
            </div>
          </div>
        </motion.div>

        {/* KPI strip */}
        {tab === "bandeja" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {kpiCards.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              className="card-base"
              style={{ padding: "16px 16px 14px", display: "flex", flexDirection: "column" }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.05 }}
            >
              <span className="text-label" style={{ marginBottom: 8 }}>{kpi.label}</span>
              <span className="text-metric">{kpi.value}</span>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{kpi.sub}</span>
            </motion.div>
          ))}
        </div>
        )}

        {tab === "registro" && property && <DocumentRegistryPanel propertyId={property.id} />}
        {tab === "canales" && property && <ChannelsSettingsPanel propertyId={property.id} />}
        {tab === "campanas" && property && (
          <CampaignsPanel propertyId={property.id} adminEmail={admin?.email ?? null} />
        )}
        {tab === "plantillas" && property && <TemplatesPanel propertyId={property.id} />}
        {tab === "entregas" && property && <DeliveriesPanel propertyId={property.id} />}

        {/* Review panel */}
        {tab === "bandeja" && (
        <div className="card-base" style={{ padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Mail size={14} style={{ color: "var(--primary)" }} />
            <h2 className="text-subtitle">Solicitudes de poder</h2>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 20 }}>
            Revisión formal antes de habilitar voto y convocatoria.
          </p>

          {requests.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {requests.map((request, i) => (
                <motion.div
                  key={request.ownerId}
                  className="card-base"
                  style={{ padding: 20 }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.05 }}
                >
                  {/* Request head */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 16
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>
                        {request.ownerName}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                        {request.unitLabel}
                        {request.proxySubmittedByName ? ` · enviado por ${request.proxySubmittedByName}` : ""}
                      </div>
                    </div>
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 500,
                        backgroundColor: "var(--warning-surface)",
                        color: "var(--warning)"
                      }}
                    >
                      {request.proxyApprovalStatus === "pending_review" ? "en revisión" : "pendiente"}
                    </span>
                  </div>

                  {/* Document row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px",
                      borderRadius: 7,
                      backgroundColor: "var(--muted)",
                      marginBottom: 16
                    }}
                  >
                    <FileText size={16} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
                        {request.proxyDocumentName ?? "Sin archivo adjunto"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                        {request.proxySubmittedByEmail ?? "Sin correo del emisor"}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      disabled={!request.proxyDocumentData}
                      onClick={() => handleOpenProxyDocument(request)}
                      style={{ fontSize: 12, borderRadius: 7, flexShrink: 0 }}
                    >
                      Ver archivo
                    </Button>
                  </div>

                  {/* Rejection reasons */}
                  <div style={{ marginBottom: 16 }}>
                    <div className="text-label" style={{ marginBottom: 8 }}>
                      Motivos de rechazo
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
                      {rejectionReasonOptions.map((reason) => {
                        const current = reviewState[request.ownerId]?.reasons ?? [];
                        const checked = current.includes(reason);
                        return (
                          <label
                            key={reason}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "8px 10px",
                              borderRadius: 7,
                              cursor: "pointer",
                              border: `0.5px solid ${checked ? "var(--primary)" : "var(--border)"}`,
                              backgroundColor: checked ? "var(--accent)" : "transparent"
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              style={{ accentColor: "var(--primary)", width: 13, height: 13 }}
                              onChange={(e) =>
                                setReviewState((prev) => {
                                  const existing = prev[request.ownerId] ?? { reasons: [], note: "" };
                                  return {
                                    ...prev,
                                    [request.ownerId]: {
                                      ...existing,
                                      reasons: e.target.checked
                                        ? [...existing.reasons, reason]
                                        : existing.reasons.filter((r) => r !== reason)
                                    }
                                  };
                                })
                              }
                            />
                            <span style={{ fontSize: 12, color: "var(--foreground)" }}>{reason}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Note */}
                  <div style={{ marginBottom: 16 }}>
                    <div className="text-label" style={{ marginBottom: 6 }}>
                      Nota adicional para el emisor
                    </div>
                    <Textarea
                      value={reviewState[request.ownerId]?.note ?? ""}
                      placeholder="Opcional: explica el motivo con más detalle..."
                      rows={2}
                      style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 12, resize: "vertical" }}
                      onChange={(e) =>
                        setReviewState((prev) => ({
                          ...prev,
                          [request.ownerId]: {
                            reasons: prev[request.ownerId]?.reasons ?? [],
                            note: e.target.value
                          }
                        }))
                      }
                    />
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button
                      type="button"
                      onClick={() => void handleReview(request.ownerId, "approved")}
                      style={{
                        backgroundColor: "var(--success)",
                        color: "#FFFFFF",
                        borderRadius: 7,
                        fontSize: 12,
                        fontWeight: 500,
                        height: 34,
                        gap: 6
                      }}
                    >
                      <CheckCircle size={13} />
                      Aprobar poder
                    </Button>
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => void handleReview(request.ownerId, "rejected")}
                      style={{ borderRadius: 7, fontSize: 12, height: 34, gap: 6 }}
                    >
                      <XCircle size={13} />
                      Rechazar con motivos
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "48px 20px",
                backgroundColor: "var(--muted)",
                borderRadius: 10
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 6 }}>
                No hay poderes pendientes
              </div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                La bandeja de revisión está limpia en este momento.
              </p>
            </div>
          )}
        </div>
        )}
      </div>
    </PlatformShell>
  );
}
