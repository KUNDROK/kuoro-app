import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, ChevronRight } from "lucide-react";
import type { AuthResponse, PropertySummary, UnitSummary } from "@kuoro/contracts";
import { Input } from "@/components/ui/input";
import { PlatformShell } from "../components/PlatformShell";
import { fetchMe, fetchUnits, getStoredToken } from "../lib/api";
import { formatUnitLabel } from "../lib/unitLabels";
import { SkeletonRow, SkeletonCard } from "../components/ui/skeleton";
import { cacheHas } from "../lib/cache";
import { LoadingModal } from "../components/ui/loading";

function getUnitHealth(unit: UnitSummary) {
  const hasApprovedProxy = unit.owners.some(
    (o) => o.participationRole === "apoderado" && o.proxyApprovalStatus === "approved" && o.canVote
  );
  const hasPendingProxy = unit.owners.some(
    (o) =>
      o.participationRole === "apoderado" &&
      ["awaiting_upload", "pending_review", "rejected"].includes(o.proxyApprovalStatus ?? "awaiting_upload")
  );
  const hasVoter = unit.owners.some((o) => o.canVote);
  const hasInvitationRecipient = unit.owners.some((o) => o.receivesInvitations);

  if (!hasVoter) {
    return { label: "sin votante", status: "no_voter", bg: "var(--danger-surface)", color: "var(--danger)" };
  }
  if (hasPendingProxy) {
    return { label: "poder pendiente", status: "proxy_pending", bg: "var(--warning-surface)", color: "var(--warning)" };
  }
  if (!hasInvitationRecipient) {
    return { label: "sin destinatario", status: "missing_recipient", bg: "var(--warning-surface)", color: "var(--warning)" };
  }
  if (hasApprovedProxy) {
    return { label: "por apoderado", status: "proxy_approved", bg: "var(--success-surface)", color: "var(--success)" };
  }
  return { label: "propietario listo", status: "owner_ready", bg: "var(--success-surface)", color: "var(--success)" };
}

