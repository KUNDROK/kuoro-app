import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Moon, Mail, Shield, CreditCard, Link2 } from "lucide-react";
import type { AuthResponse, PropertySummary } from "@kuoro/contracts";
import { PlatformShell } from "../components/PlatformShell";
import { fetchMe, getStoredToken } from "../lib/api";

const preferenceGroups = [
  {
    Icon: Moon,
    title: "Apariencia",
    detail: "Preferencias visuales que no cambian la operación.",
    items: ["Tema claro u oscuro", "Densidad de información", "Inicio en panel de control"]
  },
  {
    Icon: Mail,
    title: "Notificaciones",
    detail: "Avisos personales del administrador.",
    items: ["Poderes pendientes", "Asamblea próxima", "Alertas críticas del dashboard"]
  },
  {
    Icon: Shield,
    title: "Seguridad",
    detail: "Controles de acceso de la cuenta.",
    items: ["Cambio de contraseña", "Sesiones activas", "Verificación en dos pasos"]
  },
  {
    Icon: CreditCard,
    title: "Facturación y plan",
    detail: "Base futura para convertir el producto en SaaS.",
    items: ["Plan actual", "Datos de facturación", "Historial de pagos"]
  },
  {
    Icon: Link2,
    title: "Integraciones",
    detail: "Conexiones externas sin mezclar reglas de negocio.",
    items: ["Correo saliente", "WhatsApp", "Firma digital"]
  }
];

function getInitials(name: string | undefined) {
  if (!name) return "A";
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function SettingsPage() {
  const [admin, setAdmin] = useState<AuthResponse["admin"] | null>(null);
  const [property, setProperty] = useState<PropertySummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMe()
      .then((data) => {
        setAdmin(data.admin);
        setProperty(data.properties[0] ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No fue posible cargar configuración"));
  }, []);

  if (!getStoredToken()) return <Navigate to="/login-admin" replace />;

  const readyGroups = preferenceGroups.length;
  const plannedOptions = preferenceGroups.reduce((t, g) => t + g.items.length, 0);

  const kpiCards = [
    { label: "Cuenta", value: admin?.emailVerified ? "OK" : "Pendiente", sub: admin?.emailVerified ? "Correo verificado" : "Correo por verificar" },
    { label: "Preferencias", value: readyGroups, sub: "Grupos preparados" },
    { label: "Opciones", value: plannedOptions, sub: "Activables por iteración" },
    { label: "Zona horaria", value: "GMT-5", sub: "Colombia" }
  ];

  return (
    <PlatformShell activeSection="settings" admin={admin} property={property} title="Configuración">
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
                Perfil activo
              </span>
              <span className="text-label" style={{ display: "block", marginBottom: 6 }}>
                Cuenta y preferencias
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
                Configuración
              </h1>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
                Ajustes personales, seguridad e integraciones. Las reglas operativas viven en sus secciones principales.
              </p>
              {error && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>{error}</p>}
            </div>

            {/* Profile chip */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderRadius: 10,
                border: "0.5px solid var(--border)",
                flexShrink: 0
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  backgroundColor: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--accent-foreground)"
                }}
              >
                {getInitials(admin?.fullName)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>
                  {admin?.fullName ?? "Administrador"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                  {admin?.email ?? "Cuenta activa"}
                </div>
              </div>
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

        {/* Account + boundary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 12 }}>
          <div className="card-base" style={{ padding: 24 }}>
            <h2 className="text-subtitle" style={{ marginBottom: 16 }}>Mi cuenta</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                { label: "Nombre", value: admin?.fullName ?? "Sin nombre" },
                { label: "Correo", value: admin?.email ?? "Sin correo" },
                { label: "Teléfono", value: admin?.phone ?? "Sin teléfono" }
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: 7,
                    backgroundColor: "var(--muted)"
                  }}
                >
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>{value}</span>
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px"
                }}
              >
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 500,
                    backgroundColor: admin?.emailVerified ? "var(--success-surface)" : "var(--warning-surface)",
                    color: admin?.emailVerified ? "var(--success)" : "var(--warning)"
                  }}
                >
                  {admin?.emailVerified ? "correo verificado" : "correo por verificar"}
                </span>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 500,
                    backgroundColor: "var(--muted)",
                    color: "var(--text-tertiary)"
                  }}
                >
                  Colombia GMT-5
                </span>
              </div>
            </div>
          </div>

          <div className="card-base" style={{ padding: 24 }}>
            <h2 className="text-subtitle" style={{ marginBottom: 8 }}>Separación clara</h2>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
              Configuración solo controla preferencias transversales.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                { label: "Reglas de negocio", value: "Fuera de configuración" },
                { label: "Preferencias personales", value: "Aquí" },
                { label: "Integraciones técnicas", value: "Aquí" }
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: 7,
                    backgroundColor: "var(--muted)"
                  }}
                >
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Preferences grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {preferenceGroups.map((group, i) => {
            const { Icon } = group;
            return (
              <motion.div
                key={group.title}
                className="card-base"
                style={{ padding: 20 }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Icon size={14} style={{ color: "var(--primary)" }} />
                  <h2 className="text-subtitle">{group.title}</h2>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>
                  {group.detail}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {group.items.map((item) => (
                    <div
                      key={item}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        borderRadius: 7,
                        backgroundColor: "var(--muted)"
                      }}
                    >
                      <div className="nav-dot" style={{ backgroundColor: "var(--primary)", opacity: 0.4 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
                          {item}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 1 }}>
                          Próxima iteración
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </PlatformShell>
  );
}
