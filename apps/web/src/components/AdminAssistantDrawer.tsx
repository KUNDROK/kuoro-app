import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { AdminAssistantClientMessage } from "@kuoro/contracts";
import { postAdminAssistantChat } from "../lib/api";

export type AdminAssistantScope = {
  propertyId?: string;
  assemblyId?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  scope?: AdminAssistantScope;
  starterSuggestions?: string[];
};

export function AdminAssistantDrawer({ open, onClose, scope, starterSuggestions }: Props) {
  const [messages, setMessages] = useState<AdminAssistantClientMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextUser: AdminAssistantClientMessage = { role: "user", content: trimmed };
    const history = [...messages, nextUser];
    setMessages(history);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const res = await postAdminAssistantChat({
        messages: history,
        propertyId: scope?.propertyId,
        assemblyId: scope?.assemblyId,
      });
      setMessages([...history, { role: "assistant", content: res.message.content }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al contactar el asistente";
      setError(msg);
      setMessages(history);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar asistente"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 90,
          border: "none",
          margin: 0,
          padding: 0,
          backgroundColor: "rgba(15, 18, 28, 0.45)",
          cursor: "pointer",
        }}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="kuoro-ia-title"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(420px, 100vw)",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--card)",
          borderLeft: "0.5px solid var(--border)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "0.5px solid var(--border)",
          }}
        >
          <div>
            <div id="kuoro-ia-title" style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
              Kuoro IA
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
              Asistente para administradores
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "0.5px solid var(--border)",
              backgroundColor: "var(--background)",
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {(scope?.propertyId || scope?.assemblyId) && (
          <div
            style={{
              fontSize: 10,
              color: "var(--text-tertiary)",
              padding: "8px 16px",
              borderBottom: "0.5px solid var(--border)",
              lineHeight: 1.4,
            }}
          >
            {scope?.propertyId ? `Copropiedad: ${scope.propertyId.slice(0, 8)}…` : null}
            {scope?.propertyId && scope?.assemblyId ? " · " : null}
            {scope?.assemblyId ? `Asamblea: ${scope.assemblyId.slice(0, 8)}…` : null}
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Puedo consultar en tu cuenta: copropiedades, unidades y propietarios, asambleas, agenda y diapositivas,
              invitaciones y accesos, eventos de sala, votaciones y representaciones. También puedo orientar sobre
              marco PH en Colombia y borradores de acta (siempre sujetos a revisión profesional).
            </div>
          )}

          {messages.length === 0 && starterSuggestions && starterSuggestions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                Sugerencias
              </span>
              {starterSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  disabled={loading}
                  style={{
                    textAlign: "left",
                    fontSize: 12,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "0.5px solid var(--border)",
                    backgroundColor: "var(--muted)",
                    color: "var(--foreground)",
                    cursor: loading ? "wait" : "pointer",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "92%",
                padding: "10px 12px",
                borderRadius: 10,
                fontSize: 13,
                lineHeight: 1.45,
                whiteSpace: "pre-wrap",
                backgroundColor: m.role === "user" ? "var(--primary)" : "var(--muted)",
                color: m.role === "user" ? "#fff" : "var(--foreground)",
              }}
            >
              {m.content}
            </div>
          ))}

          {loading && (
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic" }}>Pensando…</div>
          )}

          {error ? (
            <div
              style={{
                fontSize: 12,
                color: "var(--danger)",
                padding: "8px 10px",
                borderRadius: 8,
                backgroundColor: "var(--danger-surface)",
                border: "0.5px solid var(--danger)",
              }}
            >
              {error}
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>

        <div style={{ padding: "12px 16px 16px", borderTop: "0.5px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Escribe tu pregunta…"
              rows={2}
              disabled={loading}
              style={{
                flex: 1,
                resize: "none",
                borderRadius: 8,
                border: "0.5px solid var(--border)",
                padding: "8px 10px",
                fontSize: 13,
                fontFamily: "inherit",
                backgroundColor: "var(--background)",
                color: "var(--foreground)",
              }}
            />
            <button
              type="button"
              disabled={loading || !input.trim()}
              onClick={() => void send(input)}
              style={{
                alignSelf: "flex-end",
                padding: "0 14px",
                height: 36,
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 500,
                backgroundColor: "var(--primary)",
                color: "#fff",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                opacity: loading || !input.trim() ? 0.5 : 1,
              }}
            >
              Enviar
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
