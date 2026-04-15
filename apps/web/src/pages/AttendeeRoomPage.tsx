/**
 * Página de sala para el ASISTENTE / PROPIETARIO.
 *
 * Acceso: /asistente/:propertyId/:assemblyId?token=<accessToken>
 *
 * No requiere autenticación de administrador.
 * El único secreto es el `accessToken` en el parámetro `?token=`.
 *
 * Flujo:
 * 1. Leer `?token=` de la URL → llamar `GET /api/v1/attendee-info?accessToken=`
 * 2. Mostrar pantalla de bienvenida con nombre y unidad representada
 * 3. Al presionar "Unirse a la sala", pedir nombre para mostrar (pre-rellenado)
 * 4. Inicializar `ConferenceAttendee` + `VotingAttendeePanel`
 * 5. Panel de debug en modo dev
 */

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ConferenceAttendee } from "../components/conference/ConferenceAttendee";
import { VotingAttendeePanel } from "../components/voting/VotingAttendeePanel";
import { fetchAttendeeInfo, type AttendeeInfo } from "../lib/api";

/** Estados en los que el asistente puede conectar a LiveKit (sala de espera o en vivo). */
function attendeeMayEnterRoom(status: string): boolean {
  return ["invitation_sent", "scheduled", "in_progress"].includes(status);
}

// ─── Pantalla de error ────────────────────────────────────────────────────────

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="attendee-room attendee-room--error">
      <div className="attendee-room__error-box">
        <div className="attendee-room__error-icon">⚠️</div>
        <h2 className="attendee-room__error-title">No fue posible acceder</h2>
        <p className="attendee-room__error-msg">{message}</p>
        <p className="attendee-room__error-hint">
          Verifica que el enlace sea correcto o solicita uno nuevo al administrador.
        </p>
      </div>
    </div>
  );
}

// ─── Pantalla de carga ────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="attendee-room attendee-room--loading">
      <div className="attendee-room__spinner" />
      <p>Validando acceso…</p>
    </div>
  );
}

// ─── Pantalla de bienvenida (antes de unirse) ─────────────────────────────────

