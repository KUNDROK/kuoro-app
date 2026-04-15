import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle } from "lucide-react";
import type { PrivateUnitType } from "@kuoro/contracts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createProperty, fetchMe, getStoredToken, updateProperty } from "../lib/api";
import {
  buildPropertyPayload,
  createInitialPropertyForm,
  getBuildingSubtypeOptions,
  getDevelopmentShapeOptions,
  getDefaultUnitTypesForContext,
  getStructureModeOptions,
  getVisibleUnitTypeOptions,
  legalTypeOptions,
  mapPropertyToForm,
  type PropertyWizardForm
} from "../lib/propertyWizard";

type Props = {
  mode: "create" | "edit";
};

const steps = [
  { label: "Datos generales", detail: "Nombre, ciudad y dirección" },
  { label: "Clasificación legal", detail: "Tipo de copropiedad" },
  { label: "Estructura", detail: "Tipología y composición" },
  { label: "Reglas operativas", detail: "Coeficientes y representación" }
];

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 7,
  border: "0.5px solid var(--border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
  fontSize: 13,
  outline: "none",
  height: 36
};

export function PropertyWizardPage({ mode }: Props) {
  const navigate = useNavigate();
  const [form, setForm] = useState<PropertyWizardForm>(createInitialPropertyForm());
  const [propertyId, setPropertyId] = useState("");
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCreateMode = mode === "create";

  const structureOptions = useMemo(
    () => getStructureModeOptions(form.legalType, form.developmentShape, form.buildingSubtype),
    [form.legalType, form.developmentShape, form.buildingSubtype]
  );
  const buildingSubtypeOptions = useMemo(
    () => getBuildingSubtypeOptions(form.legalType, form.developmentShape),
    [form.legalType, form.developmentShape]
  );
  const developmentShapeOptions = useMemo(
    () => getDevelopmentShapeOptions(form.legalType),
    [form.legalType]
  );
  const visibleUnitTypeOptions = useMemo(
    () => getVisibleUnitTypeOptions(form.legalType, form.developmentShape, form.buildingSubtype),
    [form.legalType, form.developmentShape, form.buildingSubtype]
  );
  const shouldShowSubtypeSelect =
    form.legalType === "comercial" || form.developmentShape === "edificio";
  const subtypeLabel =
    form.legalType === "comercial"
      ? "Subtipo del proyecto comercial"
      : form.legalType === "mixto"
        ? "Subtipo del proyecto mixto"
        : "Subtipo de edificio";
  const developmentShapeLabel =
    form.legalType === "comercial"
      ? "Tipología física del proyecto comercial"
      : form.legalType === "mixto"
        ? "Tipología física del proyecto mixto"
        : "Tipología física de la copropiedad";

  useEffect(() => {
    fetchMe()
      .then((data) => {
        const property = data.properties[0];
        if (property && isCreateMode) {
          navigate("/dashboard", { replace: true });
          return;
        }
        if (!property && !isCreateMode) {
          navigate("/crear-copropiedad", { replace: true });
          return;
        }
        if (property) {
          setPropertyId(property.id);
          setForm(mapPropertyToForm(property));
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No fue posible cargar la copropiedad"))
      .finally(() => setIsLoading(false));
  }, [isCreateMode, navigate]);

  if (!getStoredToken()) return <Navigate to="/login-admin" replace />;

  function setLegalType(nextValue: PropertyWizardForm["legalType"]) {
    const nextBuildingSubtype =
      nextValue === "comercial" || form.developmentShape === "edificio"
        ? getBuildingSubtypeOptions(nextValue, form.developmentShape)[0]?.value
        : undefined;
    const nextStructureModes = getStructureModeOptions(
      nextValue,
      form.developmentShape,
      nextBuildingSubtype
    ).map((o) => o.value);

    setForm((c) => ({
      ...c,
      legalType: nextValue,
      buildingSubtype: nextBuildingSubtype,
      structureModes: nextStructureModes,
      privateUnitTypes: getDefaultUnitTypesForContext(nextValue, c.developmentShape, nextBuildingSubtype)
    }));
  }

  function toggleStructureMode(value: PropertyWizardForm["structureModes"][number]) {
    setForm((c) => {
      const exists = c.structureModes.includes(value);
      const next = exists
        ? c.structureModes.filter((m) => m !== value)
        : [...c.structureModes, value];
      return { ...c, structureModes: next.length ? next : [value] };
    });
  }

  function toggleUnitType(unitType: PrivateUnitType) {
    setForm((c) => ({
      ...c,
      privateUnitTypes: c.privateUnitTypes.includes(unitType)
        ? c.privateUnitTypes.filter((t) => t !== unitType)
        : [...c.privateUnitTypes, unitType]
    }));
  }

  function handleNext() {
    setStep((s) => Math.min(steps.length - 1, s + 1));
  }

  async function handleSave() {
    setError("");
    setIsSubmitting(true);
    try {
      const payload = buildPropertyPayload(form);
      if (isCreateMode) {
        const created = await createProperty(payload);
        navigate(`/unidades-iniciales?propertyId=${created.property.id}`);
      } else {
        await updateProperty(propertyId, payload);
        navigate("/dashboard");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible guardar la copropiedad");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Safety guard: keyboard Enter on any field should only advance, never save mid-wizard
    if (step < steps.length - 1) {
      handleNext();
    } else {
      void handleSave();
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
        justifyContent: "flex-start",
        padding: "40px 24px 60px"
      }}
    >
      {/* Brand header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          maxWidth: 680,
          marginBottom: 32
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              backgroundColor: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="2" width="10" height="10" rx="2.5" stroke="white" strokeWidth="1.5" />
              <path d="M8 9l2 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.01em" }}>
            Kuoro
          </span>
        </div>
        <Link
          to="/dashboard"
          style={{ fontSize: 12, color: "var(--text-tertiary)", textDecoration: "none" }}
        >
          ← Volver al dashboard
        </Link>
      </div>

      {/* Page title */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        style={{ width: "100%", maxWidth: 680, marginBottom: 24 }}
      >
        <span
          style={{
            display: "inline-flex",
            padding: "3px 10px",
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 500,
            marginBottom: 10,
            backgroundColor: "var(--accent)",
            color: "var(--accent-foreground)"
          }}
        >
          {isCreateMode ? "Alta estructural" : "Edición estructural"}
        </span>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color: "var(--foreground)",
            margin: "0 0 6px"
          }}
        >
          {isCreateMode
            ? "Define la estructura base del conjunto"
            : "Ajusta la estructura de la copropiedad"}
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
          {isCreateMode
            ? "Estos datos son la base legal y operativa desde la que se configuran unidades, asambleas y comunicaciones."
            : "Los cambios estructurales afectan la forma en que se calculan unidades, quorum y coeficientes."}
        </p>
      </motion.div>

      {/* Step indicator */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.04 }}
        style={{
          width: "100%",
          maxWidth: 680,
          display: "grid",
          gridTemplateColumns: `repeat(${steps.length}, 1fr)`,
          gap: 6,
          marginBottom: 16
        }}
      >
        {steps.map((s, index) => {
          const isActive = index === step;
          const isDone = index < step;
          return (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div
                style={{
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: isDone
                    ? "var(--success)"
                    : isActive
                      ? "var(--primary)"
                      : "var(--border)"
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 600,
                    flexShrink: 0,
                    backgroundColor: isDone
                      ? "var(--success)"
                      : isActive
                        ? "var(--primary)"
                        : "var(--muted)",
                    color: isDone || isActive ? "#FFFFFF" : "var(--text-tertiary)"
                  }}
                >
                  {isDone ? "✓" : index + 1}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: isActive ? "var(--foreground)" : isDone ? "var(--success)" : "var(--text-tertiary)"
                    }}
                  >
                    {s.label}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{s.detail}</div>
                </div>
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.08 }}
        className="card-base"
        style={{ width: "100%", maxWidth: 680, padding: 28 }}
      >
        {isLoading ? (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Preparando el formulario estructural...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              {/* Step 0: General data */}
              {step === 0 && (
                <motion.div
                  key="step-0"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}
                  style={{ display: "flex", flexDirection: "column", gap: 16 }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
                      <Label htmlFor="property-name" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: "var(--text-secondary)" }}>
                        Nombre de la copropiedad
                      </Label>
                      <Input
                        id="property-name"
                        placeholder="Ej. Conjunto Residencial El Prado"
                        value={form.name}
                        style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                        onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                      />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <Label htmlFor="property-city" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: "var(--text-secondary)" }}>
                        Ciudad
                      </Label>
                      <Input
                        id="property-city"
                        placeholder="Bogotá, Medellín, Cali..."
                        value={form.city}
                        style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                        onChange={(e) => setForm((c) => ({ ...c, city: e.target.value }))}
                      />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <Label htmlFor="property-nit" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: "var(--text-secondary)" }}>
                        NIT
                      </Label>
                      <Input
                        id="property-nit"
                        placeholder="Ej. 900.123.456-7"
                        value={form.nit}
                        style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                        onChange={(e) => setForm((c) => ({ ...c, nit: e.target.value }))}
                      />
                    </div>

                    <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
                      <Label htmlFor="property-address" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: "var(--text-secondary)" }}>
                        Dirección principal
                      </Label>
                      <Input
                        id="property-address"
                        placeholder="Calle 123 # 45-67, Barrio..."
                        value={form.address}
                        style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                        onChange={(e) => setForm((c) => ({ ...c, address: e.target.value }))}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 1: Legal classification */}
              {step === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}
                >
                  <div style={{ marginBottom: 16 }}>
                    <h2
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--foreground)",
                        margin: "0 0 6px"
                      }}
                    >
                      Tipo legal de la copropiedad
                    </h2>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                      Define el marco jurídico bajo el que opera la copropiedad. Esto condiciona los tipos de unidades y las reglas disponibles.
                    </p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                    {legalTypeOptions.map((option) => {
                      const isSelected = form.legalType === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setLegalType(option.value)}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            gap: 4,
                            padding: "14px 16px",
                            borderRadius: 10,
                            border: `0.5px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                            backgroundColor: isSelected ? "var(--accent)" : "var(--background)",
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "all 0.15s"
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              width: "100%"
                            }}
                          >
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: isSelected ? "var(--accent-foreground)" : "var(--foreground)"
                              }}
                            >
                              {option.label}
                            </span>
                            {isSelected && (
                              <CheckCircle
                                size={13}
                                style={{ color: "var(--primary)", marginLeft: "auto", flexShrink: 0 }}
                              />
                            )}
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              color: isSelected ? "var(--accent-foreground)" : "var(--text-secondary)",
                              lineHeight: 1.4,
                              opacity: isSelected ? 0.85 : 1
                            }}
                          >
                            {option.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Structure */}
              {step === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}
                  style={{ display: "flex", flexDirection: "column", gap: 16 }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: "var(--text-secondary)" }}>
                      {developmentShapeLabel}
                    </label>
                    <select
                      value={form.developmentShape}
                      style={selectStyle}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          developmentShape: e.target.value as PropertyWizardForm["developmentShape"],
                          buildingSubtype:
                            c.legalType === "comercial" || e.target.value === "edificio"
                              ? getBuildingSubtypeOptions(c.legalType, e.target.value as PropertyWizardForm["developmentShape"])[0]?.value
                              : undefined,
                          structureModes: getStructureModeOptions(
                            c.legalType,
                            e.target.value as PropertyWizardForm["developmentShape"],
                            getBuildingSubtypeOptions(c.legalType, e.target.value as PropertyWizardForm["developmentShape"])[0]?.value
                          ).map((o) => o.value),
                          privateUnitTypes: getDefaultUnitTypesForContext(
                            c.legalType,
                            e.target.value as PropertyWizardForm["developmentShape"],
                            getBuildingSubtypeOptions(c.legalType, e.target.value as PropertyWizardForm["developmentShape"])[0]?.value
                          )
                        }))
                      }
                    >
                      {developmentShapeOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {shouldShowSubtypeSelect && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: "var(--text-secondary)" }}>
                        {subtypeLabel}
                      </label>
                      <select
                        value={form.buildingSubtype ?? ""}
                        style={selectStyle}
                        onChange={(e) =>
                          setForm((c) => ({
                            ...c,
                            buildingSubtype: (e.target.value as PropertyWizardForm["buildingSubtype"]) || undefined,
                            structureModes: getStructureModeOptions(
                              c.legalType,
                              c.developmentShape,
                              (e.target.value as PropertyWizardForm["buildingSubtype"]) || undefined
                            ).map((o) => o.value),
                            privateUnitTypes: getDefaultUnitTypesForContext(
                              c.legalType,
                              c.developmentShape,
                              (e.target.value as PropertyWizardForm["buildingSubtype"]) || undefined
                            )
                          }))
                        }
                      >
                        <option value="">Selecciona una opción</option>
                        {buildingSubtypeOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: "var(--text-secondary)", display: "block", marginBottom: 10 }}>
                      Cómo está compuesta internamente la copropiedad
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                      {structureOptions.map((option) => {
                        const isChecked = form.structureModes.includes(option.value);
                        return (
                          <label
                            key={option.value}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "10px 12px",
                              borderRadius: 7,
                              border: `0.5px solid ${isChecked ? "var(--primary)" : "var(--border)"}`,
                              backgroundColor: isChecked ? "var(--accent)" : "transparent",
                              cursor: "pointer"
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              style={{ accentColor: "var(--primary)", width: 13, height: 13 }}
                              onChange={() => toggleStructureMode(option.value)}
                            />
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: isChecked ? "var(--accent-foreground)" : "var(--foreground)"
                              }}
                            >
                              {option.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Operational rules */}
              {step === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}
                  style={{ display: "flex", flexDirection: "column", gap: 20 }}
                >
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: "var(--text-secondary)", display: "block", marginBottom: 10 }}>
                      Tipos de bienes privados presentes
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                      {visibleUnitTypeOptions.map((option) => {
                        const isChecked = form.privateUnitTypes.includes(option.value);
                        return (
                          <label
                            key={option.value}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "10px 12px",
                              borderRadius: 7,
                              border: `0.5px solid ${isChecked ? "var(--primary)" : "var(--border)"}`,
                              backgroundColor: isChecked ? "var(--accent)" : "transparent",
                              cursor: "pointer"
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              style={{ accentColor: "var(--primary)", width: 13, height: 13 }}
                              onChange={() => toggleUnitType(option.value)}
                            />
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: isChecked ? "var(--accent-foreground)" : "var(--foreground)"
                              }}
                            >
                              {option.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: "var(--text-secondary)", display: "block", marginBottom: 10 }}>
                      Reglas operativas de la asamblea
                    </label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[
                        {
                          key: "usesCoefficients",
                          label: "Usaremos coeficientes desde el inicio",
                          detail: "Base para quorum, participación y ponderación de voto.",
                          checked: form.usesCoefficients,
                          onChange: (v: boolean) => setForm((c) => ({ ...c, usesCoefficients: v }))
                        },
                        {
                          key: "usesContributionModules",
                          label: "Existen módulos de contribución diferenciados",
                          detail: "Permite manejar reglas por grupos o destinaciones.",
                          checked: form.usesContributionModules,
                          onChange: (v: boolean) => setForm((c) => ({ ...c, usesContributionModules: v }))
                        },
                        {
                          key: "supportsProxies",
                          label: "La copropiedad manejará apoderados en asamblea",
                          detail: "Habilita representación y validación de poderes.",
                          checked: form.supportsProxies,
                          onChange: (v: boolean) => setForm((c) => ({ ...c, supportsProxies: v }))
                        }
                      ].map(({ key, label, detail, checked, onChange }) => (
                        <label
                          key={key}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 12,
                            padding: "12px 14px",
                            borderRadius: 7,
                            border: `0.5px solid ${checked ? "var(--primary)" : "var(--border)"}`,
                            backgroundColor: checked ? "var(--accent)" : "transparent",
                            cursor: "pointer"
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            style={{ accentColor: "var(--primary)", width: 13, height: 13, marginTop: 2 }}
                            onChange={(e) => onChange(e.target.checked)}
                          />
                          <div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: checked ? "var(--accent-foreground)" : "var(--foreground)",
                                lineHeight: 1.4
                              }}
                            >
                              {label}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3, lineHeight: 1.4 }}>
                              {detail}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error message */}
            {error && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "10px 12px",
                  backgroundColor: "var(--danger-surface)",
                  borderRadius: 7,
                  border: "0.5px solid var(--danger)",
                  marginTop: 16
                }}
              >
                <AlertCircle size={13} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, color: "var(--danger)" }}>{error}</span>
              </div>
            )}

            {/* Navigation */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 24,
                paddingTop: 20,
                borderTop: "0.5px solid var(--border)"
              }}
            >
              <Button
                type="button"
                variant="secondary"
                disabled={step === 0}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                style={{ borderRadius: 7, fontSize: 13, height: 36 }}
              >
                ← Anterior
              </Button>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  {step + 1} de {steps.length}
                </span>

                {step < steps.length - 1 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    style={{
                      backgroundColor: "var(--primary)",
                      color: "#FFFFFF",
                      borderRadius: 7,
                      fontSize: 13,
                      height: 36
                    }}
                  >
                    Siguiente →
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={isSubmitting || isLoading}
                    onClick={() => void handleSave()}
                    style={{
                      backgroundColor: "var(--primary)",
                      color: "#FFFFFF",
                      borderRadius: 7,
                      fontSize: 13,
                      height: 36
                    }}
                  >
                    {isSubmitting
                      ? "Guardando..."
                      : isCreateMode
                        ? "Continuar al cargue de unidades"
                        : "Guardar cambios estructurales"}
                  </Button>
                )}
              </div>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
