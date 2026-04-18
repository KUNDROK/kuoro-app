import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { AuthResponse, PropertySummary } from "@kuoro/contracts";
import { PlatformShell } from "../components/PlatformShell";
import { fetchMe, getStoredToken } from "../lib/api";

function formatBoolean(value: boolean | undefined) {
  return value ? "Activo" : "Inactivo";
}

function formatList(values: string[] | undefined) {
  return values?.length ? values.join(", ") : "Sin definir";
}

export function PropertyOverviewPage() {
  const [admin, setAdmin] = useState<AuthResponse["admin"] | null>(null);
  const [property, setProperty] = useState<PropertySummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMe()
      .then((data) => {
        setAdmin(data.admin);
        setProperty(data.properties[0] ?? null);
      })
      .catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : "No fue posible cargar la copropiedad");
      });
  }, []);

  if (!getStoredToken()) {
    return <Navigate to="/login-admin" replace />;
  }

  const hasProperty = Boolean(property);
  const structureModes = property?.structureModes ?? [];
  const completionItems = [
    hasProperty,
    Boolean(property?.nit),
    Boolean(property?.address && property.city),
    structureModes.length > 0,
    Boolean(property?.usesCoefficients || property?.usesContributionModules || property?.supportsProxies)
  ];
  const completedItems = completionItems.filter(Boolean).length;
  const completionPercentage = Math.round((completedItems / completionItems.length) * 100);

  const operationalRules = [
    { label: "Coeficientes", value: formatBoolean(property?.usesCoefficients), detail: "Base para quorum, participación y ponderación." },
    { label: "Módulos de contribución", value: formatBoolean(property?.usesContributionModules), detail: "Permite manejar reglas por grupos o destinaciones." },
    { label: "Poderes en asamblea", value: formatBoolean(property?.supportsProxies), detail: "Habilita representación y validación de apoderados." },
    { label: "Estructura interna", value: formatList(structureModes), detail: "Define cómo se organizan unidades y agrupaciones." }
  ];

  const kpiCards = [
    { label: "Unidades", value: property?.totalUnits ?? 0, sub: "Base registrada" },
    { label: "Estructura", value: structureModes.length || 0, sub: formatList(structureModes) },
    { label: "Alistamiento", value: `${completionPercentage}%`, sub: `${completedItems}/${completionItems.length} datos clave` },
    { label: "Reglas activas", value: operationalRules.filter((r) => r.value === "Activo").length, sub: "Configuraciones" }
  ];

  return (
    <PlatformShell
      activeSection="property"
      admin={admin}
      assistantScope={property ? { propertyId: property.id } : undefined}
      property={property}
      title="Copropiedad"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header card */}
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
                  backgroundColor: hasProperty ? "var(--success-surface)" : "var(--danger-surface)",
                  color: hasProperty ? "var(--success)" : "var(--danger)"
                }}
              >
                {hasProperty ? "Base creada" : "Pendiente"}
              </span>
              <span className="text-label" style={{ display: "block", marginBottom: 6 }}>
                Datos y estructura
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
                {property?.name ?? "Configura la copropiedad"}
              </h1>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
                Datos legales, ubicación, estructura física y reglas operativas.
              </p>
              {error && (
                <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>{error}</p>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <Link
                to={hasProperty ? "/editar-copropiedad" : "/crear-copropiedad"}
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
                {hasProperty ? "Editar estructura" : "Crear copropiedad"}
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

        {/* Detail layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12 }}>
          {/* Legal data */}
          <div className="card-base" style={{ padding: 24 }}>
            <h2 className="text-subtitle" style={{ marginBottom: 20 }}>Ficha de la copropiedad</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
              {[
                { label: "Nombre", value: property?.name ?? "Sin registrar" },
                { label: "NIT", value: property?.nit ?? "No registrado" },
                { label: "Ciudad", value: property?.city ?? "Sin registrar" },
                { label: "Dirección", value: property?.address ?? "Sin registrar" },
                { label: "Tipo legal", value: property?.legalType ?? "Sin definir" },
                { label: "Forma física", value: property?.developmentShape ?? "Sin definir" }
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: "12px 0", borderBottom: "0.5px solid var(--border)" }}>
                  <div className="text-label" style={{ marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Operational rules */}
          <div className="card-base" style={{ padding: 24 }}>
            <h2 className="text-subtitle" style={{ marginBottom: 4 }}>Reglas operativas</h2>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
              Configuración que impacta quorum, cobros y representación.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {operationalRules.map((rule) => {
                const isActive = rule.value === "Activo";
                return (
                  <div
                    key={rule.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: 7,
                      backgroundColor: "var(--muted)"
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
                        {rule.label}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                        {rule.detail}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        padding: "2px 8px",
                        borderRadius: 20,
                        backgroundColor: isActive ? "var(--success-surface)" : "var(--muted)",
                        color: isActive ? "var(--success)" : "var(--text-tertiary)",
                        flexShrink: 0,
                        marginLeft: 12
                      }}
                    >
                      {rule.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </PlatformShell>
  );
}