export function UnitsListPage() {
  const [searchParams] = useSearchParams();
  const [admin, setAdmin] = useState<AuthResponse["admin"] | null>(null);
  const [property, setProperty] = useState<PropertySummary | null>(null);
  const [units, setUnits] = useState<UnitSummary[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  // No overlay if we already have cached units for this property
  const [isLoading, setIsLoading] = useState(() => {
    const pid = new URLSearchParams(window.location.search).get("propertyId");
    return pid ? !cacheHas(`/properties/${pid}/units`) : !cacheHas("/auth/me");
  });

  useEffect(() => {
    const propertyIdFromQuery = searchParams.get("propertyId");
    setIsLoading(true);

    // Fire both requests in parallel when propertyId is already in the URL
    const mePromise = fetchMe();
    const unitsPromise = propertyIdFromQuery ? fetchUnits(propertyIdFromQuery) : null;

    mePromise
      .then(async (data) => {
        setAdmin(data.admin);
        const selected = data.properties.find((p) => p.id === propertyIdFromQuery) ?? data.properties[0];
        if (!selected) { setIsLoading(false); return; }
        setProperty(selected);
        // Use parallel result if available, otherwise fetch now
        const response = unitsPromise ? await unitsPromise : await fetchUnits(selected.id);
        setUnits(response.units);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No fue posible cargar las unidades"))
      .finally(() => setIsLoading(false));
  }, [searchParams]);

  const filteredUnits = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const statusFilter = searchParams.get("status");
    const unitIdFilter = new Set(
      (searchParams.get("unitIds") ?? "").split(",").map((id) => id.trim()).filter(Boolean)
    );

    return units.filter((unit) => {
      if (unitIdFilter.size > 0 && !unitIdFilter.has(unit.id)) return false;
      if (statusFilter && getUnitHealth(unit).status !== statusFilter) return false;
      if (!normalized) return true;
      return [
        unit.groupingLabel,
        unit.unitNumber,
        unit.unitType,
        unit.primaryOwner?.fullName ?? "",
        unit.primaryOwner?.email ?? "",
        unit.primaryOwner?.document ?? "",
        ...unit.owners.map((o) => o.fullName),
        ...unit.owners.map((o) => o.email ?? ""),
        ...unit.owners.map((o) => o.document ?? "")
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [query, searchParams, units]);

  const healthyUnits = filteredUnits.filter((u) => getUnitHealth(u).color === "var(--success)").length;
  const warningUnits = filteredUnits.filter((u) => getUnitHealth(u).color === "var(--warning)").length;
  const blockedUnits = filteredUnits.filter((u) => getUnitHealth(u).color === "var(--danger)").length;
  const voters = filteredUnits.reduce((t, u) => t + u.owners.filter((o) => o.canVote).length, 0);
  const invitationReady = filteredUnits.filter((u) => u.owners.some((o) => o.receivesInvitations)).length;
  const statusFilter = searchParams.get("status");
  const filterLabel = searchParams.get("filterLabel") ?? "";
  const activeStatusLabel =
    filterLabel ||
    (statusFilter === "no_voter"
      ? "sin votante habilitado"
      : statusFilter === "proxy_pending"
        ? "pendiente por poder"
        : statusFilter === "missing_recipient"
          ? "sin destinatario"
          : "");

  if (!getStoredToken()) return <Navigate to="/login-admin" replace />;

  const kpiCards = [
    { label: "Resultados", value: filteredUnits.length, sub: `${units.length} unidades registradas` },
    { label: "Listas", value: healthyUnits, sub: "Con votante o representación" },
    { label: "Con atención", value: warningUnits + blockedUnits, sub: `${blockedUnits} bloqueos, ${warningUnits} alertas` },
    { label: "Votantes", value: voters, sub: `${invitationReady} con destinatario` }
  ];

  return (
    <PlatformShell
      activeSection="units"
      admin={admin}
      assistantScope={property ? { propertyId: property.id } : undefined}
      property={property}
      title="Unidades y propietarios"
    >
      <LoadingModal visible={isLoading && units.length === 0} message="Cargando unidades..." />
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
                  backgroundColor: "var(--success-surface)",
                  color: "var(--success)"
                }}
              >
                Base operativa
              </span>
              <span className="text-label" style={{ display: "block", marginBottom: 6 }}>
                Unidades y propietarios
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
                {property?.name ?? "Copropiedad"}
              </h1>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
                Consulta unidades registradas, titulares, apoderados, votantes y destinatarios de convocatoria.
              </p>
              {error && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>{error}</p>}
            </div>

            {property && (
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <Link
                  to={`/unidades-iniciales?propertyId=${property.id}`}
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
                  Agregar unidades
                </Link>
                <Link
                  to="/copropiedad"
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
                  Ver copropiedad
                </Link>
              </div>
            )}
          </div>
        </motion.div>

        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {isLoading && units.length === 0
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} rows={3} height={80} />)
            : kpiCards.map((kpi, i) => (
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
            ))
          }
        </div>

        {/* Units list */}
        <div className="card-base" style={{ padding: 24 }}>
          {/* Toolbar */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
            <div>
              <h2 className="text-subtitle">Base de unidades</h2>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                {activeStatusLabel
                  ? `Filtro activo: unidades ${activeStatusLabel}.`
                  : "Vista de seguimiento para revisar propietarios, poderes y convocatoria."}
              </p>
            </div>

            <div style={{ position: "relative", flexShrink: 0, width: 260 }}>
              <Search
                size={13}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-tertiary)"
                }}
              />
              <Input
                placeholder="Torre, número, propietario..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  paddingLeft: 30,
                  borderRadius: 7,
                  borderWidth: "0.5px",
                  fontSize: 12,
                  height: 34
                }}
              />
            </div>
          </div>

          {/* Skeleton rows while loading */}
          {isLoading && units.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={4} />)}
            </div>
          )}

          {/* Table header */}
          {!isLoading && filteredUnits.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 2fr 1.5fr 120px",
                gap: 12,
                padding: "6px 12px",
                marginBottom: 4
              }}
            >
              {["Unidad", "Representante", "Datos", "Estado"].map((h) => (
                <span key={h} className="text-label">{h}</span>
              ))}
            </div>
          )}

          {/* Rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filteredUnits.map((unit, i) => {
              const health = getUnitHealth(unit);
              const votersCount = unit.owners.filter((o) => o.canVote).length;
              const invLabel = unit.owners.some((o) => o.receivesInvitations)
                ? "convocatoria lista"
                : "sin destinatario";
              const unitMeta = [unit.unitType, unit.destination, unit.floor ? `Piso ${unit.floor}` : ""]
                .filter(Boolean)
                .join(" · ");

              return (
                <motion.div
                  key={unit.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, delay: i * 0.02 }}
                >
                  <Link
                    to={`/unidades/${unit.id}?propertyId=${unit.propertyId}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 2fr 1.5fr 120px",
                      gap: 12,
                      padding: "12px",
                      borderRadius: 7,
                      backgroundColor: "var(--muted)",
                      textDecoration: "none",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
                        {formatUnitLabel(unit)}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                        {unitMeta || "Sin detalle"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
                        {unit.primaryOwner?.fullName ?? "Sin titular principal"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                        {unit.primaryOwner?.email ?? unit.primaryOwner?.document ?? "Sin dato de contacto"}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        {unit.owners.length} personas · {votersCount} votantes
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{invLabel}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          padding: "2px 8px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 500,
                          backgroundColor: health.bg,
                          color: health.color
                        }}
                      >
                        {health.label}
                      </span>
                      <ChevronRight size={13} style={{ color: "var(--text-tertiary)" }} />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {/* Empty state */}
          {!filteredUnits.length && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 6 }}>
                {units.length === 0 ? "Sin unidades registradas" : "No hay unidades que coincidan"}
              </div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {units.length === 0
                  ? "Agrega unidades para activar este módulo."
                  : "Prueba con otro número, propietario, documento o correo."}
              </p>
            </div>
          )}
        </div>
      </div>
    </PlatformShell>
  );
}
