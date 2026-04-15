import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, Building2, CheckCircle, Clock, FileText } from "lucide-react";
import { fetchPublicDocumentRequest } from "../lib/api";
import { Button } from "@/components/ui/button";

export function DocumentRequestStatusPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPublicDocumentRequest>> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    fetchPublicDocumentRequest(token)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "No encontrado"));
  }, [token]);

  if (!token) {
    return <p style={{ padding: 24 }}>Token inválido</p>;
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card-base" style={{ maxWidth: 420, padding: 24 }}>
          <AlertCircle size={20} style={{ color: "var(--danger)" }} />
          <p style={{ marginTop: 12, fontSize: 14 }}>{error}</p>
          <Link to="/" style={{ fontSize: 13, color: "var(--primary)" }}>
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>Cargando…</span>
      </div>
    );
  }

  const { documentRequest: dr, property, owner, unitLabel, submissions, reviews, legacyProxyStatus } = data;
  const effectiveStatus =
    dr.kind === "proxy_power" && legacyProxyStatus
      ? legacyProxyStatus.proxyApprovalStatus
      : dr.status;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--background)",
        padding: 24,
        maxWidth: 720,
        margin: "0 auto"
      }}
    >
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Building2 size={22} style={{ color: "var(--primary)" }} />
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: "var(--foreground)" }}>Estado de solicitud</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>{property.name}</p>
          </div>
        </div>

        <div className="card-base" style={{ padding: 22, marginBottom: 16 }}>
          <span className="text-label">Documento solicitado</span>
          <p style={{ fontSize: 15, fontWeight: 500, margin: "8px 0 4px" }}>{dr.title ?? dr.kind}</p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>{dr.instructions}</p>
          <div style={{ marginTop: 14, fontSize: 13 }}>
            <strong>{owner.fullName}</strong>
            {unitLabel ? ` · ${unitLabel}` : ""}
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 14,
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              backgroundColor: "var(--accent)",
              color: "var(--accent-foreground)"
            }}
          >
            {effectiveStatus === "approved" ? <CheckCircle size={14} /> : <Clock size={14} />}
            {effectiveStatus}
          </div>
        </div>

        {dr.kind === "proxy_power" &&
          ["awaiting_upload", "not_required", "rejected"].includes(effectiveStatus) && (
          <div className="card-base" style={{ padding: 22, marginBottom: 16 }}>
            <FileText size={16} style={{ color: "var(--primary)" }} />
            <p style={{ fontSize: 13, marginTop: 8 }}>Para adjuntar o corregir el poder, usa el formulario seguro:</p>
            <Link to={`/poder/${token}`}>
              <Button style={{ marginTop: 12, backgroundColor: "var(--primary)", color: "#fff", borderRadius: 7 }}>
                Ir a carga de poder
              </Button>
            </Link>
          </div>
        )}

        {legacyProxyStatus?.proxyApprovalStatus === "rejected" && (
          <div className="card-base" style={{ padding: 22, marginBottom: 16, borderColor: "var(--danger)" }}>
            <span className="text-label" style={{ color: "var(--danger)" }}>
              Motivos de rechazo
            </span>
            <ul style={{ fontSize: 13, margin: "8px 0 0", paddingLeft: 18 }}>
              {legacyProxyStatus.proxyRejectionReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {legacyProxyStatus.proxyRejectionNote && (
              <p style={{ fontSize: 13, marginTop: 8 }}>{legacyProxyStatus.proxyRejectionNote}</p>
            )}
          </div>
        )}

        <div className="card-base" style={{ padding: 22, marginBottom: 16 }}>
          <span className="text-label">Historial de envíos</span>
          {submissions.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>Sin archivos aún.</p>
          ) : (
            <ul style={{ fontSize: 13, margin: "10px 0 0", padding: 0, listStyle: "none" }}>
              {submissions.map((s) => (
                <li key={s.id} style={{ padding: "6px 0", borderTop: "0.5px solid var(--border)" }}>
                  {s.fileName} · {new Date(s.submittedAt).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-base" style={{ padding: 22 }}>
          <span className="text-label">Historial de revisiones</span>
          {reviews.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>Sin revisiones registradas.</p>
          ) : (
            <ul style={{ fontSize: 13, margin: "10px 0 0", padding: 0, listStyle: "none" }}>
              {reviews.map((r) => (
                <li key={r.id} style={{ padding: "8px 0", borderTop: "0.5px solid var(--border)" }}>
                  <strong>{r.action}</strong> · {new Date(r.createdAt).toLocaleString()}
                  {r.reasons.length ? ` — ${r.reasons.join(", ")}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p style={{ marginTop: 24, fontSize: 12, color: "var(--text-tertiary)" }}>
          <Link to="/" style={{ color: "var(--primary)" }}>
            ← Inicio
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
