import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { SkeletonCard } from "../components/ui/skeleton";
import { cacheHas } from "../lib/cache";
import { LoadingModal } from "../components/ui/loading";
import { motion } from "framer-motion";
import { Building2, Layers, CalendarCheck, CheckCircle, ArrowRight } from "lucide-react";
import type {
  AgendaItemSummary,
  AssemblyAccessConfigSummary,
  AssemblyAccessGrantSummary,
  AssemblyDocumentSummary,
  AssemblyInvitationDeliverySummary,
  AssemblyInvitationRecipientSummary,
  AssemblyReadinessSummary,
  AssemblySummary,
  AuthResponse,
  PendingProxyRequestSummary,
  PropertyOperationalStatus,
  PropertySummary
} from "@kuoro/contracts";
import {
  fetchAssemblyAccess,
  fetchAssemblyAgenda,
  fetchAssemblyDocuments,
  fetchAssemblyInvitations,
  fetchAssemblyReadiness,
  fetchAssemblySettings,
  fetchMe,
  fetchPendingProxyRequests,
  getStoredToken,
  listAssemblies
} from "../lib/api";
import { PlatformShell } from "../components/PlatformShell";
import {
  AssemblyReadinessPanel,
  AttentionUnitsPanel,
  CriticalAlertsPanel,
  DashboardCommandCenter,
  DashboardModuleGrid,
  MetricTileGrid
} from "../components/dashboard/AdminDashboardSections";

function getPropertyStatus(property: PropertySummary | undefined) {
  if (!property) {
    return {
      label: "copropiedad pendiente",
      tone: "property-status-pending",
      title: "Aun no hay copropiedad configurada"
    };
  }

  const operationalStatus: PropertyOperationalStatus = property.operationalStatus ?? "active";

  if (operationalStatus === "inactive_payment") {
    return {
      label: "inactiva por pago",
      tone: "property-status-inactive",
      title: "La copropiedad esta inactiva por estado de pago"
    };
  }

  if (operationalStatus === "suspended") {
    return {
      label: "copropiedad suspendida",
      tone: "property-status-suspended",
      title: "La copropiedad requiere revision administrativa"
    };
  }

  if (operationalStatus === "pending_setup") {
    return {
      label: "en configuracion",
      tone: "property-status-pending",
      title: "La copropiedad aun necesita completar su configuracion"
    };
  }

  return {
    label: "copropiedad activa",
    tone: "property-status-active",
    title: "La copropiedad esta activa"
  };
}

type DashboardStatus = {
  label: string;
  tone: "status-danger" | "status-warn" | "status-live" | "status-info";
  detail: string;
};

type DashboardStatusInput = {
  property?: PropertySummary;
  totalUnits: number;
  representedUnits: number;
  assembly: AssemblySummary | null;
  agendaCount: number;
  documentsCount: number;
  requiredAgendaItems: number;
  requiredItemsWithDocuments: number;
  pendingProxyRequests: number;
  pendingProxyUnits: number;
  noVoterUnits: number;
  readyInvitationRecipients: number;
  sentInvitations: number;
  accessConfigured: boolean;
  accessReady: number;
  completedChecklistItems: number;
  checklistItems: number;
};

function joinStatusReasons(reasons: string[]) {
  if (reasons.length < 2) {
    return reasons[0] ?? "";
  }

  if (reasons.length === 2) {
    return `${reasons[0]} y ${reasons[1]}`;
  }

  return `${reasons.slice(0, -1).join(", ")} y ${reasons[reasons.length - 1]}`;
}

function toProgressWidth(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `${Math.min(Math.max(safeValue, 0), 100)}%`;
}

