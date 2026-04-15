import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchCommunicationCampaigns,
  createCommunicationCampaign,
  dispatchCommunicationCampaign
} from "../../lib/api";

export function CampaignsPanel(props: { propertyId: string | null; adminEmail?: string | null }) {
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string; purpose: string; status: string }>>([]);
  const [name, setName] = useState("Convocatoria prueba");
  const [purpose, setPurpose] = useState("convocatoria");
  const [channels, setChannels] = useState("email");
  const [dispatchCampaignId, setDispatchCampaignId] = useState("");
  const [testRecipient, setTestRecipient] = useState(props.adminEmail ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!props.propertyId) return;
    fetchCommunicationCampaigns(props.propertyId)
      .then((r) =>
        setCampaigns(
          r.campaigns.map((c) => {
            const row = c as Record<string, unknown>;
            return {
              id: String(row.id),
              name: String(row.name),
              purpose: String(row.purpose),
              status: String(row.status)
            };
          })
        )
      )
      .catch(() => setCampaigns([]));
  }, [props.propertyId]);

  useEffect(() => {
    if (props.adminEmail) setTestRecipient(props.adminEmail);
  }, [props.adminEmail]);

  if (!props.propertyId) return null;

  async function handleCreate() {
    setBusy(true);
    setError("");
    try {
      const ch = channels.split(",").map((s) => s.trim()).filter(Boolean) as ("email" | "sms" | "whatsapp")[];
      const r = await createCommunicationCampaign(props.propertyId!, {
        name,
        purpose: purpose as "convocatoria" | "reminder" | "document_request" | "ad_hoc" | "custom",
        primaryChannels: ch.length ? ch : ["email"]
      });
      setCampaigns((c) => [{ id: r.campaign.id, name: r.campaign.name, purpose: r.campaign.purpose, status: r.campaign.status }, ...c]);
      setDispatchCampaignId(r.campaign.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDispatch() {
    if (!dispatchCampaignId || !testRecipient.trim()) {
      setError("Selecciona campaña y correo de prueba");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await dispatchCommunicationCampaign(props.propertyId!, dispatchCampaignId, {
        channel: "email",
        testRecipient: testRecipient.trim()
      });
      alert("Envío de prueba ejecutado. Revisa la consola del servidor (proveedor console).");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al despachar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-base" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Megaphone size={14} style={{ color: "var(--primary)" }} />
        <h2 className="text-subtitle">Campañas</h2>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
        Crea borradores y lanza un envío de prueba por el motor multicanal (consola en desarrollo).
      </p>
      {error && <p style={{ fontSize: 12, color: "var(--danger)", marginBottom: 12 }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <Label style={{ fontSize: 11 }}>Nombre</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} style={{ marginTop: 6, borderRadius: 7, fontSize: 13 }} />
        </div>
        <div>
          <Label style={{ fontSize: 11 }}>Propósito</Label>
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            style={{
              marginTop: 6,
              width: "100%",
              height: 36,
              borderRadius: 7,
              border: "0.5px solid var(--border)",
              background: "var(--background)",
              fontSize: 13
            }}
          >
            <option value="convocatoria">convocatoria</option>
            <option value="reminder">reminder</option>
            <option value="document_request">document_request</option>
            <option value="ad_hoc">ad_hoc</option>
            <option value="custom">custom</option>
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <Label style={{ fontSize: 11 }}>Canales (coma: email, sms)</Label>
          <Input value={channels} onChange={(e) => setChannels(e.target.value)} style={{ marginTop: 6, borderRadius: 7, fontSize: 13 }} />
        </div>
      </div>

      <Button type="button" disabled={busy} onClick={() => void handleCreate()} style={{ marginBottom: 24, borderRadius: 7 }}>
        Crear borrador
      </Button>

      <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 16 }}>
        <Label style={{ fontSize: 11 }}>Despacho de prueba</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
          <select
            value={dispatchCampaignId}
            onChange={(e) => setDispatchCampaignId(e.target.value)}
            style={{
              height: 36,
              borderRadius: 7,
              border: "0.5px solid var(--border)",
              background: "var(--background)",
              fontSize: 13
            }}
          >
            <option value="">— Campaña —</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.status})
              </option>
            ))}
          </select>
          <Input
            placeholder="Correo destino prueba"
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
            style={{ borderRadius: 7, fontSize: 13 }}
          />
        </div>
        <Button
          type="button"
          disabled={busy}
          onClick={() => void handleDispatch()}
          style={{ marginTop: 12, backgroundColor: "var(--primary)", color: "#fff", borderRadius: 7 }}
        >
          Enviar prueba (email + console)
        </Button>
      </div>
    </div>
  );
}
