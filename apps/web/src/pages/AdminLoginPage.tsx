import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { fetchMe, loginAdmin, setStoredToken } from "../lib/api";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await loginAdmin({ email, password });
      setStoredToken(response.token);
      const me = await fetchMe();
      navigate(me.properties.length > 0 ? "/dashboard" : "/crear-copropiedad");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "No fue posible iniciar sesión");
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

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.05 }}
        className="card-base"
        style={{ width: "100%", maxWidth: 400, padding: 28 }}
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
            Iniciar sesión
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Accede a tu cuenta de administrador Kuoro.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Label htmlFor="login-email" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: "var(--text-secondary)" }}>
              Correo electrónico
            </Label>
            <Input
              id="login-email"
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Label htmlFor="login-password" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: "var(--text-secondary)" }}>
              Contraseña
            </Label>
            <Input
              id="login-password"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
            />
          </div>

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
              width: "100%"
            }}
          >
            {isSubmitting ? "Ingresando..." : "Ingresar"}
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
            ¿No tienes cuenta?{" "}
            <Link
              to="/registro-admin"
              style={{ color: "var(--primary)", fontWeight: 500, textDecoration: "none" }}
            >
              Regístrate aquí
            </Link>
          </span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: 0.1 }}
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
