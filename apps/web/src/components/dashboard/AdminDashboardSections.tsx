import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle, Shield, Calendar, ArrowRight } from "lucide-react";
import type { AssemblyReadinessSummary, AssemblySummary, PropertySummary } from "@kuoro/contracts";
import { formatUnitLabel } from "../../lib/unitLabels";

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardStatus = {
  label: string;
  tone: "status-danger" | "status-warn" | "status-live" | "status-info";
  detail: string;
};

type PropertyStatus = {
  label: string;
  tone: string;
  title: string;
};

type NextAction = {
  title: string;
  detail: string;
  to: string;
  tone: string;
};

type ReadinessChecklistItem = {
  label: string;
  detail: string;
  complete: boolean;
};

type UrgentAlert = {
  title: string;
  detail: string;
  tone: string;
  to: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toneToColors(tone: string): { bg: string; color: string } {
  if (tone.includes("live") || tone.includes("success") || tone.includes("active")) {
    return { bg: "var(--success-surface)", color: "var(--success)" };
  }
  if (tone.includes("warn") || tone.includes("warning")) {
    return { bg: "var(--warning-surface)", color: "var(--warning)" };
  }
  if (tone.includes("danger")) {
    return { bg: "var(--danger-surface)", color: "var(--danger)" };
  }
  return { bg: "var(--accent)", color: "var(--accent-foreground)" };
}

function getUnitStatusColors(status: AssemblyReadinessSummary["units"][number]["status"]) {
  if (status === "proxy_approved" || status === "owner_ready") {
    return { bg: "var(--success-surface)", color: "var(--success)" };
  }
  if (status === "proxy_pending") {
    return { bg: "var(--warning-surface)", color: "var(--warning)" };
  }
  return { bg: "var(--danger-surface)", color: "var(--danger)" };
}

function getUnitStatusLabel(status: AssemblyReadinessSummary["units"][number]["status"]) {
  if (status === "proxy_approved") return "por apoderado";
  if (status === "owner_ready") return "propietario listo";
  if (status === "proxy_pending") return "poder pendiente";
  return "sin votante";
}

// ─── Countdown ────────────────────────────────────────────────────────────────

function AssemblyCountdown({
  assembly,
  assemblyDate
}: {
  assembly: AssemblySummary | null;
  assemblyDate: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const target = assembly?.scheduledAt ? new Date(assembly.scheduledAt).getTime() : null;
  const ms = target ? Math.max(target - now, 0) : null;
  const days = ms !== null ? Math.floor(ms / 86_400_000) : 0;
  const hours = ms !== null ? Math.floor((ms % 86_400_000) / 3_600_000) : 0;
  const minutes = ms !== null ? Math.floor((ms % 3_600_000) / 60_000) : 0;
  const seconds = ms !== null ? Math.floor((ms % 60_000) / 1_000) : 0;

  return (
    <div
      className="card-base"
      style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Calendar size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />
        <span className="text-label">Próxima asamblea</span>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", lineHeight: 1.4 }}>
          {assembly?.title ?? "Sin asamblea programada"}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{assemblyDate}</div>
      </div>

      {ms !== null ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {[
            ["días", days],
            ["horas", hours],
            ["min", minutes],
            ["seg", seconds]
          ].map(([unit, value]) => (
            <div key={String(unit)} style={{ textAlign: "center" }}>
              <div className="text-metric" style={{ fontSize: 22 }}>
                {String(value).padStart(2, "0")}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>
                {unit}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
          Configura una fecha para activar el cronómetro.
        </p>
      )}
    </div>
  );
}

// ─── Command Center ───────────────────────────────────────────────────────────

export function DashboardCommandCenter({
  assembly,
  assemblyDate,
  completedChecklistItems,
  dashboardStatus,
  hiddenNextActions,
  propertyStatus,
  readinessChecklistLength,
  readinessPercentage,
  visibleNextActions
}: {
  assembly: AssemblySummary | null;
  assemblyDate: string;
  completedChecklistItems: number;
  dashboardStatus: DashboardStatus;
  hiddenNextActions: number;
  propertyStatus: PropertyStatus;
  readinessChecklistLength: number;
  readinessPercentage: number;
  visibleNextActions: NextAction[];
}) {
  const statusColors = toneToColors(dashboardStatus.tone);
  const propertyColors = toneToColors(propertyStatus.tone);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 264px", gap: 12 }}>
      {/* Hero status card */}
      <div className="card-base" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <span className="text-label" style={{ display: "block", marginBottom: 8 }}>
              Estado operativo
            </span>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: "-0.02em",
                color: "var(--foreground)",
                margin: 0,
                lineHeight: 1.3
              }}
            >
              {dashboardStatus.label}
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8, lineHeight: 1.6, marginBottom: 0 }}>
              {dashboardStatus.detail}
            </p>
          </div>

          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div className="text-metric" style={{ color: "var(--primary)" }}>
              {readinessPercentage}%
            </div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>preparación</div>
          </div>
        </div>

        {/* Metadata strip */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            paddingTop: 16,
            borderTop: "0.5px solid var(--border)",
            alignItems: "center"
          }}
        >
          {[
            { label: "Asamblea", value: assembly?.title ?? "Sin configurar" },
            { label: "Fecha", value: assemblyDate },
            { label: "Preparación", value: `${completedChecklistItems}/${readinessChecklistLength} pasos` }
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-label">{label}</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", marginTop: 2 }}>
                {value}
              </div>
            </div>
          ))}

          <span
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              padding: "3px 10px",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 500,
              backgroundColor: propertyColors.bg,
              color: propertyColors.color
            }}
            title={propertyStatus.title}
          >
            {propertyStatus.label}
          </span>
        </div>

        <div style={{ marginTop: 16 }}>
          <Link
            to="/asambleas"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              backgroundColor: "var(--primary)",
              color: "#FFFFFF",
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              border: "none"
            }}
          >
            Configurar asamblea
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Next actions */}
      <div className="card-base" style={{ padding: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12
          }}
        >
          <span className="text-subtitle">Acciones siguientes</span>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            {visibleNextActions.length + hiddenNextActions} abiertas
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {visibleNextActions.map((action) => {
            const colors = toneToColors(action.tone);
            return (
              <Link
                key={action.title}
                to={action.to}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "10px 10px",
                  borderRadius: 7,
                  backgroundColor: "var(--muted)",
                  textDecoration: "none"
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: colors.color,
                    flexShrink: 0,
                    marginTop: 4
                  }}
                />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", lineHeight: 1.4 }}>
                    {action.title}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.4 }}>
                    {action.detail}
                  </div>
                </div>
              </Link>
            );
          })}

          {hiddenNextActions > 0 && (
            <Link
              to="/asambleas"
              style={{
                fontSize: 11,
                textAlign: "center",
                color: "var(--primary)",
                textDecoration: "none",
                padding: "6px 0"
              }}
            >
              +{hiddenNextActions} acciones más
            </Link>
          )}

          {visibleNextActions.length === 0 && hiddenNextActions === 0 && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "center", padding: "12px 0" }}>
              Sin acciones pendientes
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Metric Tile Grid ─────────────────────────────────────────────────────────

