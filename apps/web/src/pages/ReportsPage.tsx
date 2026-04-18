import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, BarChart2 } from "lucide-react";
import type { AssemblyReadinessSummary, AuthResponse, PendingProxyRequestSummary, PropertySummary } from "@kuoro/contracts";
import { PlatformShell } from "../components/PlatformShell";
import { fetchAssemblyReadiness, fetchMe, fetchPendingProxyRequests, getStoredToken } from "../lib/api";
import { formatUnitLabel } from "../lib/unitLabels";

export function ReportsPage() {
  const [admin, setAdmin] = useState<AuthResponse["admin"] | null>(null);
  const [property, setProperty] = useState<PropertySummary | null>(null);
  const [readiness, setReadiness] = useState<AssemblyReadinessSummary | null>(null);
  const [requests, setRequests] = useState<PendingProxyRequestSummary[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMe()
      .then(async (data) => {
        const selected = data.properties[0] ?? null;
        setAdmin(data.admin);
        setProperty(selected);
        if (selected) {
          const [r, req] = await Promise.all([
            fetchAssemblyReadiness(selected.id),
            fetchPendingProxyRequests(selected.id)
          ]);
          setReadiness(r.readiness);
          setRequests(req.requests);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No fue posible cargar reportes"));
  }, []);

  if (!getStoredToken()) return <Navigate to="/login-admin" replace />;

  const totalUnits = readiness?.totalUnits ?? property?.totalUnits ?? 0;
  const representedUnits = readiness?.representedUnits ?? 0;
  const noVoterUnits = readiness?.units.filter((u) => u.status === "no_voter").length ?? 0;
  const pendingProxyUnits = readiness?.pendingProxyUnits ?? 0;
  const projectedQuorum = totalUnits ? ((representedUnits / totalUnits) * 100).toFixed(1) : "0.0";
  const riskyUnits =
    readiness?.units
      .filter((u) => u.status !== "owner_ready" && u.status !== "proxy_approved")
      .slice(0, 8) ?? [];
  const riskCount = noVoterUnits + pendingProxyUnits + requests.length;

  const kpiCards = [
    { label: "Unidades totales", value: totalUnits, sub: "Base registrada" },
    { label: "Quórum proyectado", value: `${projectedQuorum}%`, sub: `${representedUnits}/${totalUnits} representadas`, highlight: true },
    { label: "Destinatarios", value: readiness?.invitationRecipients ?? 0, sub: "Convocatoria objetivo" },
    { label: "Riesgos abiertos", value: riskCount, sub: `${requests.length} comunicaciones`, warn: riskCount > 0 }
  ];

  const indicators = [
    { label: "Unidades con poder pendiente", value: pendingProxyUnits },
    { label: "Votantes habilitados", value: readiness?.eligibleVoters ?? 0 },
    { label: "Convocatorias objetivo", value: readiness?.invitationRecipients ?? 0 },
    { label: "Sin votante habilitado", value: noVoterUnits }
  ];

  return (
    <PlatformShell
      activeSection="reports"
      admin={admin}
      assistantScope={property ? { propertyId: property.id } : undefined}
      notificationCount={requests.length + noVoterUnits}
      property={property}
      title="Reportes"
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
                  backgroundColor: riskCount ? "var(--warning-surface)" : "var(--success-surface)",
                  color: riskCount ? "var(--warning)" : "var(--success)"
                }}
              >
                {riskCount ? "Con alertas" : "Operación estable"}
              </span>
              <span className="text-label" style={{ display: "block", marginBottom: 6 }}>
                Métricas y trazabilidad
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
                Reportes
              </h1>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
                Consolida quorum, representación, destinatarios y riesgos antes de avanzar con convocatoria.
              </p>
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
                Ver preparación
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
                  Revisar unidades
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
              style={{ padding: "16px 16px 14px", display: "flex", flexDirection: "column" }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.05 }}
            >
              <span className="text-label" style={{ marginBottom: 8 }}>{kpi.label}</span>
              <span
                className="text-metric"
                style={{
                  color: kpi.warn ? "var(--warning)" : kpi.highlight ? "var(--primary)" : "var(--foreground)"
                }}
              >
                {kpi.value}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{kpi.sub}</span>
            </motion.div>
          ))}
        </div>

        {/* Detail */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 12 }}>
          {/* Risk by unit */}
          <div className="card-base" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <AlertTriangle size={14} style={{ color: "var(--warning)" }} />
              <h2 className="text-subtitle">Riesgos por unidad</h2>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
              Unidades que pueden afectar quorum, voto o convocatoria.
            </p>

            {riskyUnits.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {riskyUnits.map((unit) => (
                  <div
                    key={unit.unitId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: 7,
                      backgroundColor: "var(--muted)"
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
                        {formatUnitLabel({
                          groupingKind: unit.groupingKind,
                          groupingLabel: unit.groupingLabelText,
                          unitType: unit.unitType,
                          unitNumber: unit.unitNumber
                        })}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                        {unit.representatives.length
                          ? unit.representatives.map((r) => r.fullName).join(", ")
                          : "Sin representante"}
                      </div>
                    </div>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 500,
                        backgroundColor: unit.status === "no_voter" ? "var(--danger-surface)" : "var(--warning-surface)",
                        color: unit.status === "no_voter" ? "var(--danger)" : "var(--warning)"
                      }}
                    >
                      {unit.status === "proxy_pending" ? "poder pendiente" : "sin votante"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "30px 20px", backgroundColor: "var(--muted)", borderRadius: 7 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", marginBottom: 4 }}>
                  Sin riesgos por unidad
                </div>
                <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  La base operativa no presenta alertas en este momento.
                </p>
              </div>
            )}
          </div>

          {/* Indicators */}
          <div className="card-base" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <BarChart2 size={14} style={{ color: "var(--primary)" }} />
              <h2 className="text-subtitle">Indicadores</h2>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
              Lectura rápida de la preparación actual.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {indicators.map((ind) => (
                <div
                  key={ind.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: 7,
                    backgroundColor: "var(--muted)"
                  }}
                >
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ind.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{ind.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PlatformShell>
  );
}
