import { useEffect, useState } from "react";
import { LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchCommunicationTemplates,
  upsertCommunicationTemplate,
  deleteCommunicationTemplate
} from "../../lib/api";

export function TemplatesPanel(props: { propertyId: string | null }) {
  const [templates, setTemplates] = useState<
    Array<{ id: string; templateKey: string; channel: string; name: string; bodyTemplate: string; subjectTemplate: string | null }>
  >([]);
  const [templateKey, setTemplateKey] = useState("convocatoria_formal");
  const [channel, setChannel] = useState("email");
  const [tplName, setTplName] = useState("Convocatoria formal");
  const [subject, setSubject] = useState("Asamblea {{fecha}} — {{copropiedad}}");
  const [body, setBody] = useState(
    "Hola {{nombre}},\n\nUnidad {{unidad}}. Enlace: {{link}}\n\n— {{remitente}}"
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function reload() {
    if (!props.propertyId) return;
    fetchCommunicationTemplates(props.propertyId)
      .then((r) =>
        setTemplates(
          r.templates.map((t) => {
            const row = t as Record<string, unknown>;
            return {
              id: String(row.id),
              templateKey: String(row.templateKey),
              channel: String(row.channel),
              name: String(row.name),
              bodyTemplate: String(row.bodyTemplate ?? ""),
              subjectTemplate: row.subjectTemplate != null ? String(row.subjectTemplate) : null
            };
          })
        )
      )
      .catch(() => setTemplates([]));
  }

  useEffect(() => {
    reload();
  }, [props.propertyId]);

  if (!props.propertyId) return null;

  async function handleSave() {
    setBusy(true);
    setError("");
    try {
      await upsertCommunicationTemplate(props.propertyId!, {
        templateKey,
        channel,
        name: tplName,
        subjectTemplate: subject,
        bodyTemplate: body
      });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-base" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <LayoutTemplate size={14} style={{ color: "var(--primary)" }} />
        <h2 className="text-subtitle">Plantillas</h2>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
        Variables sugeridas: <code>{"{{nombre}} {{unidad}} {{fecha}} {{hora}} {{link}} {{remitente}}"}</code> — el render final llegará en la capa de envío.
      </p>
      {error && <p style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <Label style={{ fontSize: 11 }}>templateKey</Label>
          <Input value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} style={{ marginTop: 6, borderRadius: 7, fontSize: 13 }} />
        </div>
        <div>
          <Label style={{ fontSize: 11 }}>Canal</Label>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
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
            <option value="email">email</option>
            <option value="sms">sms</option>
            <option value="whatsapp">whatsapp</option>
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <Label style={{ fontSize: 11 }}>Nombre visible</Label>
          <Input value={tplName} onChange={(e) => setTplName(e.target.value)} style={{ marginTop: 6, borderRadius: 7, fontSize: 13 }} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <Label style={{ fontSize: 11 }}>Asunto (email)</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} style={{ marginTop: 6, borderRadius: 7, fontSize: 13 }} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <Label style={{ fontSize: 11 }}>Cuerpo</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} style={{ marginTop: 6, borderRadius: 7, fontSize: 13 }} />
        </div>
      </div>

      <Button type="button" disabled={busy} onClick={() => void handleSave()} style={{ borderRadius: 7, marginBottom: 24 }}>
        Guardar plantilla
      </Button>

      <div style={{ fontSize: 12 }}>
        <span className="text-label" style={{ display: "block", marginBottom: 8 }}>
          Guardadas
        </span>
        {templates.length === 0 ? (
          <span style={{ color: "var(--text-secondary)" }}>Ninguna aún.</span>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {templates.map((t) => (
              <li
                key={t.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderTop: "0.5px solid var(--border)"
                }}
              >
                <span>
                  <strong>{t.name}</strong> · {t.templateKey} · {t.channel}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    void deleteCommunicationTemplate(props.propertyId!, t.id).then(reload).catch(() => {})
                  }
                >
                  Eliminar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