function getDashboardStatus(input: DashboardStatusInput): DashboardStatus {
  if (!input.property) {
    return {
      label: "Bloqueo operativo",
      tone: "status-danger",
      detail: "Falta crear la copropiedad antes de configurar unidades, convocatoria o apertura."
    };
  }

  const registeredUnits = input.totalUnits || input.property.totalUnits || 0;

  if (registeredUnits < 1) {
    return {
      label: "Bloqueo operativo",
      tone: "status-danger",
      detail: "La copropiedad existe, pero aun no hay unidades cargadas para operar la asamblea."
    };
  }

  if (!input.assembly) {
    return {
      label: "Bloqueo operativo",
      tone: "status-danger",
      detail: "Falta configurar la asamblea antes de preparar convocatoria, documentos y acceso."
    };
  }

  if (input.agendaCount < 1) {
    return {
      label: "Bloqueo operativo",
      tone: "status-danger",
      detail: "Falta registrar el orden del dia antes de cerrar la preparacion de la asamblea."
    };
  }

  const missingRequiredDocuments = Math.max(input.requiredAgendaItems - input.requiredItemsWithDocuments, 0);
  const hasDocumentSupport =
    input.requiredAgendaItems > 0 ? missingRequiredDocuments === 0 : input.documentsCount > 0;
  const priorityReasons = [
    missingRequiredDocuments > 0 ? `${missingRequiredDocuments} anexos obligatorios pendientes` : null,
    input.requiredAgendaItems === 0 && input.documentsCount < 1 ? "documentos soporte pendientes" : null,
    input.pendingProxyRequests > 0 ? `${input.pendingProxyRequests} poderes por revisar` : null,
    input.pendingProxyUnits > 0 ? `${input.pendingProxyUnits} unidades con poder pendiente` : null,
    input.noVoterUnits > 0 ? `${input.noVoterUnits} unidades sin votante habilitado` : null
  ].filter(Boolean) as string[];

  if (priorityReasons.length) {
    return {
      label: "Atencion prioritaria",
      tone: "status-warn",
      detail: `${joinStatusReasons(priorityReasons)} pueden afectar convocatoria, quorum o apertura.`
    };
  }

  if (!hasDocumentSupport || input.representedUnits < 1) {
    return {
      label: "En preparacion",
      tone: "status-info",
      detail: `${input.completedChecklistItems}/${input.checklistItems} pasos listos. Completa la base operativa antes de convocar.`
    };
  }

  if (input.readyInvitationRecipients > 0 && input.sentInvitations === 0) {
    return {
      label: "Lista para convocar",
      tone: "status-live",
      detail: `${input.readyInvitationRecipients} destinatarios estan listos. El siguiente paso es enviar la convocatoria.`
    };
  }

  if (input.sentInvitations > 0 && (!input.accessConfigured || input.accessReady < input.sentInvitations)) {
    return {
      label: "Convocatoria en curso",
      tone: "status-info",
      detail: `${input.sentInvitations} invitaciones enviadas. Monitorea confirmaciones y completa accesos pendientes.`
    };
  }

  if (input.sentInvitations > 0 && input.accessConfigured && input.accessReady >= input.sentInvitations) {
    return {
      label: "Lista para abrir",
      tone: "status-live",
      detail: "Convocatoria, documentos y acceso estan listos para abrir la asamblea."
    };
  }

  return {
    label: "Operacion estable",
    tone: "status-live",
    detail: "No hay alertas criticas activas. Puedes continuar con el seguimiento operativo."
  };
}

type SetupStep = {
  icon: React.ReactNode;
  label: string;
  detail: string;
  status: "done" | "active" | "pending";
  cta?: { label: string; to: string };
};

