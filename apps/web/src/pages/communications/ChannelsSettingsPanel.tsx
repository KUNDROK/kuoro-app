import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchCommunicationSettings, saveCommunicationSettings, type CommunicationSettingsDTO } from "../../lib/api";

export function ChannelsSettingsPanel(props: { propertyId: string | null }) {
  const [settings, setSettings] = useState<CommunicationSettingsDTO | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!props.propertyId) return;
    fetchCommunicationSettings(props.propertyId)
      .then((r) => setSettings(r.settings))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [props.propertyId]);

  if (!props.propertyId) return null;

  async function handleSave() {
    if (!settings || !props.propertyId) return;
    setSaving(true);
    setError("");
    try {
      const r = await saveCommunicationSettings(props.propertyId, {
        countryCode: settings.countryCode,
        locale: settings.locale,
        enabledChannels: settings.enabledChannels,
        emailEnabled: settings.emailEnabled,
        smsEnabled: settings.smsEnabled,
        whatsappEnabled: settings.whatsappEnabled,
        defaultChannelsByUseCase: settings.defaultChannelsByUseCase,
        fallbackChannel: settings.fallbackChannel,
        senderDisplayName: settings.senderDisplayName,
        senderEmailFrom: settings.senderEmailFrom,
        senderSmsFrom: settings.senderSmsFrom,
        senderWhatsappFrom: settings.senderWhatsappFrom,
        providerBindings: settings.providerBindings
      });
      setSettings(r.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <div className="card-base" style={{ padding: 24 }}>
        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Cargando configuración…</p>
        {error && <p style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>}
      </div>
    );
  }

  function toggleChannel(ch: "email" | "sms" | "whatsapp") {
    setSettings((s) => {
      if (!s) return s;
      const set = new Set(s.enabledChannels);
      if (set.has(ch)) set.delete(ch);
      else set.add(ch);
      return { ...s, enabledChannels: Array.from(set) as typeof s.enabledChannels };
    });
  }

  return (
    <div className="card-base" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Radio size={14} style={{ color: "var(--primary)" }} />
        <h2 className="text-subtitle">Canales y motor de envío</h2>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 20 }}>
        Activa canales por copropiedad. Los proveedores reales (Resend, Twilio, …) se enlazan en <code>providerBindings</code>;
        en desarrollo se usa el proveedor <strong>console</strong>.
      </p>
      {error && <p style={{ fontSize: 12, color: "var(--danger)", marginBottom: 12 }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div>
          <Label style={{ fontSize: 11 }}>País (preset, ISO)</Label>
          <Input
            value={settings.countryCode}
            onChange={(e) => setSettings({ ...settings, countryCode: e.target.value })}
            style={{ marginTop: 6, borderRadius: 7, fontSize: 13 }}
          />
        </div>
        <div>
          <Label style={{ fontSize: 11 }}>Locale</Label>
          <Input
            value={settings.locale}
            onChange={(e) => setSettings({ ...settings, locale: e.target.value })}
            style={{ marginTop: 6, borderRadius: 7, fontSize: 13 }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <span className="text-label" style={{ display: "block", marginBottom: 8 }}>
          Canales habilitados
        </span>
        <div style={{ display: "flex", gap: 12 }}>
          {(["email", "sms", "whatsapp"] as const).map((ch) => (
            <label key={ch} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={settings.enabledChannels.includes(ch)}
                onChange={() => toggleChannel(ch)}
                style={{ accentColor: "var(--primary)" }}
              />
              {ch}
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div>
          <Label style={{ fontSize: 11 }}>Nombre remitente (mostrado)</Label>
          <Input
            value={settings.senderDisplayName ?? ""}
            onChange={(e) => setSettings({ ...settings, senderDisplayName: e.target.value || null })}
            style={{ marginTop: 6, borderRadius: 7, fontSize: 13 }}
          />
        </div>
        <div>
          <Label style={{ fontSize: 11 }}>Correo remitente (from)</Label>
          <Input
            value={settings.senderEmailFrom ?? ""}
            onChange={(e) => setSettings({ ...settings, senderEmailFrom: e.target.value || null })}
            style={{ marginTop: 6, borderRadius: 7, fontSize: 13 }}
          />
        </div>
      </div>

      <Button
        type="button"
        disabled={saving}
        onClick={() => void handleSave()}
        style={{ backgroundColor: "var(--primary)", color: "#fff", borderRadius: 7 }}
      >
        {saving ? "Guardando…" : "Guardar configuración"}
      </Button>
    </div>
  );
}
