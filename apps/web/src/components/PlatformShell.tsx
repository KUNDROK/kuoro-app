import { Link, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun, LogOut, Sparkles } from "lucide-react";
import type { AuthResponse, PropertySummary } from "@kuoro/contracts";
import { clearStoredToken } from "../lib/api";
import { AdminAssistantDrawer, type AdminAssistantScope } from "./AdminAssistantDrawer";

// ─── Types ────────────────────────────────────────────────────────────────────

type PlatformSection =
  | "dashboard"
  | "property"
  | "units"
  | "assemblies"
  | "communications"
  | "reports"
  | "settings";

type Props = {
  activeSection: PlatformSection;
  admin: AuthResponse["admin"] | null;
  assistantContext?: AssistantContext;
  /** IDs de copropiedad/asamblea activos en la pantalla (mejoran consultas del asistente). */
  assistantScope?: AdminAssistantScope;
  children: ReactNode;
  notificationCount?: number;
  property: PropertySummary | null;
  title?: string;
};

type AssistantContext = {
  headline?: string;
  facts?: string[];
  suggestions?: string[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const THEME_KEY = "quorum_theme";

const NAV_GROUPS = [
  {
    label: "Principal",
    items: [
      { id: "dashboard" as PlatformSection, label: "Panel de control", getTo: () => "/dashboard" },
      {
        id: "property" as PlatformSection,
        label: "Copropiedad",
        getTo: (property: PropertySummary | null) =>
          property ? "/copropiedad" : "/crear-copropiedad"
      },
      {
        id: "units" as PlatformSection,
        label: "Unidades y propietarios",
        getTo: (property: PropertySummary | null) =>
          property ? `/unidades?propertyId=${property.id}` : "/crear-copropiedad"
      }
    ]
  },
  {
    label: "Operación",
    items: [
      { id: "assemblies" as PlatformSection, label: "Asambleas", getTo: () => "/asambleas" },
      { id: "communications" as PlatformSection, label: "Comunicaciones", getTo: () => "/comunicaciones" },
      { id: "reports" as PlatformSection, label: "Reportes", getTo: () => "/reportes" },
      { id: "settings" as PlatformSection, label: "Configuración", getTo: () => "/configuracion" }
    ]
  }
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string | undefined) {
  if (!name) return "A";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PlatformShell({
  activeSection,
  admin,
  assistantContext,
  assistantScope,
  children,
  notificationCount = 0,
  property,
  title
}: Props) {
  const location = useLocation();

  const [assistantOpen, setAssistantOpen] = useState(false);

  const resolvedAssistantScope = useMemo((): AdminAssistantScope | undefined => {
    const propertyId = assistantScope?.propertyId ?? property?.id;
    const assemblyId = assistantScope?.assemblyId;
    if (!propertyId && !assemblyId) return undefined;
    return { propertyId, assemblyId };
  }, [assistantScope?.propertyId, assistantScope?.assemblyId, property?.id]);

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = window.localStorage.getItem(THEME_KEY);
    return stored === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const handleLogout = () => {
    clearStoredToken();
    window.location.href = "/login-admin";
  };

  const initials = getInitials(admin?.fullName);
  const pageTitle = title ?? "Panel de control";
  const propertyName = property?.name ?? "Sin copropiedad";

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--background)" }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          position: "fixed",
          inset: "0 auto 0 0",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--sidebar)",
          borderRight: "0.5px solid var(--sidebar-border)",
          zIndex: 40
        }}
      >
        {/* Brand */}
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            {/* Geometric Q mark */}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                backgroundColor: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="2" width="10" height="10" rx="2.5" stroke="white" strokeWidth="1.5" />
                <path d="M8 9l2 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--sidebar-foreground)",
                letterSpacing: "-0.01em"
              }}
            >
              Kuoro
            </span>
          </div>

          {/* Active property pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              backgroundColor: "var(--sidebar-accent)",
              borderRadius: 20,
              padding: "6px 10px",
              marginBottom: 20
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: "var(--sidebar-primary)",
                flexShrink: 0
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "var(--sidebar-accent-foreground)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              {propertyName}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: "0 8px", overflowY: "auto" }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: 20 }}>
              <span
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: "0.06em",
                  color: "var(--sidebar-muted-foreground)",
                  padding: "0 8px",
                  marginBottom: 4,
                  textTransform: "uppercase"
                }}
              >
                {group.label}
              </span>

              {group.items.map((item) => {
                const isActive = item.id === activeSection;
                return (
                  <Link
                    key={item.id}
                    to={item.getTo(property)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "7px 8px",
                      borderRadius: 6,
                      marginBottom: 1,
                      fontSize: 13,
                      fontWeight: isActive ? 500 : 400,
                      color: isActive
                        ? "var(--sidebar-accent-foreground)"
                        : "var(--sidebar-muted-foreground)",
                      backgroundColor: isActive ? "var(--sidebar-accent)" : "transparent",
                      textDecoration: "none",
                      transition: "background-color 150ms ease, color 150ms ease"
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          "var(--muted)";
                        (e.currentTarget as HTMLElement).style.color =
                          "var(--sidebar-foreground)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                        (e.currentTarget as HTMLElement).style.color =
                          "var(--sidebar-muted-foreground)";
                      }
                    }}
                  >
                    {/* 5px dot marker */}
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        backgroundColor: isActive
                          ? "var(--sidebar-primary)"
                          : "var(--sidebar-muted-foreground)",
                        flexShrink: 0,
                        opacity: isActive ? 1 : 0.4,
                        transition: "background-color 150ms ease, opacity 150ms ease"
                      }}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "0.5px solid var(--sidebar-border)",
            display: "flex",
            alignItems: "center",
            gap: 10
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              backgroundColor: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 600,
              color: "#FFFFFF",
              letterSpacing: "0.02em"
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--sidebar-foreground)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              {admin?.fullName ?? "Administrador"}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--sidebar-muted-foreground)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              {admin?.email ?? ""}
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              borderRadius: 6,
              border: "none",
              backgroundColor: "transparent",
              color: "var(--sidebar-muted-foreground)",
              cursor: "pointer",
              flexShrink: 0,
              transition: "background-color 150ms ease, color 150ms ease"
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "var(--danger-surface)";
              (e.currentTarget as HTMLElement).style.color = "var(--danger)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--sidebar-muted-foreground)";
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, marginLeft: 220, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Topbar */}
        <header
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 28px",
            backgroundColor: "var(--card)",
            borderBottom: "0.5px solid var(--border)",
            position: "sticky",
            top: 0,
            zIndex: 30
          }}
        >
          {/* Left: title + property */}
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "var(--foreground)",
                lineHeight: 1.3
              }}
            >
              {pageTitle}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                lineHeight: 1.3
              }}
            >
              {propertyName}
            </div>
          </div>

          {/* Right: Kuoro IA pill + theme toggle + avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

            {/* Notification badge */}
            {notificationCount > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  backgroundColor: "var(--warning-surface)",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--warning)"
                }}
              >
                {notificationCount} pendiente{notificationCount !== 1 ? "s" : ""}
              </div>
            )}

            {/* Kuoro IA — abre asistente */}
            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                backgroundColor: "var(--accent)",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 500,
                color: "var(--accent-foreground)",
                border: "0.5px solid var(--border)",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <Sparkles size={11} />
              Kuoro IA
            </button>

            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 7,
                border: "0.5px solid var(--border)",
                backgroundColor: "var(--card)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                transition: "background-color 150ms ease"
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "var(--card)";
              }}
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {/* User avatar */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                backgroundColor: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 600,
                color: "#FFFFFF",
                flexShrink: 0,
                letterSpacing: "0.02em"
              }}
            >
              {initials}
            </div>
          </div>
        </header>

        {/* Page content with Framer Motion transition */}
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ flex: 1, padding: 28 }}
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>

      <AdminAssistantDrawer
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        scope={resolvedAssistantScope}
        starterSuggestions={assistantContext?.suggestions}
      />
    </div>
  );
}
