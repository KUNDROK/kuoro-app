import { Link, Navigate, useSearchParams } from "react-router-dom";
import { FunnelLayout } from "../components/FunnelLayout";
import {
  displayPriceUsd,
  parseBillingCycle,
  planById,
  registerHref,
  type PlanId
} from "../data/pricingPlans";

function isPlanId(s: string | null): s is PlanId {
  return s === "starter" || s === "professional" || s === "enterprise";
}

export function CheckoutSummaryPage() {
  const [searchParams] = useSearchParams();
  const rawPlan = searchParams.get("plan");
  const cycle = parseBillingCycle(searchParams.get("cycle"));

  if (!isPlanId(rawPlan)) {
    return <Navigate to="/contratar" replace />;
  }

  const plan = planById(rawPlan);
  if (!plan || plan.salesAssisted) {
    return <Navigate to="/contacto-ventas" replace />;
  }

  const price = displayPriceUsd(plan, cycle);
  const cycleLabel = cycle === "annual" ? "Facturación anual (cobro por periodo)" : "Facturación mensual";

  return (
    <FunnelLayout
      eyebrow="Paso 2 de 3"
      title="Resumen de tu suscripción"
      subtitle="El cobro real se activará cuando integremos pasarela de pagos. Por ahora confirmas el plan y creas tu cuenta de administrador."
    >
      <div
        style={{
          borderRadius: 14,
          border: "0.5px solid rgba(139,127,232,0.35)",
          background: "rgba(98,88,196,0.1)",
          padding: "24px 22px",
          maxWidth: 480,
          marginBottom: 28
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(196,181,253,0.65)", marginBottom: 8 }}>
          Plan seleccionado
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>{plan.name}</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 16 }}>{plan.tagline}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em" }}>{price}</span>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>{plan.period}</span>
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{cycleLabel}</div>
      </div>

      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.42)", lineHeight: 1.7, maxWidth: 520, marginBottom: 28 }}>
        <strong style={{ color: "rgba(255,255,255,0.65)" }}>Incluye:</strong> prueba gratuita de 14 días en planes autogestionados, sin tarjeta para empezar. Después del registro podrás crear tu copropiedad, cargar unidades y convocar tu primera asamblea.
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <Link
          to={registerHref(plan.id, cycle)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 24px",
            borderRadius: 10,
            background: "linear-gradient(135deg, #6258C4 0%, #8B7FE8 100%)",
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            textDecoration: "none",
            boxShadow: "0 0 40px rgba(98,88,196,0.35)"
          }}
        >
          Continuar y crear cuenta
        </Link>
        <Link
          to={`/contratar?plan=${plan.id}&cycle=${cycle}`}
          style={{ fontSize: 14, color: "rgba(196,181,253,0.75)", textDecoration: "none" }}
        >
          Cambiar plan o ciclo
        </Link>
      </div>

      <p style={{ marginTop: 36, fontSize: 12, color: "rgba(255,255,255,0.22)" }}>
        Al continuar aceptas los{" "}
        <Link to="/legal/terminos" style={{ color: "rgba(196,181,253,0.55)" }}>
          términos de uso
        </Link>{" "}
        y la{" "}
        <Link to="/legal/privacidad" style={{ color: "rgba(196,181,253,0.55)" }}>
          política de privacidad
        </Link>
        .
      </p>
    </FunnelLayout>
  );
}
