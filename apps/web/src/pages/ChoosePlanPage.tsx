import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { FunnelLayout } from "../components/FunnelLayout";
import {
  PRICING_PLANS,
  displayPriceUsd,
  type BillingCycle,
  summaryHref,
  parseBillingCycle,
  planById
} from "../data/pricingPlans";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } }
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.06 } }
};

export function ChoosePlanPage() {
  const [searchParams] = useSearchParams();
  const initialCycle = parseBillingCycle(searchParams.get("cycle"));
  const [annualBilling, setAnnualBilling] = useState(initialCycle === "annual");
  const cycle: BillingCycle = annualBilling ? "annual" : "monthly";
  const highlightId = searchParams.get("plan");

  return (
    <FunnelLayout
      eyebrow="Contratar"
      title="Elige el plan que mejor encaja con tu operación"
      subtitle="Puedes empezar con prueba gratuita en planes autogestionados. Facturación mensual o anual (ahorro aproximado del 20% en anual)."
    >
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
        <div
          style={{
            display: "inline-flex",
            padding: 3,
            borderRadius: 9,
            backgroundColor: "rgba(255,255,255,0.04)",
            border: "0.5px solid rgba(255,255,255,0.08)"
          }}
        >
          <button
            type="button"
            onClick={() => setAnnualBilling(false)}
            style={{
              padding: "6px 16px",
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 500,
              backgroundColor: !annualBilling ? "rgba(98,88,196,0.4)" : "transparent",
              color: !annualBilling ? "#fff" : "rgba(255,255,255,0.4)",
              transition: "all 150ms"
            }}
          >
            Mensual
          </button>
          <button
            type="button"
            onClick={() => setAnnualBilling(true)}
            style={{
              padding: "6px 16px",
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 500,
              backgroundColor: annualBilling ? "rgba(98,88,196,0.4)" : "transparent",
              color: annualBilling ? "#fff" : "rgba(255,255,255,0.4)",
              transition: "all 150ms"
            }}
          >
            Anual · ahorra ~20%
          </button>
        </div>
      </div>

      <div className="landing-pricing-stage">
        <div className="landing-pricing-stage__inner">
          <motion.div
            className="landing-pricing-grid"
            variants={stagger}
            initial="hidden"
            animate="show"
            viewport={{ once: true }}
          >
            {PRICING_PLANS.map((plan) => {
              const price = displayPriceUsd(plan, cycle);
              const pre = highlightId === plan.id;
              const ctaTo = plan.salesAssisted ? "/contacto-ventas" : summaryHref(plan.id, cycle);
              return (
                <motion.div
                  key={plan.id}
                  variants={fadeUp}
                  className="landing-pricing-card"
                  style={{
                    position: "relative",
                    border: pre || plan.highlight ? "0.5px solid rgba(139,127,232,0.55)" : "0.5px solid rgba(255,255,255,0.08)",
                    backgroundColor: plan.highlight || pre ? "rgba(98,88,196,0.14)" : "rgba(255,255,255,0.03)",
                    borderRadius: 14,
                    padding: "26px 22px",
                    boxShadow: pre ? "0 0 0 1px rgba(139,127,232,0.2)" : undefined
                  }}
                >
                  {plan.highlight && (
                    <div
                      style={{
                        position: "absolute",
                        top: -11,
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        padding: "5px 12px",
                        borderRadius: 999,
                        background: "linear-gradient(135deg, #6258C4 0%, #8B7FE8 100%)",
                        color: "#fff"
                      }}
                    >
                      Más elegido
                    </div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 600, color: plan.highlight ? "#C4B5FD" : "rgba(255,255,255,0.5)", marginBottom: 6 }}>
                    {plan.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
                    <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em" }}>{price}</span>
                    {plan.priceMonthlyUsd != null && <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{plan.period}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 22, lineHeight: 1.5 }}>{plan.tagline}</div>
                  <Link
                    to={ctaTo}
                    style={{
                      display: "block",
                      textAlign: "center",
                      padding: "12px 16px",
                      borderRadius: 9,
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: "none",
                      marginBottom: 22,
                      background: plan.highlight ? "linear-gradient(135deg, #6258C4 0%, #8B7FE8 100%)" : "rgba(255,255,255,0.06)",
                      color: plan.highlight ? "#fff" : "rgba(255,255,255,0.7)",
                      border: plan.highlight ? "none" : "0.5px solid rgba(255,255,255,0.1)"
                    }}
                  >
                    {plan.cta}
                  </Link>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {plan.features.map((f) => (
                      <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0, marginTop: 2 }}>
                          <circle cx="7" cy="7" r="6" fill={plan.highlight ? "rgba(139,127,232,0.2)" : "rgba(255,255,255,0.06)"} />
                          <path
                            d="M4 7l2 2 4-4"
                            stroke={plan.highlight ? "#9B7FE8" : "rgba(255,255,255,0.35)"}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            fill="none"
                          />
                        </svg>
                        <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>

      <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 28 }}>
        Precios en USD. Facturación disponible en COP.{" "}
        <Link to="/" style={{ color: "rgba(196,181,253,0.55)" }}>
          Volver al inicio
        </Link>
        {highlightId && planById(highlightId) && (
          <>
            {" · "}
            <span style={{ color: "rgba(255,255,255,0.35)" }}>Plan sugerido: {planById(highlightId)!.name}</span>
          </>
        )}
      </p>
    </FunnelLayout>
  );
}
