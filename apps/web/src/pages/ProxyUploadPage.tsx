import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle, FileText, Upload, Building2 } from "lucide-react";
import type { ProxyRequestPublicSummary } from "@kuoro/contracts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchPublicProxyRequest, submitPublicProxyRequest } from "../lib/api";

type SenderRole = "propietario" | "copropietario" | "apoderado" | "otro";

const senderRoleOptions: Array<{ value: SenderRole; label: string }> = [
  { value: "propietario", label: "Propietario" },
  { value: "copropietario", label: "Copropietario" },
  { value: "apoderado", label: "Apoderado" },
  { value: "otro", label: "Otro" }
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

function statusPillStyle(
  status: ProxyRequestPublicSummary["proxyApprovalStatus"] | undefined
): React.CSSProperties {
  if (status === "approved")
    return {
      backgroundColor: "var(--success-surface)",
      color: "var(--success)",
      border: "0.5px solid var(--success)"
    };
  if (status === "rejected")
    return {
      backgroundColor: "var(--danger-surface)",
      color: "var(--danger)",
      border: "0.5px solid var(--danger)"
    };
  if (status === "pending_review")
    return {
      backgroundColor: "var(--warning-surface)",
      color: "var(--warning)",
      border: "0.5px solid var(--warning)"
    };
  return {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
    border: "0.5px solid var(--primary)"
  };
}

function statusLabel(status: ProxyRequestPublicSummary["proxyApprovalStatus"] | undefined) {
  if (status === "approved") return "Poder aprobado";
  if (status === "rejected") return "Poder rechazado";
  if (status === "pending_review") return "Pendiente de revisión";
  return "Pendiente de envío";
}

export function ProxyUploadPage() {
  const { token } = useParams();
  const [request, setRequest] = useState<ProxyRequestPublicSummary | null>(null);
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderRole, setSenderRole] = useState<SenderRole>("propietario");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("El enlace de cargue no es válido o está incompleto.");
      setIsLoading(false);
      return;
    }

    fetchPublicProxyRequest(token)
      .then((response) => setRequest(response.request))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "No fue posible cargar la solicitud");
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) return;

    if (!senderName.trim()) {
      setError("Debes indicar quién está enviando el poder");
      return;
    }
    if (!selectedFile) {
      setError("Debes adjuntar el poder");
      return;
    }

    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(selectedFile);
    });

    setError("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      await submitPublicProxyRequest(token, {
        senderName: senderName.trim(),
        senderEmail: senderEmail.trim() || undefined,
        senderRole,
        proxyDocumentName: selectedFile.name,
        proxyDocumentMimeType: selectedFile.type || "application/octet-stream",
        proxyDocumentData: data
      });

      const refreshed = await fetchPublicProxyRequest(token);
      setRequest(refreshed.request);
      setSuccessMessage("El poder fue enviado correctamente y quedó pendiente de revisión.");
      setSelectedFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible enviar el poder");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--canvas)",
        display: "flex",
        flexDirection: "column"
      }}
    >
      {/* Header */}
      <header
        style={{
          height: 56,
          backgroundColor: "var(--card)",
          borderBottom: "0.5px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              backgroundColor: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                border: "2px solid rgba(255,255,255,0.9)",
                borderRadius: 2,
                transform: "rotate(45deg)"
              }}
            />
          </div>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--foreground)",
              letterSpacing: "-0.01em"
            }}
          >
            Kuoro
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {token && (
            <Link
              to={`/documento/${token}`}
              style={{
                fontSize: 12,
                color: "var(--primary)",
                textDecoration: "none",
                padding: "5px 10px",
                borderRadius: 6,
                border: "0.5px solid var(--primary)"
              }}
            >
              Ver estado de la solicitud
            </Link>
          )}
          <Link
            to="/"
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              textDecoration: "none",
              padding: "5px 10px",
              borderRadius: 6,
              border: "0.5px solid var(--border)"
            }}
          >
            Ir al inicio
          </Link>
        </div>
      </header>

      {/* Content */}
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "40px 28px"
        }}
      >
        <div style={{ width: "100%", maxWidth: 640 }}>
          {/* Loading */}
          {isLoading && (
            <div
              className="card-base"
              style={{ padding: 48, textAlign: "center" }}
            >
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Cargando solicitud de poder...
              </p>
            </div>
          )}

          {/* Error sin request */}
          {!isLoading && error && !request && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="card-base" style={{ padding: 32 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    backgroundColor: "var(--danger-surface)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16
                  }}
                >
                  <AlertCircle size={20} style={{ color: "var(--danger)" }} />
                </div>
                <h2
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    color: "var(--foreground)",
                    margin: "0 0 8px"
                  }}
                >
                  No fue posible abrir esta solicitud
                </h2>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--danger)",
                    margin: "0 0 24px",
                    lineHeight: 1.6
                  }}
                >
                  {error}
                </p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    padding: "16px 0",
                    borderTop: "0.5px solid var(--border)"
                  }}
                >
                  {[
                    {
                      title: "¿Qué puede estar pasando?",
                      text: "El enlace puede estar incompleto, vencido o asociado a un apoderado que ya no existe en la unidad."
                    },
                    {
                      title: "¿Qué debes hacer?",
                      text: "Solicita al administrador que te comparta nuevamente el enlace de cargue del poder."
                    }
                  ].map((item) => (
                    <div key={item.title}>
                      <p
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: "var(--foreground)",
                          margin: "0 0 4px"
                        }}
                      >
                        {item.title}
                      </p>
                      <p
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          margin: 0,
                          lineHeight: 1.6
                        }}
                      >
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Request loaded */}
          {request && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              {/* Context card */}
              <div className="card-base" style={{ padding: 24 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 16,
                    marginBottom: 20
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6
                      }}
                    >
                      <Building2 size={14} style={{ color: "var(--text-secondary)" }} />
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {request.propertyName}
                      </span>
                    </div>
                    <h1
                      style={{
                        fontSize: 20,
                        fontWeight: 500,
                        letterSpacing: "-0.02em",
                        color: "var(--foreground)",
                        margin: "0 0 4px"
                      }}
                    >
                      {request.unitLabel}
                    </h1>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                      Apoderado registrado: <strong style={{ color: "var(--foreground)" }}>{request.ownerName}</strong>
                    </p>
                  </div>
                  <div
                    style={{
                      padding: "4px 12px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      ...statusPillStyle(request.proxyApprovalStatus)
                    }}
                  >
                    {statusLabel(request.proxyApprovalStatus)}
                  </div>
                </div>

                {/* Rejection reasons */}
                {request.proxyRejectionReasons?.length ? (
                  <div
                    style={{
                      padding: "12px 14px",
                      backgroundColor: "var(--danger-surface)",
                      borderRadius: 7,
                      border: "0.5px solid var(--danger)",
                      marginBottom: 20
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8
                      }}
                    >
                      <AlertCircle
                        size={13}
                        style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }}
                      />
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--danger)", margin: "0 0 4px" }}>
                          Motivos de rechazo
                        </p>
                        <p style={{ fontSize: 12, color: "var(--danger)", margin: 0, lineHeight: 1.6 }}>
                          {request.proxyRejectionReasons.join(" · ")}
                          {request.proxyRejectionNote ? ` — ${request.proxyRejectionNote}` : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Info items */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    padding: "16px 0",
                    borderTop: "0.5px solid var(--border)"
                  }}
                >
                  {[
                    {
                      title: "¿Qué debes hacer?",
                      text: "Adjunta el poder firmado correspondiente a la copropiedad y a la unidad indicadas en esta página."
                    },
                    {
                      title: "¿Quién puede enviarlo?",
                      text: "El poder lo puede enviar el propietario, un copropietario o el mismo apoderado."
                    }
                  ].map((item) => (
                    <div key={item.title} style={{ display: "flex", gap: 12 }}>
                      <div
                        className="nav-dot"
                        style={{
                          backgroundColor: "var(--primary)",
                          marginTop: 5,
                          flexShrink: 0
                        }}
                      />
                      <div>
                        <p
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: "var(--foreground)",
                            margin: "0 0 2px"
                          }}
                        >
                          {item.title}
                        </p>
                        <p
                          style={{
                            fontSize: 12,
                            color: "var(--text-secondary)",
                            margin: 0,
                            lineHeight: 1.6
                          }}
                        >
                          {item.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form card */}
              <div className="card-base" style={{ padding: 24 }}>
                <h2
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--foreground)",
                    margin: "0 0 4px"
                  }}
                >
                  Enviar o reenviar poder
                </h2>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    margin: "0 0 20px",
                    lineHeight: 1.6
                  }}
                >
                  Completa los datos de quien remite el documento y adjunta el archivo del poder en PDF o imagen.
                </p>

                {/* Success */}
                <AnimatePresence>
                  {successMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        padding: "10px 14px",
                        backgroundColor: "var(--success-surface)",
                        borderRadius: 7,
                        border: "0.5px solid var(--success)",
                        marginBottom: 16
                      }}
                    >
                      <CheckCircle size={13} style={{ color: "var(--success)", flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 12, color: "var(--success)" }}>{successMessage}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <FieldLabel>Nombre de quien envía</FieldLabel>
                      <Input
                        placeholder="Nombre completo"
                        value={senderName}
                        style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                        onChange={(e) => setSenderName(e.target.value)}
                      />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <FieldLabel>Correo de contacto (opcional)</FieldLabel>
                      <Input
                        type="email"
                        placeholder="correo@ejemplo.com"
                        value={senderEmail}
                        style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                        onChange={(e) => setSenderEmail(e.target.value)}
                      />
                    </div>

                    <div
                      style={{
                        gridColumn: "1 / -1",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6
                      }}
                    >
                      <FieldLabel>¿Quién envía el poder?</FieldLabel>
                      <select
                        value={senderRole}
                        style={selectStyle}
                        onChange={(e) => setSenderRole(e.target.value as SenderRole)}
                      >
                        {senderRoleOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* File upload */}
                  <div>
                    <FieldLabel>Adjuntar poder</FieldLabel>
                    <label
                      htmlFor="proxy-file"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        padding: "28px 20px",
                        borderRadius: 7,
                        border: `0.5px dashed ${selectedFile ? "var(--primary)" : "var(--border)"}`,
                        backgroundColor: selectedFile ? "var(--accent)" : "transparent",
                        cursor: "pointer"
                      }}
                    >
                      {selectedFile ? (
                        <>
                          <FileText size={20} style={{ color: "var(--primary)" }} />
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              color: "var(--accent-foreground)"
                            }}
                          >
                            {selectedFile.name}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--text-secondary)"
                            }}
                          >
                            Haz clic para cambiar el archivo
                          </span>
                        </>
                      ) : (
                        <>
                          <Upload size={20} style={{ color: "var(--text-tertiary)" }} />
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              color: "var(--foreground)"
                            }}
                          >
                            Seleccionar archivo
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--text-tertiary)"
                            }}
                          >
                            PDF, JPG, JPEG, PNG o WEBP
                          </span>
                        </>
                      )}
                    </label>
                    <input
                      id="proxy-file"
                      name="proxy-file"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      style={{ display: "none" }}
                      onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                    />
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

                  <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      style={{
                        backgroundColor: "var(--primary)",
                        color: "#FFFFFF",
                        borderRadius: 7,
                        fontSize: 13,
                        fontWeight: 500,
                        height: 38
                      }}
                    >
                      {isSubmitting ? "Enviando..." : "Enviar poder"}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