export function MetricTileGrid({
  pendingProxyRequests,
  primaryProperty,
  projectedQuorum,
  readyInvitationRecipients,
  representedUnits,
  sentInvitations,
  toProgressWidth,
  totalUnits
}: {
  pendingProxyRequests: number;
  primaryProperty?: PropertySummary;
  projectedQuorum: string;
  readyInvitationRecipients: number;
  representedUnits: number;
  sentInvitations: number;
  toProgressWidth: (value: number) => string;
  totalUnits: number;
}) {
  const tiles = [
    {
      label: "Unidades totales",
      value: totalUnits || primaryProperty?.totalUnits || 0,
      sub: "Base registrada",
      progress: totalUnits || primaryProperty?.totalUnits ? 100 : 0
    },
    {
      label: "Con representación",
      value: representedUnits,
      sub: "Para quorum",
      progress: totalUnits ? (representedUnits / totalUnits) * 100 : 0
    },
    {
      label: "Quórum proyectado",
      value: `${projectedQuorum}%`,
      sub: `${representedUnits}/${totalUnits} representadas`,
      progress: Number(projectedQuorum)
    },
    {
      label: "Poderes pendientes",
      value: pendingProxyRequests,
      sub: "En comunicaciones",
      progress: totalUnits ? (pendingProxyRequests / totalUnits) * 100 : 0,
      warn: pendingProxyRequests > 0
    },
    {
      label: "Convocatorias enviadas",
      value: sentInvitations,
      sub: `${readyInvitationRecipients} destinatarios listos`,
      progress: readyInvitationRecipients
        ? (sentInvitations / readyInvitationRecipients) * 100
        : 0
    }
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
      {tiles.map((tile, i) => (
        <motion.div
          key={tile.label}
          className="card-base"
          style={{ padding: "16px 16px 14px", display: "flex", flexDirection: "column" }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: i * 0.05 }}
        >
          <span className="text-label" style={{ marginBottom: 8 }}>
            {tile.label}
          </span>
          <span
            className="text-metric"
            style={{ color: tile.warn ? "var(--warning)" : "var(--foreground)" }}
          >
            {tile.value}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, lineHeight: 1.4 }}>
            {tile.sub}
          </span>
          <div className="progress-bar" style={{ marginTop: "auto", paddingTop: 12 }}>
            <div
              className="progress-bar-fill"
              style={{
                width: toProgressWidth(tile.progress),
                backgroundColor: tile.warn ? "var(--warning)" : "var(--primary)"
              }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Readiness Panel ──────────────────────────────────────────────────────────

export function AssemblyReadinessPanel({
  assembly,
  assemblyDate,
  readinessChecklist
}: {
  assembly: AssemblySummary | null;
  assemblyDate: string;
  readinessChecklist: ReadinessChecklistItem[];
}) {
  return (
    <div className="card-base" style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 20
        }}
      >
        <div>
          <h2 className="text-subtitle">Preparación de la asamblea</h2>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            Checklist calculado con la información guardada en la plataforma.
          </p>
        </div>
        <Link
          to="/asambleas"
          style={{
            display: "inline-flex",
            padding: "6px 12px",
            backgroundColor: "var(--secondary)",
            color: "var(--secondary-foreground)",
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 500,
            textDecoration: "none",
            flexShrink: 0
          }}
        >
          Ir al detalle
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 20 }}>
        {/* Checklist */}
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
          {readinessChecklist.map((item, index) => (
            <li key={item.label}>
              <Link
                to="/asambleas"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 7,
                  backgroundColor: item.complete ? "var(--success-surface)" : "var(--muted)",
                  textDecoration: "none"
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 600,
                    flexShrink: 0,
                    backgroundColor: item.complete ? "var(--success)" : "var(--border)",
                    color: item.complete ? "#FFFFFF" : "var(--text-secondary)"
                  }}
                >
                  {item.complete ? "✓" : index + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: item.complete ? "var(--success)" : "var(--foreground)",
                      lineHeight: 1.4
                    }}
                  >
                    {item.label}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.4 }}>
                    {item.detail}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ol>

        {/* Countdown */}
        <AssemblyCountdown assembly={assembly} assemblyDate={assemblyDate} />
      </div>
    </div>
  );
}