function WelcomeScreen({
  info,
  onJoin,
  canEnterRoom,
  isLive,
}: {
  info: AttendeeInfo;
  onJoin: (displayName: string) => void;
  canEnterRoom: boolean;
  isLive: boolean;
}) {
  // Include the unit label in the default display name so the admin can
  // identify which unit each participant represents in the LiveKit list.
  const unitSuffix  = info.unitLabel ? ` · ${info.unitLabel}` : "";
  const defaultName = info.representativeFullName
    ? `${info.representativeFullName}${unitSuffix}`
    : "";
  const [displayName, setDisplayName] = useState(defaultName);
  const [error, setError] = useState("");

  const handleJoin = () => {
    const name = displayName.trim();
    if (!name) { setError("Ingresa tu nombre para continuar."); return; }
    if (name.length > 100) { setError("El nombre es demasiado largo."); return; }
    onJoin(name);
  };

  return (
    <div className="attendee-room attendee-room--welcome">
      <div className="attendee-room__welcome-card">
        <div className="attendee-room__logo">🏛</div>
        <h1 className="attendee-room__assembly-title">{info.assemblyTitle}</h1>

        <div className="attendee-room__unit-info">
          <span className="attendee-room__unit-label">{info.unitLabel}</span>
          {info.representationType === "proxy" && (
            <span className="attendee-room__type-badge attendee-room__type-badge--proxy">Apoderado</span>
          )}
          {info.representationType === "owner" && (
            <span className="attendee-room__type-badge attendee-room__type-badge--owner">Propietario</span>
          )}
        </div>

        {!canEnterRoom && (
          <div className="attendee-room__not-started">
            <span className="attendee-room__not-started-icon">🕐</span>
            {info.assemblyStatus === "draft" && (
              <>Esta asamblea sigue en borrador. Cuando el administrador publique la convocatoria, podrás entrar con este enlace.</>
            )}
            {(info.assemblyStatus === "closed" || info.assemblyStatus === "archived") && (
              <>Esta asamblea ya finalizó. El enlace dejó de estar activo.</>
            )}
            {!["draft", "closed", "archived"].includes(info.assemblyStatus) && (
              <>El acceso desde este enlace no está disponible para el estado actual de la asamblea.</>
            )}
          </div>
        )}

        {canEnterRoom && !isLive && (
          <div className="attendee-room__not-started" style={{ borderColor: "rgba(91, 82, 199, 0.35)", background: "rgba(91, 82, 199, 0.06)" }}>
            <span className="attendee-room__not-started-icon">⏳</span>
            La reunión en vivo aún no ha comenzado. Puedes entrar a la sala de espera; verás la presentación cuando el
            administrador inicie la sesión.
          </div>
        )}

        {canEnterRoom && (
          <>
            <div className="attendee-room__name-section">
              <label className="attendee-room__name-label">
                Tu nombre en la sala
              </label>
              <input
                className="attendee-room__name-input"
                type="text"
                value={displayName}
                onChange={e => { setDisplayName(e.target.value); setError(""); }}
                placeholder="Nombre completo"
                maxLength={100}
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") handleJoin(); }}
              />
              {error && <p className="attendee-room__name-error">{error}</p>}
            </div>

            <button className="attendee-room__join-btn" onClick={handleJoin}>
              {isLive ? "Unirse a la sala →" : "Entrar a la sala de espera →"}
            </button>

            <p className="attendee-room__join-hint">
              {isLive
                ? "Serás conectado a la conferencia y al sistema de votación digital."
                : "Te conectarás a la sala; hasta que comience la reunión verás un aviso de espera."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sala activa ──────────────────────────────────────────────────────────────

function ActiveRoom({
  info,
  displayName,
  accessToken,
  participantIdentity,
}: {
  info:                AttendeeInfo;
  displayName:         string;
  accessToken:         string;
  participantIdentity: string;
}) {
  const sessionLive = info.assemblyStatus === "in_progress";
  const mayConnect = attendeeMayEnterRoom(info.assemblyStatus);

  return (
    <div className="attendee-room attendee-room--active">
      {/* Cabecera — siempre en la parte superior, fuera del área lateral */}
      <div className="attendee-room__header">
        <div className="attendee-room__header-left">
          <span className="attendee-room__live-dot" />
          <span className="attendee-room__assembly-name">{info.assemblyTitle}</span>
          <span className="attendee-room__unit-chip">{info.unitLabel}</span>
        </div>
        <div className="attendee-room__header-right">
          <span className="attendee-room__my-name">{displayName}</span>
        </div>
      </div>

      {/* Cuerpo: conferencia + votación en paralelo */}
      <div className="attendee-room__body">
        <div className="attendee-room__conference">
          <ConferenceAttendee
            propertyId={info.propertyId}
            assemblyId={info.assemblyId}
            assemblyTitle={info.assemblyTitle}
            participantIdentity={participantIdentity}
            displayName={displayName}
            isAssemblyActive={sessionLive}
            allowConnectToRoom={mayConnect}
          />
        </div>

        <div className="attendee-room__voting">
          <VotingAttendeePanel
            propertyId={info.propertyId}
            assemblyId={info.assemblyId}
            accessToken={accessToken}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function AttendeeRoomPage() {
  const { propertyId: paramPropertyId, assemblyId: paramAssemblyId } = useParams();
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get("token") ?? "";

  const [info,        setInfo]        = useState<AttendeeInfo | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [joined,      setJoined]      = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!accessToken) {
      setError("Falta el token de acceso (?token=...). Solicita el link correcto al administrador.");
      setLoading(false);
      return;
    }

    fetchAttendeeInfo(accessToken)
      .then(data => {
        // Validar que coincida con params de URL si están presentes
        if (paramPropertyId && data.propertyId !== paramPropertyId) {
          setError("El token no corresponde a esta propiedad.");
          return;
        }
        if (paramAssemblyId && data.assemblyId !== paramAssemblyId) {
          setError("El token no corresponde a esta asamblea.");
          return;
        }
        setInfo(data);
      })
      .catch(e => setError(e instanceof Error ? e.message : "Token inválido o expirado."))
      .finally(() => setLoading(false));
  }, [accessToken, paramPropertyId, paramAssemblyId]);

  if (loading) return <LoadingScreen />;
  if (error || !info) return <ErrorScreen message={error ?? "Token inválido."} />;

  if (!joined) {
    return (
      <WelcomeScreen
        info={info}
        onJoin={name => { setDisplayName(name); setJoined(true); }}
        canEnterRoom={attendeeMayEnterRoom(info.assemblyStatus)}
        isLive={info.assemblyStatus === "in_progress"}
      />
    );
  }

  // Construir una identidad estable basada en el accessToken (nunca usa prefijo admin-)
  // Formato: owner-<hash corto del token>
  const participantIdentity = `owner-${accessToken.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;

  return (
    <ActiveRoom
      info={info}
      displayName={displayName}
      accessToken={accessToken}
      participantIdentity={participantIdentity}
    />
  );
}
