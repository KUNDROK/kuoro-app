/**
 * Panel de debug de conferencia — solo visible en modo desarrollo.
 *
 * Muestra en tiempo real:
 *   - Identidad y rol del participante
 *   - URL de LiveKit que usa el cliente
 *   - Estado de conexión de la room
 *   - Permisos de publicación actuales
 *   - Orador actual y tiempo restante
 *   - Estado de la sesión de votación activa
 *   - Log de eventos recientes (token emitido, conexión, permisos, etc.)
 *
 * Uso: montar dentro de <LiveKitRoom> o fuera.
 * Cuando está fuera de un LiveKitRoom, algunos estados de room no están disponibles.
 */

import { useEffect, useState, useCallback } from "react";

interface ConferenceDebugPanelProps {
  accessToken?:        string;
  participantIdentity: string;
  displayName:         string;
  assemblyId:          string;
  propertyId:          string;
  unitLabel?:          string;
  representationType?: string;
  mode:                "admin" | "attendee";
  /** Estado de conexión del LiveKitRoom (si está disponible) */
  connectionState?:    string;
  /** Permisos del participante local */
  canPublish?:         boolean;
  canPublishSources?:  string[];
  /** Orador activo */
  speakerIdentity?:    string;
  secondsLeft?:        number;
  /** Estado de votación */
  votingStatus?:       string;
  votingQuestion?:     string;
}

type LogEntry = {
  ts:      string;
  level:   "info" | "ok" | "warn" | "error";
  message: string;
};

const MAX_LOG = 40;

// Singleton de logs para que persistan entre re-renders
const globalLogs: LogEntry[] = [];

export function debugLog(level: LogEntry["level"], message: string) {
  const ts = new Date().toLocaleTimeString("es-CO", { hour12: false });
  globalLogs.unshift({ ts, level, message });
  if (globalLogs.length > MAX_LOG) globalLogs.length = MAX_LOG;
  // Emitir evento para que el panel se actualice
  window.dispatchEvent(new CustomEvent("debug-log", { detail: { ts, level, message } }));
}

const LEVEL_COLORS: Record<LogEntry["level"], string> = {
  info:  "#94a3b8",
  ok:    "#22c55e",
  warn:  "#f59e0b",
  error: "#ef4444",
};

