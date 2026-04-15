import { useEffect, useState } from "react";
import { FileStack } from "lucide-react";
import { fetchPropertyDocumentRequests } from "../../lib/api";

export type DocumentRow = {
  id: string;
  kind: string;
  status: string;
  publicToken: string;
  ownerName: string;
  unitLabel: string | null;
  submissionsCount: number;
  reviewsCount: number;
};

export function DocumentRegistryPanel(props: { propertyId: string | null }) {
  const [items, setItems] = useState<DocumentRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!props.propertyId) return;
    setLoading(true);
    fetchPropertyDocumentRequests(props.propertyId)
      .then((r) => setItems(r.documentRequests))
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false));
  }, [props.propertyId]);

  if (!props.propertyId) return null;

  return (
    <div className="card-base" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <FileStack size={14} style={{ color: "var(--primary)" }} />
        <h2 className="text-subtitle">Registro documental</h2>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
        Historial de solicitudes (poder y futuros tipos): envíos, revisiones y trazabilidad por unidad.
      </p>
      {error && <p style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>}
      {loading ? (
        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Cargando…</p>
      ) : items.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Aún no hay solicitudes documentales sincronizadas.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--text-secondary)" }}>
                <th style={{ padding: "8px 6px" }}>Tipo</th>
                <th style={{ padding: "8px 6px" }}>Estado</th>
                <th style={{ padding: "8px 6px" }}>Titular</th>
                <th style={{ padding: "8px 6px" }}>Unidad</th>
                <th style={{ padding: "8px 6px" }}>Envíos</th>
                <th style={{ padding: "8px 6px" }}>Revisiones</th>
                <th style={{ padding: "8px 6px" }}>Enlace público</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} style={{ borderTop: "0.5px solid var(--border)" }}>
                  <td style={{ padding: "8px 6px" }}>{row.kind}</td>
                  <td style={{ padding: "8px 6px" }}>{row.status}</td>
                  <td style={{ padding: "8px 6px" }}>{row.ownerName}</td>
                  <td style={{ padding: "8px 6px" }}>{row.unitLabel ?? "—"}</td>
                  <td style={{ padding: "8px 6px" }}>{row.submissionsCount}</td>
                  <td style={{ padding: "8px 6px" }}>{row.reviewsCount}</td>
                  <td style={{ padding: "8px 6px" }}>
                    <a
                      href={`/documento/${row.publicToken}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--primary)" }}
                    >
                      Ver estado
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