function SetupGuide({ steps }: { steps: SetupStep[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      {/* Hero */}
      <div
        className="card-base"
        style={{
          padding: "28px 32px",
          background: "linear-gradient(135deg, var(--primary) 0%, #8B7FE8 100%)",
          border: "none",
          borderRadius: 10
        }}
      >
        <span
          style={{
            display: "inline-block",
            padding: "3px 10px",
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.18)",
            color: "#FFFFFF",
            fontSize: 11,
            fontWeight: 500,
            marginBottom: 14
          }}
        >
          Configuración inicial
        </span>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color: "#FFFFFF",
            margin: "0 0 8px"
          }}
        >
          Bienvenido a Kuoro
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", margin: 0, lineHeight: 1.7, maxWidth: 480 }}>
          Completa los tres pasos de configuración para activar la plataforma y empezar a preparar tu primera asamblea.
        </p>
      </div>

      {/* Steps */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {steps.map((step, i) => {
          const isActive = step.status === "active";
          const isDone = step.status === "done";
          return (
            <motion.div
              key={step.label}
              className="card-base"
              style={{
                padding: "20px 22px",
                borderColor: isActive ? "var(--primary)" : isDone ? "var(--success)" : undefined,
                backgroundColor: isActive
                  ? "var(--accent)"
                  : isDone
                    ? "var(--success-surface)"
                    : undefined,
                position: "relative",
                overflow: "hidden"
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.06 }}
            >
              {/* Step number */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 14
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isDone
                      ? "var(--success)"
                      : isActive
                        ? "var(--primary)"
                        : "var(--border)",
                    flexShrink: 0
                  }}
                >
                  {isDone ? (
                    <CheckCircle size={16} style={{ color: "#FFFFFF" }} />
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 600, color: isActive ? "#FFFFFF" : "var(--text-tertiary)" }}>
                      {i + 1}
                    </span>
                  )}
                </div>
                <div style={{ color: isDone ? "var(--success)" : isActive ? "var(--primary)" : "var(--text-tertiary)" }}>
                  {step.icon}
                </div>
              </div>

              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: isDone
                    ? "var(--success)"
                    : isActive
                      ? "var(--foreground)"
                      : "var(--text-secondary)",
                  margin: "0 0 6px"
                }}
              >
                {step.label}
              </h3>
              <p
                style={{
                  fontSize: 12,
                  color: isDone ? "var(--success)" : "var(--text-secondary)",
                  margin: "0 0 16px",
                  lineHeight: 1.6,
                  opacity: step.status === "pending" ? 0.6 : 1
                }}
              >
                {step.detail}
              </p>

              {step.cta && isActive && (
                <Link
                  to={step.cta.to}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    backgroundColor: "var(--primary)",
                    color: "#FFFFFF",
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: 500,
                    textDecoration: "none"
                  }}
                >
                  {step.cta.label}
                  <ArrowRight size={12} />
                </Link>
              )}
              {isDone && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    color: "var(--success)",
                    fontWeight: 500
                  }}
                >
                  <CheckCircle size={11} /> Completado
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