export function ConferenceDebugPanel({
  accessToken,
  participantIdentity,
  displayName,
  assemblyId,
  propertyId,
  unitLabel,
  representationType,
  mode,
  connectionState,
  canPublish,
  canPublishSources,
  speakerIdentity,
  secondsLeft,
  votingStatus,
  votingQuestion,
}: ConferenceDebugPanelProps) {
  const [logs, setLogs]     = useState<LogEntry[]>([...globalLogs]);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(() => setLogs([...globalLogs]), []);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("debug-log", handler);
    return () => window.removeEventListener("debug-log", handler);
  }, [refresh]);

  const copyToken = async () => {
    if (!accessToken) return;
    await navigator.clipboard.writeText(accessToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const livekitUrl = import.meta.env.VITE_LIVEKIT_URL ?? "(desde backend)";

  return (
    <div className="dbg-panel">
      <div className="dbg-panel__header">
        <span className="dbg-panel__title">🛠 Debug — {mode === "admin" ? "Admin" : "Asistente"}</span>
        <button className="dbg-panel__clear" onClick={() => { globalLogs.length = 0; refresh(); }}>
          Limpiar
        </button>
      </div>

      <div className="dbg-panel__grid">
        {/* Identidad */}
        <div className="dbg-panel__section">
          <div className="dbg-panel__section-title">Identidad</div>
          <div className="dbg-panel__row"><span>Nombre:</span><span>{displayName}</span></div>
          <div className="dbg-panel__row"><span>Identity:</span><code>{participantIdentity}</code></div>
          <div className="dbg-panel__row"><span>Modo:</span><span>{mode}</span></div>
          {representationType && (
            <div className="dbg-panel__row"><span>Rol rep.:</span><span>{representationType}</span></div>
          )}
          {unitLabel && (
            <div className="dbg-panel__row"><span>Unidad:</span><span>{unitLabel}</span></div>
          )}
        </div>

        {/* Contexto */}
        <div className="dbg-panel__section">
          <div className="dbg-panel__section-title">Contexto</div>
          <div className="dbg-panel__row"><span>Property:</span><code>{propertyId.slice(0, 8)}…</code></div>
          <div className="dbg-panel__row"><span>Assembly:</span><code>{assemblyId.slice(0, 8)}…</code></div>
          <div className="dbg-panel__row"><span>LiveKit URL:</span><code style={{ fontSize: 10 }}>{livekitUrl}</code></div>
        </div>

        {/* Conexión */}
        <div className="dbg-panel__section">
          <div className="dbg-panel__section-title">Conexión</div>
          <div className="dbg-panel__row">
            <span>Estado:</span>
            <span className={`dbg-badge ${connectionState === "connected" ? "dbg-badge--ok" : connectionState ? "dbg-badge--warn" : "dbg-badge--muted"}`}>
              {connectionState ?? "—"}
            </span>
          </div>
          <div className="dbg-panel__row">
            <span>canPublish:</span>
            <span className={`dbg-badge ${canPublish ? "dbg-badge--ok" : "dbg-badge--muted"}`}>
              {canPublish === undefined ? "—" : canPublish ? "sí" : "no"}
            </span>
          </div>
          {canPublishSources && canPublishSources.length > 0 && (
            <div className="dbg-panel__row">
              <span>Fuentes:</span>
              <span>{canPublishSources.join(", ")}</span>
            </div>
          )}
        </div>

        {/* Orador */}
        <div className="dbg-panel__section">
          <div className="dbg-panel__section-title">Orador activo</div>
          <div className="dbg-panel__row">
            <span>Identity:</span>
            <code>{speakerIdentity ?? "ninguno"}</code>
          </div>
          {secondsLeft !== undefined && secondsLeft > 0 && (
            <div className="dbg-panel__row">
              <span>Tiempo restante:</span>
              <span className="dbg-badge dbg-badge--warn">{secondsLeft}s</span>
            </div>
          )}
        </div>

        {/* Votación */}
        <div className="dbg-panel__section">
          <div className="dbg-panel__section-title">Votación</div>
          <div className="dbg-panel__row">
            <span>Estado:</span>
            <span className={`dbg-badge ${votingStatus === "open" ? "dbg-badge--ok" : votingStatus ? "dbg-badge--muted" : "dbg-badge--muted"}`}>
              {votingStatus ?? "sin sesión"}
            </span>
          </div>
          {votingQuestion && (
            <div className="dbg-panel__row">
              <span>Pregunta:</span>
              <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{votingQuestion}</span>
            </div>
          )}
        </div>

        {/* Token */}
        {accessToken && (
          <div className="dbg-panel__section">
            <div className="dbg-panel__section-title">Access Token</div>
            <div className="dbg-panel__row">
              <code style={{ fontSize: 10, wordBreak: "break-all" }}>{accessToken.slice(0, 24)}…</code>
              <button className="dbg-panel__copy-btn" onClick={() => void copyToken()}>
                {copied ? "✓" : "Copiar"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log de eventos */}
      <div className="dbg-panel__log-header">
        <span>Eventos ({logs.length})</span>
      </div>
      <div className="dbg-panel__log">
        {logs.length === 0 && (
          <div className="dbg-panel__log-empty">Sin eventos aún.</div>
        )}
        {logs.map((entry, i) => (
          <div key={i} className="dbg-panel__log-entry">
            <span className="dbg-panel__log-ts">{entry.ts}</span>
            <span
              className="dbg-panel__log-msg"
              style={{ color: LEVEL_COLORS[entry.level] }}
            >
              {entry.level !== "info" && `[${entry.level.toUpperCase()}] `}{entry.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
