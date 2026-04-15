import { useEffect, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, Radio, Users, FileCheck, Clock } from "lucide-react";
import type { AssemblyOverview, AuthResponse, PropertySummary } from "@kuoro/contracts";
import { PlatformShell } from "../components/PlatformShell";
import { VotingAttendeePanel } from "../components/voting/VotingAttendeePanel";
import { fetchAssembly, fetchMe, getStoredToken } from "../lib/api";

function getUnitStatusLabel(status: AssemblyOverview["units"][number]["status"]) {
  if (status === "proxy_approved") return "representada por apoderado";
  if (status === "owner_ready") return "lista con propietario";
  if (status === "proxy_pending") return "poder pendiente";
  return "sin votante habilitado";
}

function getUnitStatusStyle(status: AssemblyOverview["units"][number]["status"]): React.CSSProperties {
  if (status === "proxy_approved" || status === "owner_ready")
    return {
      backgroundColor: "var(--success-surface)",
      color: "var(--success)",
      border: "0.5px solid var(--success)"
    };
  if (status === "proxy_pending")
    return {
      backgroundColor: "var(--warning-surface)",
      color: "var(--warning)",
      border: "0.5px solid var(--warning)"
    };
  return {
    backgroundColor: "var(--danger-surface)",
    color: "var(--danger)",
    border: "0.5px solid var(--danger)"
  };
}

