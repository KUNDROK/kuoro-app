import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { adminRegistrationDraft } from "../data/mock";
import { registerAdmin, setStoredToken } from "../lib/api";
import { planById, parseBillingCycle, type PlanId } from "../data/pricingPlans";

function isPlanId(s: string | null): s is PlanId {
  return s === "starter" || s === "professional" || s === "enterprise";
}

const steps = [
  "Creación persistente del perfil administrativo.",
  "Inicio de sesión directo al finalizar el registro.",
  "Alta de la primera copropiedad administrada.",
  "Carga inicial de unidades, propietarios y coeficientes."
];

export function AdminRegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get("plan");
  const plan = isPlanId(planParam) ? planById(planParam) : undefined;
  const cycle = parseBillingCycle(searchParams.get("cycle"));
  const cycleLabel = cycle === "annual" ? "facturación anual" : "facturación mensual";

  const [form, setForm] = useState(adminRegistrationDraft);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((c) => ({ ...c, [field]: e.target.value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await registerAdmin(form);
      setStoredToken(response.token);
      navigate("/crear-copropiedad");
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "No fue posible registrar el administrador"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--background)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}
    >
      {/* Brand */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="2" width="10" height="10" rx="2.5" stroke="white" strokeWidth="1.5" />
            <path d="M8 9l2 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <span style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.01em" }}>
          Kuoro
        </span>
      </motion.div>

      <div
        style={{
          width: "100%",
          maxWidth: 760,
          display: "grid",
          gridTemplateColumns: "1fr 280px",
          gap: 12,
          alignItems: "start"
        }}
      >
        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="card-base"
          style={{ padding: 28 }}
        >
          <div style={{ marginBottom: 24 }}>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 500,
                letterSpacing: "-0.02em",
                color: "var(--foreground)",
                margin: "0 0 6px"
              }}
            >
              Crear cuenta de administrador
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
              Desde aquí nace la copropiedad, la base de datos y la operación completa de la asamblea.
            </p>
            {plan && !plan.salesAssisted && (
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "0.5px solid rgba(98, 88, 196, 0.35)",
                  background: "rgba(98, 88, 196, 0.08)",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  lineHeight: 1.5
                }}
              >
                <strong style={{ color: "var(--foreground)" }}>Plan elegido:</strong> {plan.name} · {cycleLabel}. El alta de pago se conectará más adelante; por ahora activamos tu espacio de trabajo.
              </div>
            )}
            {plan?.salesAssisted && (
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "0.5px solid var(--border)",
                  background: "var(--muted)",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  lineHeight: 1.5
                }}
              >
                El plan <strong style={{ color: "var(--foreground)" }}>Empresarial</strong> se cotiza con el equipo comercial.{" "}
                <Link to="/contacto-ventas" style={{ color: "var(--primary)", fontWeight: 500 }}>
                  Ir al formulario de ventas
                </Link>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { id: "fullName", label: "Nombre completo", type: "text", placeholder: "Tu nombre completo" },
              { id: "email", label: "Correo electrónico", type: "email", placeholder: "tu@correo.com" },
              { id: "phone", label: "Teléfono", type: "tel", placeholder: "+57 300 000 0000" },
              { id: "password", label: "Contraseña", type: "password", placeholder: "Mínimo 8 caracteres" }
            ].map(({ id, label, type, placeholder }) => (
              <div key={id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Label
                  htmlFor={id}
                  style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: "var(--text-secondary)" }}
                >
                  {label}
                </Label>
                <Input
                  id={id}
                  type={type}
                  placeholder={placeholder}
                  value={form[id as keyof typeof form]}
                  onChange={update(id as keyof typeof form)}
                  required
                  style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                />
              </div>
            ))}

            {error && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "10px 12px",
                  backgroundColor: "var(--danger-surface)",
                  borderRadius: 7,
                  border: "0.5px solid var(--danger)"
                }}
              >
                <AlertCircle size={13} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, color: "var(--danger)" }}>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              style={{
                backgroundColor: "var(--primary)",
                color: "#FFFFFF",
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 500,
                height: 38,
                width: "100%",
                marginTop: 4
              }}
            >
              {isSubmitting ? "Creando cuenta..." : "Registrar administrador"}
            </Button>
          </form>

          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: "0.5px solid var(--border)",
              textAlign: "center"
            }}
          >
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              ¿Ya tienes cuenta?{" "}
              <Link
                to="/login-admin"
                style={{ color: "var(--primary)", fontWeight: 500, textDecoration: "none" }}
              >
                Inicia sesión
              </Link>
            </span>
          </div>
        </motion.div>

        {/* Info sidebar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="card-base"
          style={{ padding: 20 }}
        >
          <h2 className="text-subtitle" style={{ marginBottom: 16 }}>
            Qué ocurre después del registro
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {steps.map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    backgroundColor: "var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 1,
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--accent-foreground)"
                  }}
                >
                  {i + 1}
                </div>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: 0.15 }}
        style={{ marginTop: 24 }}
      >
        <Link
          to="/"
          style={{ fontSize: 12, color: "var(--text-tertiary)", textDecoration: "none" }}
        >
          ← Volver al inicio
        </Link>
      </motion.div>
    </div>
  );
}
