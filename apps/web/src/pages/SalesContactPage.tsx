import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FunnelLayout } from "../components/FunnelLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SalesContactPage() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    message: ""
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    window.setTimeout(() => {
      setPending(false);
      setSent(true);
    }, 650);
  }

  if (sent) {
    return (
      <FunnelLayout
        eyebrow="Ventas"
        title="Gracias, hemos recibido tu solicitud"
        subtitle="Un asesor comercial revisará tu mensaje y te contactará por correo o teléfono en 1–2 días hábiles."
      >
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 440 }}>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, marginBottom: 24 }}>
            Mientras tanto puedes revisar el plan Profesional en la página de precios o volver al inicio.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Link
              to="/contratar"
              style={{
                display: "inline-flex",
                padding: "12px 20px",
                borderRadius: 10,
                background: "linear-gradient(135deg, #6258C4 0%, #8B7FE8 100%)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none"
              }}
            >
              Ver planes
            </Link>
            <Link to="/" style={{ fontSize: 14, color: "rgba(196,181,253,0.75)", alignSelf: "center", textDecoration: "none" }}>
              Volver al inicio
            </Link>
          </div>
        </motion.div>
      </FunnelLayout>
    );
  }

  return (
    <FunnelLayout
      eyebrow="Empresarial"
      title="Hablemos de tu operación"
      subtitle="Cuéntanos volumen de copropiedades, integraciones (SSO, API) y ventanas de implementación. Prepararemos una propuesta y facturación a medida."
    >
      <form onSubmit={handleSubmit} style={{ maxWidth: 440, display: "flex", flexDirection: "column", gap: 16 }}>
        {(
          [
            { id: "name", label: "Nombre y apellido", type: "text", placeholder: "María López", required: true },
            { id: "email", label: "Correo corporativo", type: "email", placeholder: "tu@empresa.com", required: true },
            { id: "company", label: "Empresa o marca", type: "text", placeholder: "Administradora XYZ", required: true },
            { id: "phone", label: "Teléfono", type: "tel", placeholder: "+57 601 000 0000", required: false }
          ] as const
        ).map((field) => (
          <div key={field.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Label htmlFor={field.id} style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.45)" }}>
              {field.label}
            </Label>
            <Input
              id={field.id}
              type={field.type}
              placeholder={field.placeholder}
              required={field.required}
              value={form[field.id]}
              onChange={(ev) => setForm((c) => ({ ...c, [field.id]: ev.target.value }))}
              style={{
                borderRadius: 9,
                borderWidth: "0.5px",
                borderColor: "rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.35)",
                color: "#fff",
                fontSize: 14
              }}
            />
          </div>
        ))}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label htmlFor="message" style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.45)" }}>
            ¿Qué necesitas?
          </Label>
          <textarea
            id="message"
            required
            rows={4}
            placeholder="Número de conjuntos, unidades aproximadas, fecha deseada de go-live…"
            value={form.message}
            onChange={(ev) => setForm((c) => ({ ...c, message: ev.target.value }))}
            style={{
              borderRadius: 9,
              borderWidth: "0.5px",
              borderColor: "rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.35)",
              color: "#fff",
              fontSize: 14,
              padding: "10px 12px",
              resize: "vertical",
              fontFamily: "inherit"
            }}
          />
        </div>
        <Button
          type="submit"
          disabled={pending}
          style={{
            marginTop: 8,
            height: 42,
            borderRadius: 9,
            fontWeight: 600,
            background: "linear-gradient(135deg, #6258C4 0%, #8B7FE8 100%)"
          }}
        >
          {pending ? "Enviando…" : "Enviar solicitud"}
        </Button>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", lineHeight: 1.5, margin: 0 }}>
          Este formulario es una demostración de producto: no envía correos todavía. En producción se conectaría a tu CRM o bandeja de ventas.
        </p>
      </form>

      <p style={{ marginTop: 28, fontSize: 13 }}>
        <Link to="/contratar" style={{ color: "rgba(196,181,253,0.75)", textDecoration: "none" }}>
          ← Volver a planes
        </Link>
      </p>
    </FunnelLayout>
  );
}