export function AssemblyRoomPage() {
  const { assemblyId, propertyId: propertyIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get("token") ?? "";

  const [property, setProperty] = useState<PropertySummary | null>(null);
  const [admin, setAdmin] = useState<AuthResponse["admin"] | null>(null);
  const [assembly, setAssembly] = useState<AssemblyOverview | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMe()
      .then(async (data) => {
        const primaryProperty = data.properties.find(p => p.id === propertyIdParam) ?? data.properties[0] ?? null;
        setProperty(primaryProperty);
        setAdmin(data.admin);

        if (!primaryProperty || !assemblyId) return;

        const response = await fetchAssembly(primaryProperty.id, assemblyId);
        setAssembly(response.assembly);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "No fue posible cargar la sala de asamblea");
      })
      .finally(() => setIsLoading(false));
  }, [assemblyId, propertyIdParam]);

  if (!getStoredToken()) return <Navigate to="/login-admin" replace />;

  const activePoint =
    assembly?.agenda.find((item) => item.status === "active") ??
    assembly?.agenda[0] ??
    null;

  const quorumPct = Math.min(assembly?.quorum ?? 0, 100);

  return (
    <PlatformShell
      activeSection="assemblies"
      admin={admin}
      property={property}
      title="Sala en vivo"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Panel de votación digital para asistentes (con accessToken en URL) */}
        {accessToken && property && assemblyId && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <VotingAttendeePanel
              propertyId={property.id}
              assemblyId={assemblyId}
              accessToken={accessToken}
            />
          </motion.div>
        )}

        {/* Status bar */}
        <motion.div
          className="card-base"
          style={{ padding: "14px 20px" }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 12px",
                  backgroundColor: "var(--success-surface)",
                  borderRadius: 20,
                  border: "0.5px solid var(--success)"
                }}
              >
                <Radio size={11} style={{ color: "var(--success)" }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--success)" }}>
                  Sesión en curso
                </span>
              </div>
              <h1
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  color: "var(--foreground)",
                  margin: 0,
                  letterSpacing: "-0.01em"
                }}
              >
                {assembly?.propertyName ?? property?.name ?? "Cargando..."}
              </h1>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  padding: "4px 12px",
                  backgroundColor: quorumPct >= 50 ? "var(--success-surface)" : "var(--warning-surface)",
                  color: quorumPct >= 50 ? "var(--success)" : "var(--warning)",
                  border: `0.5px solid ${quorumPct >= 50 ? "var(--success)" : "var(--warning)"}`,
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 500
                }}
              >
                Quórum {quorumPct}%
              </div>
              <Link
                to="/dashboard"
                style={{
                  padding: "5px 12px",
                  backgroundColor: "var(--secondary)",
                  color: "var(--secondary-foreground)",
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 500,
                  textDecoration: "none"
                }}
              >
                Dashboard
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <div
            className="card-base"
            style={{
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              backgroundColor: "var(--danger-surface)",
              borderColor: "var(--danger)"
            }}
          >
            <AlertCircle size={13} style={{ color: "var(--danger)" }} />
            <span style={{ fontSize: 12, color: "var(--danger)" }}>{error}</span>
          </div>
        )}

        {isLoading && (
          <div className="card-base" style={{ padding: 40, textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Cargando sala de asamblea...</p>
          </div>
        )}

        {assembly && (
          <>
            {/* KPI strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[
                {
                  icon: <Users size={14} style={{ color: "var(--primary)" }} />,
                  label: "Unidades representadas",
                  value: assembly.totalUnitsRepresented
                },
                {
                  icon: <FileCheck size={14} style={{ color: "var(--primary)" }} />,
                  label: "Votantes habilitados",
                  value: assembly.eligibleVoters
                },
                {
                  icon: <Clock size={14} style={{ color: "var(--warning)" }} />,
                  label: "Poderes pendientes",
                  value: assembly.pendingProxyUnits,
                  warn: assembly.pendingProxyUnits > 0
                }
              ].map((kpi, i) => (
                <motion.div
                  key={kpi.label}
                  className="card-base"
                  style={{
                    padding: "14px 16px",
                    borderColor: kpi.warn ? "var(--warning)" : undefined,
                    backgroundColor: kpi.warn ? "var(--warning-surface)" : undefined
                  }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.05 }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 8
                    }}
                  >
                    {kpi.icon}
                    <span
                      className="text-label"
                      style={{ color: kpi.warn ? "var(--warning)" : undefined }}
                    >
                      {kpi.label}
                    </span>
                  </div>
                  <span
                    className="text-metric"
                    style={{ color: kpi.warn ? "var(--warning)" : undefined }}
                  >
                    {kpi.value}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Main 2-col layout */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12 }}>
              {/* Left: live slide + agenda */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Active slide */}
                <motion.div
                  className="card-base"
                  style={{ padding: 24 }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 16
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "3px 10px",
                        backgroundColor: "var(--success-surface)",
                        borderRadius: 20,
                        border: "0.5px solid var(--success)"
                      }}
                    >
                      <Radio size={10} style={{ color: "var(--success)" }} />
                      <span style={{ fontSize: 10, fontWeight: 500, color: "var(--success)" }}>
                        En pantalla
                      </span>
                    </div>
                    <h2
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--foreground)",
                        margin: 0
                      }}
                    >
                      Presentación en vivo
                    </h2>
                  </div>

                  {activePoint ? (
                    <div>
                      <h3
                        style={{
                          fontSize: 20,
                          fontWeight: 500,
                          letterSpacing: "-0.02em",
                          color: "var(--foreground)",
                          margin: "0 0 12px"
                        }}
                      >
                        {activePoint.slideTitle ?? activePoint.title}
                      </h3>
                      {(activePoint.slideContent ?? activePoint.description) && (
                        <p
                          style={{
                            fontSize: 13,
                            color: "var(--text-secondary)",
                            lineHeight: 1.6,
                            margin: "0 0 12px"
                          }}
                        >
                          {activePoint.slideContent ?? activePoint.description}
                        </p>
                      )}
                      {activePoint.speakerNotes && (
                        <div
                          style={{
                            padding: "10px 14px",
                            backgroundColor: "var(--accent)",
                            borderRadius: 7,
                            marginBottom: 12
                          }}
                        >
                          <p
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color: "var(--accent-foreground)",
                              margin: "0 0 4px"
                            }}
                          >
                            Nota del presentador
                          </p>
                          <p
                            style={{
                              fontSize: 12,
                              color: "var(--accent-foreground)",
                              margin: 0,
                              lineHeight: 1.6
                            }}
                          >
                            {activePoint.speakerNotes}
                          </p>
                        </div>
                      )}
                      {activePoint.votePrompt && (
                        <div
                          style={{
                            padding: "10px 14px",
                            backgroundColor: "var(--warning-surface)",
                            borderRadius: 7,
                            border: "0.5px solid var(--warning)",
                            marginBottom: 12
                          }}
                        >
                          <p
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color: "var(--warning)",
                              margin: "0 0 4px"
                            }}
                          >
                            Pregunta de votación
                          </p>
                          <p
                            style={{
                              fontSize: 12,
                              color: "var(--warning)",
                              margin: 0
                            }}
                          >
                            {activePoint.votePrompt}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      Sin diapositiva activa
                    </p>
                  )}

                  {/* Quórum bar */}
                  <div style={{ marginTop: 20 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6
                      }}
                    >
                      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        Quórum actual
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: "var(--foreground)" }}>
                        {quorumPct}%
                      </span>
                    </div>
                    <div
                      style={{
                        height: 2,
                        backgroundColor: "var(--border)",
                        borderRadius: 2,
                        overflow: "hidden"
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${quorumPct}%`,
                          backgroundColor: quorumPct >= 50 ? "var(--success)" : "var(--warning)",
                          borderRadius: 2,
                          transition: "width 0.3s ease"
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                    <button
                      type="button"
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "var(--primary)",
                        color: "#FFFFFF",
                        borderRadius: 7,
                        fontSize: 12,
                        fontWeight: 500,
                        border: "none",
                        cursor: "pointer"
                      }}
                    >
                      {activePoint?.votingRule && activePoint.votingRule !== "ninguna"
                        ? "Abrir votación"
                        : "Continuar presentación"}
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "var(--secondary)",
                        color: "var(--secondary-foreground)",
                        borderRadius: 7,
                        fontSize: 12,
                        fontWeight: 500,
                        border: "0.5px solid var(--border)",
                        cursor: "pointer"
                      }}
                    >
                      Publicar resultado
                    </button>
                  </div>
                </motion.div>

                {/* Agenda list */}
                <motion.div
                  className="card-base"
                  style={{ padding: 20 }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.15 }}
                >
                  <h3
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--foreground)",
                      margin: "0 0 14px"
                    }}
                  >
                    Presentación de la asamblea
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {assembly.agenda.map((item, i) => {
                      const isActive = item.status === "active";
                      return (
                        <div
                          key={item.id}
                          style={{
                            display: "flex",
                            gap: 12,
                            padding: "10px 12px",
                            borderRadius: 7,
                            border: `0.5px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
                            backgroundColor: isActive ? "var(--accent)" : "transparent"
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color: isActive ? "var(--primary)" : "var(--text-tertiary)",
                              minWidth: 18,
                              paddingTop: 1
                            }}
                          >
                            {i + 1}.
                          </span>
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 8
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 500,
                                  color: isActive ? "var(--accent-foreground)" : "var(--foreground)"
                                }}
                              >
                                {item.slideTitle ?? item.title}
                              </span>
                              {isActive && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 500,
                                    color: "var(--primary)",
                                    backgroundColor: "var(--success-surface)",
                                    padding: "2px 8px",
                                    borderRadius: 20
                                  }}
                                >
                                  en pantalla
                                </span>
                              )}
                            </div>
                            {(item.slideContent ?? item.description) && (
                              <p
                                style={{
                                  fontSize: 11,
                                  color: "var(--text-secondary)",
                                  margin: "4px 0 0",
                                  lineHeight: 1.5
                                }}
                              >
                                {item.slideContent ?? item.description}
                              </p>
                            )}
                            {item.votingRule !== "ninguna" && (
                              <span
                                style={{
                                  display: "inline-block",
                                  marginTop: 4,
                                  fontSize: 10,
                                  color: "var(--warning)",
                                  backgroundColor: "var(--warning-surface)",
                                  padding: "2px 8px",
                                  borderRadius: 20
                                }}
                              >
                                Votación: {item.votingRule}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              </div>

              {/* Right: unit representation */}
              <motion.div
                className="card-base"
                style={{ padding: 20, alignSelf: "flex-start" }}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: 0.12 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 14
                  }}
                >
                  <h3
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--foreground)",
                      margin: 0
                    }}
                  >
                    Representación por unidad
                  </h3>
                  {assembly.pendingProxyUnits > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        color: "var(--warning)",
                        backgroundColor: "var(--warning-surface)",
                        padding: "2px 8px",
                        borderRadius: 20,
                        border: "0.5px solid var(--warning)"
                      }}
                    >
                      {assembly.pendingProxyUnits} pendientes
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {assembly.units.map((unit) => (
                    <div
                      key={unit.unitId}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 7,
                        border: "0.5px solid var(--border)"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          marginBottom: unit.representatives.length ? 8 : 0
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: "var(--foreground)"
                          }}
                        >
                          {unit.unitLabel}
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 500,
                            padding: "2px 7px",
                            borderRadius: 20,
                            whiteSpace: "nowrap",
                            ...getUnitStatusStyle(unit.status)
                          }}
                        >
                          {getUnitStatusLabel(unit.status)}
                        </span>
                      </div>

                      {unit.representatives.length > 0 && (
                        <div
                          style={{ display: "flex", flexDirection: "column", gap: 4 }}
                        >
                          {unit.representatives.map((rep) => (
                            <div
                              key={rep.ownerId}
                              style={{
                                padding: "6px 8px",
                                backgroundColor: "var(--canvas)",
                                borderRadius: 5,
                                border: "0.5px solid var(--border)"
                              }}
                            >
                              <p
                                style={{
                                  fontSize: 11,
                                  fontWeight: 500,
                                  color: "var(--foreground)",
                                  margin: "0 0 2px"
                                }}
                              >
                                {rep.fullName}
                              </p>
                              <p
                                style={{
                                  fontSize: 10,
                                  color: "var(--text-tertiary)",
                                  margin: 0
                                }}
                              >
                                {rep.participationRole}
                                {rep.canVote ? " · puede votar" : " · sin voto"}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {unit.representatives.length === 0 && (
                        <p
                          style={{
                            fontSize: 11,
                            color: "var(--text-tertiary)",
                            margin: 0
                          }}
                        >
                          Sin representantes configurados
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </PlatformShell>
  );
}
