import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { fetchCommunicationDeliveries } from "../../lib/api";

export function DeliveriesPanel(props: { propertyId: string | null }) {
  const [rows, setRows] = useState<
    Array<{
      id: string;
      channel: string;
      status: string;
      providerType: string;
      trackingToken: string | null;
      providerMessageId: string | null;
      sentAt: string | null;
      createdAt: string;
      campaign: { id: string; name: string; purpose: string } | null;
    }>
  >([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!props.propertyId) return;
    fetchCommunicationDeliveries(props.propertyId, 80)
      .then((r) =>
        setRows(
          (r.deliveries as Array<Record<string, unknown>>).map((d) => ({
            id: String(d.id),
            channel: String(d.channel),
            status: String(d.status),
            providerType: String(d.providerType),
            trackingToken: d.trackingToken ? String(d.trackingToken) : null,
            providerMessageId: d.providerMessageId ? String(d.providerMessageId) : null,
            sentAt: d.sentAt ? String(d.sentAt) : null,
            createdAt: String(d.createdAt),
            campaign: d.campaign
              ? (d.campaign as { id: string; name: string; purpose: string })
              : null
          }))
        )
      )
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [props.propertyId]);

  if (!props.propertyId) return null;

  return (
    <div className="card-base" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Truck size={14} style={{ color: "var(--primary)" }} />
        <h2 className="text-subtitle">Entregas y trazabilidad</h2>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
        Últimas entregas registradas. Los webhooks del proveedor actualizarán estados (ver endpoint de integración).
      </p>
      {error && <p style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>}
      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Sin envíos aún.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--text-secondary)" }}>
                <th style={{ padding: "6px" }}>Canal</th>
                <th style={{ padding: "6px" }}>Estado</th>
                <th style={{ padding: "6px" }}>Proveedor</th>
                <th style={{ padding: "6px" }}>Campaña</th>
                <th style={{ padding: "6px" }}>Tracking</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} style={{ borderTop: "0.5px solid var(--border)" }}>
                  <td style={{ padding: "6px" }}>{d.channel}</td>
                  <td style={{ padding: "6px" }}>{d.status}</td>
                  <td style={{ padding: "6px" }}>{d.providerType}</td>
                  <td style={{ padding: "6px" }}>{d.campaign?.name ?? "—"}</td>
                  <td style={{ padding: "6px", fontFamily: "monospace", fontSize: 11 }}>
                    {(d.trackingToken ?? d.providerMessageId ?? "—").toString().slice(0, 18)}…
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
