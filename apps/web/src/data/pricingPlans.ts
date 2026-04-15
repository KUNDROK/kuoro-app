/** Catálogo de planes y helpers para el embudo público (landing → contratar → registro). */

export type PlanId = "starter" | "professional" | "enterprise";
export type BillingCycle = "monthly" | "annual";

export type PricingPlan = {
  id: PlanId;
  name: string;
  /** USD / mes; null = precio “desde” o cotización */
  priceMonthlyUsd: number | null;
  period: string;
  tagline: string;
  highlight: boolean;
  features: string[];
  cta: string;
  /** Si true, el flujo va a contacto comercial en lugar de autogestión */
  salesAssisted: boolean;
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    priceMonthlyUsd: 49,
    period: "/mes",
    tagline: "Para empezar con seguridad",
    highlight: false,
    features: [
      "1 copropiedad",
      "Hasta 100 unidades",
      "Gestión de propietarios y poderes",
      "Convocatoria básica",
      "Sala de asamblea virtual",
      "Votaciones en vivo",
      "Historial de asambleas",
      "Soporte por email"
    ],
    cta: "Comenzar gratis 14 días",
    salesAssisted: false
  },
  {
    id: "professional",
    name: "Profesional",
    priceMonthlyUsd: 129,
    period: "/mes",
    tagline: "El plan preferido de las administradoras",
    highlight: true,
    features: [
      "Hasta 5 copropiedades",
      "Hasta 500 unidades",
      "Todo lo de Starter",
      "Convocatoria por email automática",
      "Votación digital de propietarios",
      "Módulo de comunicaciones",
      "Reportes y exportación de actas",
      "Asistente IA integrado",
      "Soporte prioritario"
    ],
    cta: "Empezar ahora",
    salesAssisted: false
  },
  {
    id: "enterprise",
    name: "Empresarial",
    priceMonthlyUsd: null,
    period: "/mes",
    tagline: "Para grandes administradoras y conjuntos",
    highlight: false,
    features: [
      "Copropiedades ilimitadas",
      "Unidades ilimitadas",
      "Todo lo de Profesional",
      "API y webhooks",
      "SSO / Active Directory",
      "Sala de conferencia integrada (Kuoro Live)",
      "Onboarding y capacitación dedicada",
      "SLA garantizado",
      "Facturación personalizada"
    ],
    cta: "Hablar con ventas",
    salesAssisted: true
  }
];

export function planById(id: string | null | undefined): PricingPlan | undefined {
  if (!id) return undefined;
  return PRICING_PLANS.find((p) => p.id === id);
}

/** Precio mostrado: anual = ~20% menos sobre el mensual (misma regla que el landing). */
export function displayPriceUsd(plan: PricingPlan, cycle: BillingCycle): string {
  if (plan.id === "enterprise" || plan.priceMonthlyUsd == null) {
    return "Desde $399";
  }
  const base = plan.priceMonthlyUsd;
  const n = cycle === "annual" ? Math.round(base * 0.8) : base;
  return `$${n}`;
}

export function summaryHref(planId: PlanId, cycle: BillingCycle): string {
  const q = new URLSearchParams({ plan: planId, cycle });
  return `/contratar/resumen?${q.toString()}`;
}

export function registerHref(planId: PlanId, cycle: BillingCycle): string {
  const q = new URLSearchParams({ plan: planId, cycle });
  return `/registro-admin?${q.toString()}`;
}

export function parseBillingCycle(v: string | null | undefined): BillingCycle {
  return v === "annual" ? "annual" : "monthly";
}

export function planLabelInSpanish(planId: PlanId): string {
  const p = planById(planId);
  return p?.name ?? planId;
}