// ─── Attention Units Panel ────────────────────────────────────────────────────

export function AttentionUnitsPanel({
  primaryProperty,
  visibleUnits
}: {
  primaryProperty?: PropertySummary;
  visibleUnits: AssemblyReadinessSummary["units"];
}) {
  return (
    <div className="card-base" style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 16
        }}
      >
        <div>
          <h2 className="text-subtitle">Unidades con atención requerida</h2>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            Conectada al panel de unidades y propietarios.
          </p>
        </div>
        {primaryProperty && (
          <Link
            to={`/unidades?propertyId=${primaryProperty.id}`}
            style={{
              display: "inline-flex",
              padding: "6px 12px",
              backgroundColor: "var(--secondary)",
              color: "var(--secondary-foreground)",
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 500,
              textDecoration: "none",
              flexShrink: 0
            }}
          >
            Ver unidades
          </Link>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {visibleUnits.map((unit) => {
          const colors = getUnitStatusColors(unit.status);
          return (
            <Link
              key={unit.unitId}
              to={`/unidades/${unit.unitId}${primaryProperty ? `?propertyId=${primaryProperty.id}` : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 7,
                backgroundColor: "var(--muted)",
                textDecoration: "none"
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", lineHeight: 1.4 }}>
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
                  display: "inline-flex",
                  padding: "2px 8px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 500,
                  backgroundColor: colors.bg,
                  color: colors.color,
                  flexShrink: 0
                }}
              >
                {getUnitStatusLabel(unit.status)}
              </span>
            </Link>
          );
        })}

        {!visibleUnits.length && (
          <div
            style={{
              padding: "20px 12px",
              textAlign: "center",
              borderRadius: 7,
              backgroundColor: "var(--muted)"
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>Sin datos</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
              Carga unidades para activar este módulo.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Critical Alerts Panel ────────────────────────────────────────────────────

export function CriticalAlertsPanel({ urgentAlerts }: { urgentAlerts: UrgentAlert[] }) {
  return (
    <div className="card-base" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <AlertTriangle size={14} style={{ color: "var(--warning)", flexShrink: 0 }} />
        <h2 className="text-subtitle">Alertas críticas</h2>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
        Lo que puede frenar convocatoria, acceso o votación.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {urgentAlerts.map((alert) => {
          const colors = toneToColors(alert.tone);
          const Icon =
            alert.tone === "alert-card-danger"
              ? AlertTriangle
              : alert.tone === "alert-card-warning"
                ? Shield
                : CheckCircle;

          return (
            <Link
              key={alert.title}
              to={alert.to}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 12px",
                borderRadius: 7,
                backgroundColor: colors.bg,
                textDecoration: "none",
                borderLeft: `2px solid ${colors.color}`
              }}
            >
              <Icon
                size={14}
                style={{ color: colors.color, flexShrink: 0, marginTop: 1 }}
              />
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", lineHeight: 1.4 }}>
                  {alert.title}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.4 }}>
                  {alert.detail}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Module Grid ──────────────────────────────────────────────────────────────

export function DashboardModuleGrid({
  accessReady,
  agendaCount,
  assembly,
  completedChecklistItems,
  noVoterUnits,
  pendingProxyRequests,
  primaryProperty,
  projectedQuorum,
  readinessChecklistLength,
  sentInvitations
}: {
  accessReady: number;
  agendaCount: number;
  assembly: AssemblySummary | null;
  completedChecklistItems: number;
  noVoterUnits: number;
  pendingProxyRequests: Array<{ ownerName: string; unitLabel: string }>;
  primaryProperty?: PropertySummary;
  projectedQuorum: string;
  readinessChecklistLength: number;
  sentInvitations: number;
}) {
  const modules = [
    {
      label: "Copropiedad",
      to: "/copropiedad",
      title: primaryProperty?.name ?? "Configura la copropiedad",
      detail: primaryProperty?.address ?? "Completa los datos base, estructura y reglas.",
      metrics: [
        { label: "unidades", value: primaryProperty?.totalUnits ?? 0 },
        { label: "estructuras", value: primaryProperty?.structureModes?.length ?? 0 }
      ],
      action: "Ver copropiedad"
    },
    {
      label: "Comunicaciones",
      to: "/comunicaciones",
      title: pendingProxyRequests.length
        ? `${pendingProxyRequests.length} poderes por revisar`
        : "Bandeja despejada",
      detail: pendingProxyRequests[0]
        ? `${pendingProxyRequests[0].ownerName} | ${pendingProxyRequests[0].unitLabel}`
        : "No hay poderes pendientes de revisión.",
      metrics: [
        { label: "pendientes", value: pendingProxyRequests.length },
        { label: "visibles", value: pendingProxyRequests.slice(0, 3).length }
      ],
      action: "Revisar comunicaciones",
      warn: pendingProxyRequests.length > 0
    },
    {
      label: "Asambleas",
      to: "/asambleas",
      title: assembly?.title ?? "Prepara la siguiente asamblea",
      detail: agendaCount
        ? `${agendaCount} puntos en el orden del día.`
        : "Aún falta estructurar el orden del día.",
      metrics: [
        { label: "pasos", value: `${completedChecklistItems}/${readinessChecklistLength}` },
        { label: "enviadas", value: sentInvitations }
      ],
      action: "Ver asambleas"
    },
    {
      label: "Reportes",
      to: "/reportes",
      title: "Métricas operativas",
      detail: `${projectedQuorum}% de quórum proyectado con la información disponible.`,
      metrics: [
        { label: "sin votante", value: noVoterUnits },
        { label: "accesos", value: accessReady }
      ],
      action: "Ver reportes",
      warn: noVoterUnits > 0
    }
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
      {modules.map((module, i) => (
        <motion.div
          key={module.label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: i * 0.05 }}
        >
          <Link
            to={module.to}
            style={{
              display: "flex",
              flexDirection: "column",
              padding: 20,
              borderRadius: 10,
              border: "0.5px solid var(--border)",
              backgroundColor: "var(--card)",
              textDecoration: "none",
              height: "100%"
            }}
          >
            <span className="text-label" style={{ marginBottom: 8 }}>
              {module.label}
            </span>
            <div
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: module.warn ? "var(--warning)" : "var(--foreground)",
                lineHeight: 1.4,
                marginBottom: 6
              }}
            >
              {module.title}
            </div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, flex: 1, margin: 0 }}>
              {module.detail}
            </p>

            <div
              style={{
                display: "flex",
                gap: 16,
                marginTop: 16,
                paddingTop: 12,
                borderTop: "0.5px solid var(--border)"
              }}
            >
              {module.metrics.map((m) => (
                <div key={m.label}>
                  <div style={{ fontSize: 16, fontWeight: 500, color: "var(--foreground)", lineHeight: 1 }}>
                    {m.value}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>{m.label}</div>
                </div>
              ))}
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 11,
                  color: "var(--primary)",
                  alignSelf: "flex-end",
                  fontWeight: 500
                }}
              >
                {module.action} →
              </span>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