export function AdminDashboardPage() {
  const [admin, setAdmin] = useState<AuthResponse["admin"] | null>(null);
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [pendingProxyRequests, setPendingProxyRequests] = useState<PendingProxyRequestSummary[]>([]);
  const [assemblyReadiness, setAssemblyReadiness] = useState<AssemblyReadinessSummary | null>(null);
  const [assembly, setAssembly] = useState<AssemblySummary | null>(null);
  const [agenda, setAgenda] = useState<AgendaItemSummary[]>([]);
  const [documents, setDocuments] = useState<AssemblyDocumentSummary[]>([]);
  const [invitationRecipients, setInvitationRecipients] = useState<AssemblyInvitationRecipientSummary[]>([]);
  const [invitationDeliveries, setInvitationDeliveries] = useState<AssemblyInvitationDeliverySummary[]>([]);
  const [accessConfig, setAccessConfig] = useState<AssemblyAccessConfigSummary | null>(null);
  const [accessGrants, setAccessGrants] = useState<AssemblyAccessGrantSummary[]>([]);
  // true when there is at least one assembly (active OR closed) — prevents onboarding from re-showing
  const [hasEverHadAssembly, setHasEverHadAssembly] = useState(false);
  const [error, setError] = useState("");
  // Start loading immediately if no cached data (first visit or post-mutation)
  const [isLoading, setIsLoading] = useState(() => !cacheHas("/auth/me"));

  useEffect(() => {
    fetchMe()
      .then(async (data) => {
        setAdmin(data.admin);
        setProperties(data.properties);
        if (data.properties[0]) {
          const [pending, readiness, settings, agendaResponse, documentsResponse, invitationsResponse, accessResponse, allAssembliesResponse] =
            await Promise.all([
              fetchPendingProxyRequests(data.properties[0].id),
              fetchAssemblyReadiness(data.properties[0].id),
              fetchAssemblySettings(data.properties[0].id),
              fetchAssemblyAgenda(data.properties[0].id),
              fetchAssemblyDocuments(data.properties[0].id),
              fetchAssemblyInvitations(data.properties[0].id),
              fetchAssemblyAccess(data.properties[0].id),
              listAssemblies(data.properties[0].id)
            ]);
          setPendingProxyRequests(pending.requests);
          setAssemblyReadiness(readiness.readiness);
          setAssembly(settings.assembly);
          setAgenda(agendaResponse.agenda);
          setDocuments(documentsResponse.documents);
          setInvitationRecipients(invitationsResponse.recipients);
          setInvitationDeliveries(invitationsResponse.deliveries);
          setAccessConfig(accessResponse.config);
          setAccessGrants(accessResponse.grants);
          setHasEverHadAssembly(allAssembliesResponse.assemblies.length > 0);
        }
      })
      .catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : "No fue posible cargar el dashboard");
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (!getStoredToken()) {
    return <Navigate to="/login-admin" replace />;
  }

  const primaryProperty = properties[0];
  const representedUnits = assemblyReadiness?.representedUnits ?? 0;
  const totalUnits = assemblyReadiness?.totalUnits ?? 0;
  const pendingProxyUnits = assemblyReadiness?.pendingProxyUnits ?? 0;
  const noVoterUnitIds = assemblyReadiness?.units.filter((unit) => unit.status === "no_voter").map((unit) => unit.unitId) ?? [];
  const noVoterUnits = noVoterUnitIds.length;
  const noVoterUnitsUrl = primaryProperty
    ? `/unidades?propertyId=${primaryProperty.id}&unitIds=${encodeURIComponent(noVoterUnitIds.join(","))}&filterLabel=${encodeURIComponent("sin votante habilitado")}`
    : `/unidades?unitIds=${encodeURIComponent(noVoterUnitIds.join(","))}&filterLabel=${encodeURIComponent("sin votante habilitado")}`;
  const projectedQuorum = totalUnits ? ((representedUnits / totalUnits) * 100).toFixed(1) : "0.0";
  const sentInvitations = invitationDeliveries.filter((delivery) => delivery.status === "sent").length;
  const readyInvitationRecipients = invitationRecipients.filter((recipient) => recipient.status === "ready").length;
  const accessReady = accessGrants.filter((grant) => grant.accessStatus === "ready").length;
  const requiredAgendaItems = agenda.filter((item) => item.requiresAttachment);
  const requiredItemsWithDocuments = requiredAgendaItems.filter((item) =>
    documents.some((document) => document.agendaItemId === item.id)
  ).length;
  const hasRequiredDocuments = requiredAgendaItems.length === requiredItemsWithDocuments && documents.length > 0;
  const assemblyDate = assembly?.scheduledAt
    ? new Date(assembly.scheduledAt).toLocaleString("es-CO", {
        dateStyle: "medium",
        timeStyle: "short"
      })
    : "Sin fecha configurada";
  const readinessChecklist = [
    {
      label: "Tipo y datos base de la asamblea",
      detail: assembly ? `${assembly.title} | ${assemblyDate}` : "Configura tipo, fecha, hora, modalidad y base de votacion",
      complete: Boolean(assembly)
    },
    {
      label: "Presentacion de la asamblea",
      detail: agenda.length
        ? `${agenda.length} puntos de presentacion | ${documents.length} anexos`
        : "Construye el guion, contenido visible, anexos y momentos de votacion",
      complete: agenda.length > 0
    },
    {
      label: "Acceso e identidad",
      detail: accessConfig ? `${accessReady} accesos listos para ingreso` : "Define metodo de identidad y canal de acceso",
      complete: Boolean(accessConfig) && accessReady > 0
    },
    {
      label: "Revision final de alistamiento",
      detail:
        sentInvitations > 0 && accessReady > 0 && noVoterUnits === 0 && pendingProxyRequests.length === 0
          ? "La asamblea ya tiene base para apertura"
          : `${pendingProxyRequests.length} poderes por revisar | ${noVoterUnits} unidades sin votante`,
      complete:
        Boolean(assembly) &&
        agenda.length > 0 &&
        totalUnits > 0 &&
        noVoterUnits === 0 &&
        pendingProxyRequests.length === 0 &&
        sentInvitations > 0 &&
        accessReady > 0
    },
    {
      label: "Sala en vivo",
      detail: "Ejecuta la presentacion y abre votaciones desde la sala",
      complete: false
    },
    {
      label: "Cierre e historico",
      detail: "Actas, resultados y trazabilidad despues de cerrar",
      complete: false
    }
  ];
  const completedChecklistItems = readinessChecklist.filter((item) => item.complete).length;
  const readinessPercentage = Math.round((completedChecklistItems / readinessChecklist.length) * 100);

  const dashboardStatus = getDashboardStatus({
    property: primaryProperty,
    totalUnits,
    representedUnits,
    assembly,
    agendaCount: agenda.length,
    documentsCount: documents.length,
    requiredAgendaItems: requiredAgendaItems.length,
    requiredItemsWithDocuments,
    pendingProxyRequests: pendingProxyRequests.length,
    pendingProxyUnits,
    noVoterUnits,
    readyInvitationRecipients,
    sentInvitations,
    accessConfigured: Boolean(accessConfig),
    accessReady,
    completedChecklistItems,
    checklistItems: readinessChecklist.length
  });
  const propertyStatus = getPropertyStatus(primaryProperty);

  const urgentAlerts = [
    !hasRequiredDocuments
      ? {
          title: "Documentos soporte incompletos",
          detail: requiredAgendaItems.length
            ? `Hay ${requiredAgendaItems.length - requiredItemsWithDocuments} anexos obligatorios pendientes.`
            : "Aun faltan documentos base para soportar la convocatoria.",
          tone: "alert-card-danger",
          to: "/asambleas"
        }
      : null,
    pendingProxyRequests.length
      ? {
          title: `${pendingProxyRequests.length} poderes pendientes de revision`,
          detail: "Revise estos poderes para no frenar acceso, convocatoria y voto.",
          tone: "alert-card-warning",
          to: "/comunicaciones"
        }
      : null,
    noVoterUnits > 0
      ? {
          title: `${noVoterUnits} unidades sin votante habilitado`,
          detail: "Estas unidades hoy no aportarian quorum ni voto real.",
          tone: "alert-card-danger",
          to: noVoterUnitsUrl
        }
      : null,
    sentInvitations === 0 && readyInvitationRecipients > 0
      ? {
          title: "Convocatoria lista pero no enviada",
          detail: `${readyInvitationRecipients} destinatarios estan listos para envio.`,
          tone: "alert-card-warning",
          to: "/asambleas"
        }
      : null,
    primaryProperty && (primaryProperty.totalUnits ?? 0) < 1
      ? {
          title: "Aun no hay unidades cargadas",
          detail: "Completa la base de unidades para activar preparacion y asamblea.",
          tone: "alert-card-danger",
          to: "/unidades-iniciales"
        }
      : null,
    primaryProperty && pendingProxyRequests.length === 0 && noVoterUnits === 0 && hasRequiredDocuments
      ? {
          title: "No hay alertas criticas activas",
          detail: "Puedes seguir con convocatoria, acceso o preparacion de la sesion.",
          tone: "alert-card-success",
          to: "/asambleas"
        }
      : null
  ].filter((item): item is { title: string; detail: string; tone: string; to: string } => Boolean(item));

  const nextActions = [
    !primaryProperty
      ? { title: "Crear copropiedad", detail: "Define datos, reglas y estructura.", to: "/crear-copropiedad", tone: "status-danger" }
      : null,
    primaryProperty && (primaryProperty.totalUnits ?? 0) < 1
      ? {
          title: "Cargar unidades",
          detail: "Agrega unidades privadas y propietarios.",
          to: `/unidades-iniciales?propertyId=${primaryProperty.id}`,
          tone: "status-warn"
        }
      : null,
    pendingProxyRequests.length
      ? {
          title: "Revisar poderes",
          detail: `${pendingProxyRequests.length} solicitudes esperan decision.`,
          to: "/comunicaciones",
          tone: "status-warn"
        }
      : null,
    !hasRequiredDocuments
      ? {
          title: "Completar documentos",
          detail: "Carga anexos o soportes obligatorios para la asamblea.",
          to: "/asambleas",
          tone: "status-danger"
        }
      : null,
    sentInvitations === 0 && readyInvitationRecipients > 0
      ? {
          title: "Enviar convocatoria",
          detail: `${readyInvitationRecipients} destinatarios estan listos.`,
          to: "/asambleas",
          tone: "status-warn"
        }
      : null,
    primaryProperty
      ? {
          title: "Preparar asamblea",
          detail: "Configura convocatoria, documentos y acceso.",
          to: "/asambleas",
          tone: "status-live"
        }
      : null
  ].filter((item): item is { title: string; detail: string; to: string; tone: string } => Boolean(item));
  const visibleNextActions = nextActions.slice(0, 3);
  const hiddenNextActions = nextActions.length - visibleNextActions.length;

  const operationalUnits =
    assemblyReadiness?.units
      .filter((unit) => unit.status !== "owner_ready" && unit.status !== "proxy_approved")
      .slice(0, 6) ?? [];
  const visibleUnits = operationalUnits.length ? operationalUnits : assemblyReadiness?.units.slice(0, 5) ?? [];
  const assistantContext = {
    headline: `${dashboardStatus.label}: ${dashboardStatus.detail}`,
    facts: [
      `Estado operativo: ${dashboardStatus.label}`,
      `Preparacion: ${completedChecklistItems}/${readinessChecklist.length} pasos listos`,
      `Quórum proyectado: ${projectedQuorum}%`,
      `Unidades representadas: ${representedUnits}/${totalUnits}`,
      `Poderes pendientes: ${pendingProxyRequests.length}`,
      `Unidades sin votante: ${noVoterUnits}`,
      `Documentos cargados: ${documents.length}`,
      `Convocatorias enviadas: ${sentInvitations}`
    ],
    suggestions: [
      "Que falta para convocar",
      "Dame un resumen ejecutivo",
      "Redacta un recordatorio para propietarios",
      "Que deberia revisar primero"
    ]
  };

  return (
    <PlatformShell
      activeSection="dashboard"
      admin={admin}
      assistantContext={assistantContext}
      assistantScope={{ propertyId: primaryProperty?.id }}
      notificationCount={pendingProxyRequests.length + noVoterUnits}
      property={primaryProperty ?? null}
      title="Panel de control"
    >
        {error ? (
          <p style={{ fontSize: 12, color: "var(--danger)", padding: "10px 14px", backgroundColor: "var(--danger-surface)", borderRadius: 7, border: "0.5px solid var(--danger)" }}>
            {error}
          </p>
        ) : null}

        {/* ── Overlay while loading (no cached data) ── */}
        <LoadingModal visible={isLoading} message="Cargando panel de control..." />

        {/* ── Setup guide: only shown when truly incomplete (never had an assembly) ── */}
        {!isLoading && (!primaryProperty || totalUnits < 1 || (!assembly && !hasEverHadAssembly)) && (() => {
          const hasProperty = Boolean(primaryProperty);
          const hasUnits = hasProperty && totalUnits >= 1;
          const hasAssembly = Boolean(assembly) || hasEverHadAssembly;

          const setupSteps: SetupStep[] = [
            {
              icon: <Building2 size={16} />,
              label: "Crear la copropiedad",
              detail: hasProperty
                ? `${primaryProperty!.name} configurada correctamente.`
                : "Registra los datos legales, la estructura y las reglas operativas.",
              status: hasProperty ? "done" : "active",
              cta: { label: "Crear copropiedad", to: "/crear-copropiedad" }
            },
            {
              icon: <Layers size={16} />,
              label: "Cargar las unidades",
              detail: hasUnits
                ? `${totalUnits} unidades registradas.`
                : hasProperty
                  ? "Agrega las unidades privadas con sus propietarios y coeficientes."
                  : "Disponible después de crear la copropiedad.",
              status: hasUnits ? "done" : hasProperty ? "active" : "pending",
              cta: hasProperty
                ? { label: "Cargar unidades", to: `/unidades-iniciales?propertyId=${primaryProperty!.id}` }
                : undefined
            },
            {
              icon: <CalendarCheck size={16} />,
              label: "Configurar la asamblea",
              detail: assembly
                ? `Asamblea "${assembly.title}" configurada.`
                : hasEverHadAssembly
                  ? "Ya realizaste una asamblea. Puedes crear una nueva cuando la necesites."
                  : hasUnits
                    ? "Define tipo, fecha, modalidad y presentación de la asamblea."
                    : "Disponible después de cargar las unidades.",
              status: hasAssembly ? "done" : hasUnits ? "active" : "pending",
              cta: hasUnits ? { label: "Preparar asamblea", to: "/asambleas" } : undefined
            }
          ];

          return <SetupGuide steps={setupSteps} />;
        })()}

        {!isLoading && <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <DashboardCommandCenter
            assembly={assembly}
            assemblyDate={assemblyDate}
            completedChecklistItems={completedChecklistItems}
            dashboardStatus={dashboardStatus}
            hiddenNextActions={hiddenNextActions}
            propertyStatus={propertyStatus}
            readinessChecklistLength={readinessChecklist.length}
            readinessPercentage={readinessPercentage}
            visibleNextActions={visibleNextActions}
          />

          <MetricTileGrid
            pendingProxyRequests={pendingProxyRequests.length}
            primaryProperty={primaryProperty}
            projectedQuorum={projectedQuorum}
            readyInvitationRecipients={readyInvitationRecipients}
            representedUnits={representedUnits}
            sentInvitations={sentInvitations}
            toProgressWidth={toProgressWidth}
            totalUnits={totalUnits}
          />

          <AssemblyReadinessPanel assembly={assembly} assemblyDate={assemblyDate} readinessChecklist={readinessChecklist} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <AttentionUnitsPanel primaryProperty={primaryProperty} visibleUnits={visibleUnits} />
            <CriticalAlertsPanel urgentAlerts={urgentAlerts} />
          </div>

          <DashboardModuleGrid
            accessReady={accessReady}
            agendaCount={agenda.length}
            assembly={assembly}
            completedChecklistItems={completedChecklistItems}
            noVoterUnits={noVoterUnits}
            pendingProxyRequests={pendingProxyRequests}
            primaryProperty={primaryProperty}
            projectedQuorum={projectedQuorum}
            readinessChecklistLength={readinessChecklist.length}
            sentInvitations={sentInvitations}
          />
        </div>}
    </PlatformShell>
  );
}
