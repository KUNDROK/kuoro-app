import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle, ArrowRight } from "lucide-react";
import type { AuthResponse, PropertySummary, UnitCreateInput } from "@kuoro/contracts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PlatformShell } from "../components/PlatformShell";
import { createUnits, fetchMe, fetchUnits, getStoredToken } from "../lib/api";
import { documentTypeOptions, validateUnitForm } from "../lib/ownerValidation";
import { LoadingModal } from "../components/ui/loading";
import { createUnitFromTemplate, getUnitTemplates, type UnitTemplate } from "../lib/unitsSetup";

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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.04em",
        color: "var(--text-secondary)",
        display: "block",
        marginBottom: 6
      }}
    >
      {children}
    </label>
  );
}

function ToggleCheckbox({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 7,
        border: `0.5px solid ${checked ? "var(--primary)" : "var(--border)"}`,
        backgroundColor: checked ? "var(--accent)" : "transparent",
        cursor: "pointer"
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        style={{ accentColor: "var(--primary)", width: 13, height: 13 }}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        style={{
          fontSize: 12,
          color: checked ? "var(--accent-foreground)" : "var(--foreground)"
        }}
      >
        {label}
      </span>
    </label>
  );
}

export function UnitsSetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [admin, setAdmin] = useState<AuthResponse["admin"] | null>(null);
  const [property, setProperty] = useState<PropertySummary | null>(null);
  const [existingUnits, setExistingUnits] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<UnitTemplate | null>(null);
  const [unitForm, setUnitForm] = useState<UnitCreateInput | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const propertyIdFromQuery = searchParams.get("propertyId");
  const templates = useMemo(
    () => getUnitTemplates(property?.structureModes ?? []),
    [property?.structureModes]
  );

  useEffect(() => {
    fetchMe()
      .then(async (data) => {
        const selected =
          data.properties.find((p) => p.id === propertyIdFromQuery) ?? data.properties[0];

        if (!selected) {
          navigate("/crear-copropiedad", { replace: true });
          return;
        }

        setAdmin(data.admin);
        setProperty(selected);
        const nextTemplates = getUnitTemplates(selected.structureModes ?? []);
        const first = nextTemplates[0] ?? null;
        setSelectedTemplate(first);
        setUnitForm(first ? createUnitFromTemplate(first) : null);

        const unitsResponse = await fetchUnits(selected.id);
        setExistingUnits(unitsResponse.units.length);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "No fue posible cargar el formulario de unidades")
      )
      .finally(() => setIsLoading(false));
  }, [navigate, propertyIdFromQuery]);

  if (!getStoredToken()) return <Navigate to="/login-admin" replace />;

  function chooseTemplate(template: UnitTemplate) {
    setSelectedTemplate(template);
    setUnitForm(createUnitFromTemplate(template));
    setSuccessMessage("");
    setError("");
  }

  function updateField(field: keyof UnitCreateInput, value: string | number | undefined) {
    setUnitForm((c) => (c ? { ...c, [field]: value } : c));
  }

  function updatePrimaryOwnerField(
    field: keyof UnitCreateInput["owners"][number],
    value: string | boolean | undefined
  ) {
    setUnitForm((c) =>
      c
        ? {
            ...c,
            owners: c.owners.map((owner, i) => (i === 0 ? { ...owner, [field]: value } : owner))
          }
        : c
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!property || !unitForm || !selectedTemplate) {
      setError("Selecciona primero el tipo de unidad a registrar");
      return;
    }

    const validationError = validateUnitForm(unitForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      await createUnits(property.id, [unitForm]);
      const unitsResponse = await fetchUnits(property.id);
      setExistingUnits(unitsResponse.units.length);
      setSavedCount((n) => n + 1);
      setUnitForm(createUnitFromTemplate(selectedTemplate));
      setSuccessMessage("Unidad registrada. Puedes continuar con la siguiente.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible guardar la unidad");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PlatformShell
      activeSection="units"
      admin={admin}
      assistantScope={property ? { propertyId: property.id } : undefined}
      property={property}
      title="Cargue de unidades"
    >
      <LoadingModal visible={isSubmitting} message="Guardando unidades..." />
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header card */}
        <motion.div
          className="card-base"
          style={{ padding: 24 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16
            }}
          >
            <div style={{ flex: 1 }}>
              <span
                style={{
                  display: "inline-flex",
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 500,
                  marginBottom: 12,
                  backgroundColor: "var(--accent)",
                  color: "var(--accent-foreground)"
                }}
              >
                Cargue inicial de unidades
              </span>
              <span
                className="text-label"
                style={{ display: "block", marginBottom: 6 }}
              >
                Un registro a la vez
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
                {property?.name ?? "Copropiedad"}
              </h1>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  margin: 0,
                  lineHeight: 1.6
                }}
              >
                El formulario se adapta automáticamente a la estructura declarada en la copropiedad.
              </p>
              {error && !successMessage && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    marginTop: 12,
                    padding: "8px 12px",
                    backgroundColor: "var(--danger-surface)",
                    borderRadius: 7,
                    border: "0.5px solid var(--danger)"
                  }}
                >
                  <AlertCircle
                    size={13}
                    style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }}
                  />
                  <span style={{ fontSize: 12, color: "var(--danger)" }}>{error}</span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              {property && (
                <Link
                  to={`/unidades?propertyId=${property.id}`}
                  style={{
                    padding: "7px 12px",
                    backgroundColor: "var(--secondary)",
                    color: "var(--secondary-foreground)",
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: 500,
                    textDecoration: "none"
                  }}
                >
                  Ver unidades
                </Link>
              )}
              <Link
                to="/dashboard"
                style={{
                  padding: "7px 12px",
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

        {/* KPI strip */}
        {property && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { label: "Copropiedad", value: property.name, sub: "En configuración" },
              {
                label: "Estructuras",
                value: property.structureModes?.length ?? 0,
                sub: property.structureModes?.join(", ") || "Sin estructuras"
              },
              {
                label: "Unidades creadas",
                value: existingUnits,
                sub: savedCount > 0 ? `+${savedCount} en esta sesión` : "Total registradas"
              }
            ].map((kpi, i) => (
              <motion.div
                key={kpi.label}
                className="card-base"
                style={{ padding: "14px 16px", display: "flex", flexDirection: "column" }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
              >
                <span className="text-label" style={{ marginBottom: 8 }}>
                  {kpi.label}
                </span>
                <span
                  className="text-metric"
                  style={{ fontSize: typeof kpi.value === "string" ? 16 : undefined }}
                >
                  {kpi.value}
                </span>
                <span
                  style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, lineHeight: 1.4 }}
                >
                  {kpi.sub}
                </span>
              </motion.div>
            ))}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="card-base" style={{ padding: 0 }}>
            <LoadingModal variant="section" visible message="Preparando plantillas de unidades..." minHeight={200} />
          </div>
        )}

        {/* Main form area */}
        {!isLoading && property && (
          <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 12 }}>
            {/* Template selector */}
            <div className="card-base" style={{ padding: 20 }}>
              <h2 className="text-subtitle" style={{ marginBottom: 4 }}>
                Tipo de unidad
              </h2>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  marginBottom: 14,
                  lineHeight: 1.5
                }}
              >
                Selecciona el tipo antes de completar el formulario.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {templates.map((template) => {
                  const isActive = selectedTemplate?.key === template.key;
                  return (
                    <button
                      key={template.key}
                      type="button"
                      onClick={() => chooseTemplate(template)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 2,
                        padding: "10px 12px",
                        borderRadius: 7,
                        border: `0.5px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
                        backgroundColor: isActive ? "var(--accent)" : "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        width: "100%"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          width: "100%"
                        }}
                      >
                        <div
                          className="nav-dot"
                          style={{
                            backgroundColor: isActive ? "var(--primary)" : "var(--border)"
                          }}
                        />
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: isActive ? "var(--accent-foreground)" : "var(--foreground)"
                          }}
                        >
                          {template.label}
                        </span>
                      </div>
                      {template.groupingLabelText && (
                        <span
                          style={{
                            fontSize: 10,
                            color: isActive ? "var(--accent-foreground)" : "var(--text-tertiary)",
                            paddingLeft: 14,
                            opacity: 0.8
                          }}
                        >
                          {template.groupingLabelText}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Progress hint */}
              {existingUnits > 0 && (
                <div
                  style={{
                    marginTop: 20,
                    padding: "12px",
                    borderRadius: 7,
                    backgroundColor: "var(--success-surface)",
                    border: "0.5px solid var(--success)"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 4
                    }}
                  >
                    <CheckCircle size={12} style={{ color: "var(--success)" }} />
                    <span
                      style={{ fontSize: 11, fontWeight: 500, color: "var(--success)" }}
                    >
                      {existingUnits} unidades
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 10,
                      color: "var(--success)",
                      margin: 0,
                      opacity: 0.8
                    }}
                  >
                    Cuando termines, ve al dashboard para continuar.
                  </p>
                </div>
              )}
            </div>

            {/* Form */}
            {selectedTemplate && unitForm ? (
              <motion.div
                key={selectedTemplate.key}
                className="card-base"
                style={{ padding: 24 }}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18 }}
              >
                <div style={{ marginBottom: 20 }}>
                  <h2 className="text-subtitle" style={{ marginBottom: 4 }}>
                    {selectedTemplate.label}
                  </h2>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    El formulario ya viene ajustado según la estructura de la copropiedad.
                  </p>
                </div>

                {/* Success banner */}
                <AnimatePresence>
                  {successMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 14px",
                        backgroundColor: "var(--success-surface)",
                        borderRadius: 7,
                        border: "0.5px solid var(--success)",
                        marginBottom: 16
                      }}
                    >
                      <CheckCircle size={13} style={{ color: "var(--success)" }} />
                      <span style={{ fontSize: 12, color: "var(--success)" }}>
                        {successMessage}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {/* Unit fields */}
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--primary)",
                        letterSpacing: "0.04em",
                        marginBottom: 12
                      }}
                    >
                      DATOS DE LA UNIDAD
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: 12
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <FieldLabel>{selectedTemplate.groupingLabelText}</FieldLabel>
                        <Input
                          placeholder="Ej. Torre A, Bloque 2..."
                          value={unitForm.groupingLabel}
                          style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                          onChange={(e) => updateField("groupingLabel", e.target.value)}
                        />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <FieldLabel>{selectedTemplate.unitLabelText}</FieldLabel>
                        <Input
                          placeholder="Ej. 101, 202..."
                          value={unitForm.unitNumber}
                          style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                          onChange={(e) => updateField("unitNumber", e.target.value)}
                        />
                      </div>

                      {selectedTemplate.floorLabel && unitForm.unitType !== "casa" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <FieldLabel>{selectedTemplate.floorLabel}</FieldLabel>
                          <Input
                            placeholder="Ej. 1, 2, 3..."
                            value={unitForm.floor ?? ""}
                            style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                            onChange={(e) => updateField("floor", e.target.value)}
                          />
                        </div>
                      )}

                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <FieldLabel>Destino</FieldLabel>
                        <Input
                          placeholder="Ej. Residencial, Comercial..."
                          value={unitForm.destination}
                          style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                          onChange={(e) => updateField("destination", e.target.value)}
                        />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <FieldLabel>Área privada (m²)</FieldLabel>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Ej. 68.50"
                          value={unitForm.privateArea ?? ""}
                          style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                          onChange={(e) =>
                            updateField("privateArea", e.target.value ? Number(e.target.value) : undefined)
                          }
                        />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <FieldLabel>Coeficiente</FieldLabel>
                        <Input
                          type="number"
                          min={0}
                          step="0.0001"
                          placeholder="Ej. 0.0245"
                          value={unitForm.coefficient ?? ""}
                          style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                          onChange={(e) =>
                            updateField("coefficient", e.target.value ? Number(e.target.value) : undefined)
                          }
                        />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <FieldLabel>Módulo de contribución</FieldLabel>
                        <Input
                          type="number"
                          min={0}
                          step="0.0001"
                          placeholder="Opcional"
                          value={unitForm.contributionModule ?? ""}
                          style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                          onChange={(e) =>
                            updateField("contributionModule", e.target.value ? Number(e.target.value) : undefined)
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Owner fields */}
                  <div
                    style={{
                      paddingTop: 20,
                      borderTop: "0.5px solid var(--border)"
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--primary)",
                        letterSpacing: "0.04em",
                        marginBottom: 12
                      }}
                    >
                      PROPIETARIO PRINCIPAL
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: 12
                      }}
                    >
                      <div
                        style={{
                          gridColumn: "1 / -1",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6
                        }}
                      >
                        <FieldLabel>Nombre completo</FieldLabel>
                        <Input
                          placeholder="Nombre del titular principal"
                          value={unitForm.owners[0]?.fullName ?? ""}
                          style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                          onChange={(e) => updatePrimaryOwnerField("fullName", e.target.value)}
                        />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <FieldLabel>Tipo de documento</FieldLabel>
                        <select
                          value={unitForm.owners[0]?.documentType ?? ""}
                          style={selectStyle}
                          onChange={(e) =>
                            updatePrimaryOwnerField("documentType", e.target.value || undefined)
                          }
                        >
                          <option value="">Selecciona una opción</option>
                          {documentTypeOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <FieldLabel>Número de documento</FieldLabel>
                        <Input
                          value={unitForm.owners[0]?.document ?? ""}
                          style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                          onChange={(e) => updatePrimaryOwnerField("document", e.target.value)}
                        />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <FieldLabel>Correo electrónico</FieldLabel>
                        <Input
                          type="email"
                          placeholder="correo@ejemplo.com"
                          value={unitForm.owners[0]?.email ?? ""}
                          style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                          onChange={(e) => updatePrimaryOwnerField("email", e.target.value)}
                        />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <FieldLabel>Teléfono</FieldLabel>
                        <Input
                          placeholder="+57 300 000 0000"
                          value={unitForm.owners[0]?.phone ?? ""}
                          style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                          onChange={(e) => updatePrimaryOwnerField("phone", e.target.value)}
                        />
                      </div>

                      <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <ToggleCheckbox
                          label="Este titular puede votar en asamblea"
                          checked={unitForm.owners[0]?.canVote ?? true}
                          onChange={(v) => updatePrimaryOwnerField("canVote", v)}
                        />
                        <ToggleCheckbox
                          label="Este titular recibirá convocatorias"
                          checked={unitForm.owners[0]?.receivesInvitations ?? true}
                          onChange={(v) => updatePrimaryOwnerField("receivesInvitations", v)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Error */}
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
                      <AlertCircle
                        size={13}
                        style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }}
                      />
                      <span style={{ fontSize: 12, color: "var(--danger)" }}>{error}</span>
                    </div>
                  )}

                  {/* Submit */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: 16,
                      borderTop: "0.5px solid var(--border)"
                    }}
                  >
                    <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>
                      Después de guardar, el formulario se limpia para la siguiente unidad.
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      {property && existingUnits > 0 && (
                        <Link
                          to={`/unidades?propertyId=${property.id}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "8px 14px",
                            backgroundColor: "var(--secondary)",
                            color: "var(--secondary-foreground)",
                            borderRadius: 7,
                            fontSize: 12,
                            fontWeight: 500,
                            textDecoration: "none"
                          }}
                        >
                          Ver lista
                          <ArrowRight size={12} />
                        </Link>
                      )}
                      <Button
                        type="submit"
                        disabled={isSubmitting || isLoading}
                        style={{
                          backgroundColor: "var(--primary)",
                          color: "#FFFFFF",
                          borderRadius: 7,
                          fontSize: 13,
                          fontWeight: 500,
                          height: 38
                        }}
                      >
                        {isSubmitting ? "Guardando..." : "Guardar unidad"}
                      </Button>
                    </div>
                  </div>
                </form>
              </motion.div>
            ) : null}
          </div>
        )}
      </div>
    </PlatformShell>
  );
}
