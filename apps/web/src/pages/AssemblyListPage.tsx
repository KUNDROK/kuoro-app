import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Calendar, ChevronRight, Clock, CheckCircle, AlertCircle, Play, Archive } from "lucide-react";
import { toast } from "sonner";
import type { AssemblySummary, AuthResponse, PropertySummary } from "@kuoro/contracts";
import { Button } from "@/components/ui/button";
import { PlatformShell } from "../components/PlatformShell";
import { createNewAssembly, fetchMe, getStoredToken, listAssemblies } from "../lib/api";
import { LoadingModal } from "../components/ui/loading";
import { cacheHas } from "../lib/cache";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(value: string | undefined) {
  if (!value) return "Fecha pendiente";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "Fecha inválida";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

function getStatusConfig(status: AssemblySummary["status"]) {
  const map: Record<
    AssemblySummary["status"],
    { label: string; color: string; bg: string; icon: React.ReactNode }
  > = {
    draft: {
      label: "Borrador",
      color: "var(--text-secondary)",
      bg: "var(--muted)",
      icon: <Clock size={11} />
    },
    scheduled: {
      label: "Programada",
      color: "var(--warning)",
      bg: "var(--warning-surface)",
      icon: <Calendar size={11} />
    },
    invitation_sent: {
      label: "Convocada",
      color: "var(--primary)",
      bg: "var(--accent)",
      icon: <CheckCircle size={11} />
    },
    in_progress: {
      label: "En curso",
      color: "#FFFFFF",
      bg: "var(--success)",
      icon: <Play size={11} />
    },
    closed: {
      label: "Cerrada",
      color: "var(--text-secondary)",
      bg: "var(--muted)",
      icon: <CheckCircle size={11} />
    },
    archived: {
      label: "Archivada",
      color: "var(--text-tertiary)",
      bg: "var(--muted)",
      icon: <Archive size={11} />
    }
  };
  return map[status] ?? map.draft;
}

const ACTIVE_STATUSES: AssemblySummary["status"][] = [
  "draft",
  "scheduled",
  "invitation_sent",
  "in_progress"
];

// ─── Component ────────────────────────────────────────────────────────────────

export function AssemblyListPage() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState<AuthResponse["admin"] | null>(null);
  const [property, setProperty] = useState<PropertySummary | null>(null);
  const [assemblies, setAssemblies] = useState<AssemblySummary[]>([]);
  const [isLoading, setIsLoading] = useState(() => !cacheHas("/auth/me"));
  const [isCreating, setIsCreating] = useState(false);

  const token = getStoredToken();
  if (!token) return <Navigate to="/login-admin" replace />;

  useEffect(() => {
    fetchMe()
      .then(async (data) => {
        const prop = data.properties[0] ?? null;
        setAdmin(data.admin);
        setProperty(prop);
        if (prop) {
          const res = await listAssemblies(prop.id);
          setAssemblies(res.assemblies);
        }
      })
      .catch(() => toast.error("No fue posible cargar las asambleas"))
      .finally(() => setIsLoading(false));
  }, []);

  const activeAssemblies = assemblies.filter((a) => ACTIVE_STATUSES.includes(a.status));
  const historicalAssemblies = assemblies.filter((a) => !ACTIVE_STATUSES.includes(a.status));
  const hasActiveAssembly = activeAssemblies.length > 0;

  async function handleCreateAssembly() {
    if (!property) return;
    setIsCreating(true);
    try {
      const now = new Date();
      const defaultDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      const pad = (n: number) => String(n).padStart(2, "0");
      const scheduledAt = `${defaultDate.getFullYear()}-${pad(defaultDate.getMonth() + 1)}-${pad(defaultDate.getDate())}T09:00`;

      const res = await createNewAssembly(property.id, {
        title: "Asamblea general ordinaria",
        type: "ordinaria",
        modality: "mixta",
        status: "draft",
        scheduledAt,
        conferenceService: "kuoro_live",
        location: "",
        virtualAccessUrl: "",
        notes: "",
        votingBasis: "coeficientes",
        allowsSecondCall: false,
        secondCallScheduledAt: ""
      });
      navigate(`/asambleas/${res.assembly.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No fue posible crear la asamblea";
      toast.error(msg);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <PlatformShell
      activeSection="assemblies"
      admin={admin}
      assistantScope={property ? { propertyId: property.id } : undefined}
      property={property}
      title="Asambleas"
    >
      <LoadingModal visible={isLoading && assemblies.length === 0} message="Cargando asambleas..." />
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}
        >
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--foreground)", letterSpacing: "-0.02em", margin: 0 }}>
              Asambleas
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>
              {property
                ? `Gestiona las asambleas de ${property.name}`
                : "Configura una copropiedad para gestionar asambleas"}
            </p>
          </div>

          {property && (
            <Button
              onClick={handleCreateAssembly}
              disabled={isCreating || hasActiveAssembly}
              title={hasActiveAssembly ? "Cierra la asamblea activa antes de crear una nueva" : undefined}
              style={{
                backgroundColor: "var(--primary)",
                color: "#FFFFFF",
                borderRadius: 7,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Plus size={14} />
              {isCreating ? "Creando..." : "Nueva asamblea"}
            </Button>
          )}
        </motion.div>


        {/* No property */}
        {!isLoading && !property && (
          <div className="card-base" style={{ padding: 40, textAlign: "center" }}>
            <AlertCircle size={32} style={{ color: "var(--warning)", margin: "0 auto 12px" }} />
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)", marginBottom: 6 }}>
              Sin copropiedad configurada
            </div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 20 }}>
              Necesitas configurar una copropiedad antes de gestionar asambleas.
            </p>
            <Link
              to="/crear-copropiedad"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                backgroundColor: "var(--primary)",
                color: "#FFFFFF",
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none"
              }}
            >
              Configurar copropiedad
            </Link>
          </div>
        )}

        {/* Active assemblies */}
        {!isLoading && property && (
          <>
            {activeAssemblies.length === 0 && historicalAssemblies.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.05 }}
                className="card-base"
                style={{ padding: 48, textAlign: "center" }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: "var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px"
                  }}
                >
                  <Calendar size={22} style={{ color: "var(--primary)" }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 500, color: "var(--foreground)", marginBottom: 6 }}>
                  Sin asambleas todavía
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.6 }}>
                  Crea tu primera asamblea y lleva el proceso de principio a fin desde aquí.
                </p>
                <Button
                  onClick={handleCreateAssembly}
                  disabled={isCreating}
                  style={{
                    backgroundColor: "var(--primary)",
                    color: "#FFFFFF",
                    borderRadius: 7,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <Plus size={14} />
                  {isCreating ? "Creando..." : "Crear primera asamblea"}
                </Button>
              </motion.div>
            )}

            {activeAssemblies.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.05 }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    marginBottom: 8
                  }}
                >
                  Asamblea activa
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {activeAssemblies.map((assembly) => (
                    <AssemblyCard key={assembly.id} assembly={assembly} isActive />
                  ))}
                </div>
              </motion.div>
            )}

            {historicalAssemblies.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.1 }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    marginBottom: 8
                  }}
                >
                  Historial
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {historicalAssemblies.map((assembly) => (
                    <AssemblyCard key={assembly.id} assembly={assembly} isActive={false} />
                  ))}
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </PlatformShell>
  );
}

// ─── AssemblyCard ─────────────────────────────────────────────────────────────

function AssemblyCard({ assembly, isActive }: { assembly: AssemblySummary; isActive: boolean }) {
  const statusConfig = getStatusConfig(assembly.status);

  return (
    <Link
      to={`/asambleas/${assembly.id}`}
      style={{ textDecoration: "none" }}
    >
      <div
        className="card-base"
        style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          cursor: "pointer",
          transition: "border-color 150ms ease, box-shadow 150ms ease",
          borderColor: isActive ? "var(--primary)" : undefined,
          opacity: assembly.status === "archived" ? 0.7 : 1
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--primary)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = isActive ? "var(--primary)" : "var(--border)";
        }}
      >
        {/* Status indicator */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: statusConfig.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: statusConfig.color,
            flexShrink: 0
          }}
        >
          {statusConfig.icon}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {assembly.title}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                borderRadius: 20,
                fontSize: 10,
                fontWeight: 500,
                backgroundColor: statusConfig.bg,
                color: statusConfig.color,
                flexShrink: 0
              }}
            >
              {statusConfig.icon}
              {statusConfig.label}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "var(--text-secondary)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar size={10} />
              {formatDate(assembly.scheduledAt)}
            </span>
            <span>·</span>
            <span style={{ textTransform: "capitalize" }}>{assembly.type.replace(/_/g, " ")}</span>
            <span>·</span>
            <span style={{ textTransform: "capitalize" }}>{assembly.modality}</span>
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight size={16} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
      </div>
    </Link>
  );
}
