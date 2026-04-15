/**
 * Vista de conferencia para el ASISTENTE / PROPIETARIO.
 *
 * El asistente:
 * - Ve el vídeo del administrador y del orador autorizado.
 * - Escucha el audio de la sala.
 * - Puede solicitar la palabra.
 * - Ve el cronómetro si tiene o si alguien tiene la palabra.
 * - No puede publicar hasta recibir aprobación del admin.
 */

import { useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  useParticipants,
  useLocalParticipant,
  useRoomInfo,
  useRoomContext,
} from "@livekit/components-react";
import type { Participant } from "livekit-client";
import { RoomEvent, Track } from "livekit-client";
import type { SpeakerQueueEntry } from "@kuoro/contracts";

import { MediaControls } from "./MediaControls";
import { ParticipantTile } from "./ParticipantTile";
import { ConferenceTimer } from "./ConferenceTimer";
import { debugLog } from "./ConferenceDebugPanel";
import { useSpeakerQueue } from "../../hooks/useSpeakerQueue";
import { fetchAttendeeToken, getLiveSlide } from "../../lib/api";
import type { SlidePayload } from "./ConferenceAdmin";

// ── Slide Canvas ─────────────────────────────────────────────────────────────
// Replica visual del canvas 16:9 del administrador (AssemblyHubPage).
// El mismo gradiente, tipografía, posiciones y overlays — para que admin y
// asistente vean exactamente la misma presentación.

interface SlideCanvasProps {
  slide: SlidePayload | null;
  /** Video element para la cámara del admin (track de LiveKit). */
  cameraRef: React.RefObject<HTMLVideoElement>;
  hasCameraTrack: boolean;
}

function SlideCanvas({ slide, cameraRef, hasCameraTrack }: SlideCanvasProps) {
  const BG = "linear-gradient(150deg, #6258C4 0%, #3D2E8F 60%, #1A0F3C 100%)";

  return (
    <div style={{ position: "absolute", inset: 0, background: "#0B0820", overflow: "hidden" }}>
      {/* Gradient background — mismo que el del admin */}
      <div style={{ position: "absolute", inset: 0, background: BG }} />

      {/* ── Contenido según modo ── */}
      {!slide && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, opacity: 0.4, color: "#fff" }}>
          <span style={{ fontSize: 36 }}>🎬</span>
          <span style={{ fontSize: 13 }}>Conectando con la presentación…</span>
        </div>
      )}

      {slide?.type === "slide" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "5% 8%", gap: "3%" }}>
          <div style={{ fontSize: "clamp(9px,1.2vw,11px)", fontWeight: 600, letterSpacing: "0.08em", opacity: 0.5, color: "#fff", textTransform: "uppercase" }}>
            {slide.slideIndex + 1} / {slide.totalSlides} · {slide.agendaTitle?.slice(0, 30)}
          </div>
          <div style={{ fontSize: "clamp(18px,2.8vw,32px)", fontWeight: 500, lineHeight: 1.2, letterSpacing: "-0.025em", color: "#fff" }}>
            {slide.agendaSlideTitle || slide.agendaTitle || "Sin título"}
          </div>
          {slide.agendaContent && (
            <p style={{ fontSize: "clamp(11px,1.4vw,15px)", opacity: 0.8, lineHeight: 1.7, margin: 0, color: "#fff", whiteSpace: "pre-line", maxHeight: "30%", overflow: "hidden" }}>
              {slide.agendaContent}
            </p>
          )}
          {slide.votePrompt && (
            <div style={{ padding: "2% 3%", borderRadius: 8, backgroundColor: "rgba(255,255,255,0.12)", border: "0.5px solid rgba(255,255,255,0.2)", fontSize: "clamp(11px,1.3vw,14px)", fontWeight: 500, color: "#fff", display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start" }}>
              🗳 {slide.votePrompt}
            </div>
          )}
        </div>
      )}

      {slide?.type === "vote_active" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4%", padding: "6%" }}>
          <div style={{ fontSize: "clamp(10px,1.2vw,12px)", fontWeight: 700, letterSpacing: "0.12em", color: "#A594F9", textTransform: "uppercase" }}>Votación en curso</div>
          <div style={{ fontSize: "clamp(16px,2.5vw,26px)", fontWeight: 500, color: "#fff", textAlign: "center", lineHeight: 1.3, maxWidth: "80%" }}>{slide.voteQuestion}</div>
        </div>
      )}

      {slide?.type === "vote_results" && slide.voteResult && (() => {
        const r = slide.voteResult!;
        const total = r.yesVotes + r.noVotes + r.abstainVotes + r.blankVotes;
        const pct = (v: number) => (total > 0 ? ((v / total) * 100).toFixed(2) : "0.00") + "%";
        return (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "4% 8%", gap: "4%" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4%", flex: 1, maxWidth: "55%" }}>
              <div style={{ fontSize: "clamp(9px,1.1vw,11px)", fontWeight: 700, letterSpacing: "0.1em", color: "#A594F9", textTransform: "uppercase" }}>Resultado de la votación</div>
              <div style={{ fontSize: "clamp(14px,2vw,20px)", fontWeight: 500, color: "#fff", lineHeight: 1.3 }}>{r.question}</div>
              <div style={{ padding: "3% 4%", borderRadius: 10, backgroundColor: r.approved ? "rgba(61,154,106,0.25)" : "rgba(220,38,38,0.25)", border: `1px solid ${r.approved ? "#3D9A6A" : "#DC2626"}`, display: "inline-block", alignSelf: "flex-start" }}>
                <div style={{ fontSize: "clamp(18px,2.8vw,32px)", fontWeight: 700, color: r.approved ? "#3D9A6A" : "#DC2626" }}>
                  {r.approved ? "APROBADO" : "NO APROBADO"}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4% 6%", marginTop: "2%" }}>
                {([["A favor", r.yesVotes, "#3D9A6A"], ["En contra", r.noVotes, "#DC2626"], ["Abstención", r.abstainVotes, "#D97706"], ["En blanco", r.blankVotes, "#A8A49E"]] as [string, number, string][]).map(([label, value, color]) => (
                  <div key={label}>
                    <div style={{ fontSize: "clamp(9px,1vw,11px)", color: "rgba(255,255,255,0.5)" }}>{label}</div>
                    <div style={{ fontSize: "clamp(16px,2vw,24px)", fontWeight: 600, color, fontVariantNumeric: "tabular-nums" }}>{pct(value)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* PiP camera — posición idéntica a la del canvas del admin */}
      <div style={{ position: "absolute", bottom: 14, right: 14, width: "18%", aspectRatio: "4/3", borderRadius: 8, overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.18)", backgroundColor: "#111", zIndex: 20 }}>
        {hasCameraTrack ? (
          <video
            ref={cameraRef}
            autoPlay
            muted
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 14, opacity: 0.2 }}>📷</span>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textAlign: "center" }}>Sin cámara</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface ConferenceAttendeeProps {
  propertyId: string;
  assemblyId: string;
  assemblyTitle: string;
  /** Identidad única del participante (ownerId, etc.). */
  participantIdentity: string;
  displayName: string;
  /** Sesión en vivo: presentación, cola de palabra, etc. */
  isAssemblyActive: boolean;
  /** Puede conectar a LiveKit (convocada, programada o en curso). Si no, no se pide token. */
  allowConnectToRoom?: boolean;
}

// ── Contenido interno de la room ─────────────────────────────────────────────

function AttendeeRoomContent({
  propertyId,
  assemblyId,
  participantIdentity,
  displayName,
  isAssemblyActive,
}: {
  propertyId: string;
  assemblyId: string;
  participantIdentity: string;
  displayName: string;
  isAssemblyActive: boolean;
}) {
  // ── API polling — primary slide source (reliable, no LiveKit dependency) ──
  const [slidePayload, setSlidePayload] = useState<SlidePayload | null>(null);
  useEffect(() => {
    if (!isAssemblyActive) return;
    const poll = () => {
      getLiveSlide(propertyId, assemblyId)
        .then(({ slide }) => { if (slide) setSlidePayload(slide as unknown as SlidePayload); })
        .catch(() => { /* silent — will retry */ });
    };
    poll(); // immediate first fetch
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [propertyId, assemblyId, isAssemblyActive]);
  const { localParticipant }  = useLocalParticipant();
  const remoteParticipants    = useParticipants();
  const { name: roomName }    = useRoomInfo();
  const room                  = useRoomContext();

  // Receive slide state broadcast by the admin via LiveKit data channel
  // (fast-path — arrives faster than 2s polling, but not guaranteed)
  useEffect(() => {
    const onData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;
        if (msg._topic === "SLIDE_UPDATE") {
          setSlidePayload(msg as unknown as SlidePayload);
        }
      } catch {
        // ignore malformed data
      }
    };
    room.on(RoomEvent.DataReceived, onData);

    // Send a request to admin so they re-broadcast the current slide immediately
    // (avoids waiting up to 8 s for the periodic heartbeat)
    const requestCurrent = () => {
      try {
        const req = new TextEncoder().encode(JSON.stringify({ _topic: "REQUEST_SLIDE" }));
        void room.localParticipant.publishData(req, { reliable: true });
      } catch { /* no-op */ }
    };
    // Request after a short delay to let the data channel stabilize
    const tid = setTimeout(requestCurrent, 1200);

    return () => {
      room.off(RoomEvent.DataReceived, onData);
      clearTimeout(tid);
    };
  }, [room]);

  const {
    queue,
    currentSpeaker,
    iAmWaiting,
    iAmSpeaking,
    iAmApproved,
    secondsLeft,
    totalSeconds,
    isLoading: queueLoading,
    requestTurn,
  } = useSpeakerQueue({
    propertyId,
    assemblyId,
    localIdentity: participantIdentity,
    mode: "attendee",
    enabled: isAssemblyActive,
    // El backend expira automáticamente; polling refleja el estado real
    onTurnEnded: (_entry: SpeakerQueueEntry) => { /* UI se actualiza via polling */ },
  });

  // Identificar al admin entre los participantes remotos
  const adminParticipant = remoteParticipants.find(
    (p: Participant) => p.identity.startsWith("admin-"),
  );

  // Adjuntar el track de cámara del admin al <video> dentro de SlideCanvas
  const adminCameraRef = useRef<HTMLVideoElement>(null);
  const adminCameraTrack = adminParticipant
    ?.getTrackPublication(Track.Source.Camera)?.track;
  const hasAdminCamera = !!adminCameraTrack;

  useEffect(() => {
    if (adminCameraTrack && adminCameraRef.current) {
      adminCameraTrack.attach(adminCameraRef.current);
    }
    return () => { adminCameraTrack?.detach(); };
  }, [adminCameraTrack]);

  // Identificar al orador activo (si no somos nosotros)
  const speakerParticipant =
    currentSpeaker && currentSpeaker.participantIdentity !== participantIdentity
      ? remoteParticipants.find(
          (p: Participant) => p.identity === currentSpeaker.participantIdentity,
        )
      : null;

  // totalSeconds proviene del hook (calculado desde speakingEndsAt del backend)

  return (
    <div className="conf-attendee">
      {/* Cabecera */}
      <div className="conf-attendee__header">
        <span className="conf-attendee__live-dot" />
        <span className="conf-attendee__room-name">{roomName}</span>
        <span className="conf-attendee__my-name">{displayName}</span>
      </div>

      {/* ── Área principal: canvas sincronizado (réplica del canvas del admin) ── */}
      <div className="conf-attendee__main-canvas">
        {/* SlideCanvas incluye internamente el PiP de cámara del admin */}
        <SlideCanvas
          slide={slidePayload}
          cameraRef={adminCameraRef}
          hasCameraTrack={hasAdminCamera}
        />

        {/* Speaker activo — PiP en esquina inferior izquierda */}
        {speakerParticipant && (
          <div className="conf-attendee__pip conf-attendee__pip--left">
            <ParticipantTile
              participant={speakerParticipant}
              roleLabel="Con la palabra"
              speakerTimer={<ConferenceTimer secondsLeft={secondsLeft} totalSeconds={totalSeconds} />}
            />
          </div>
        )}

        {/* Mi propio tile cuando tengo la palabra */}
        {iAmSpeaking && (
          <div className="conf-attendee__pip conf-attendee__pip--left">
            <ParticipantTile
              participant={localParticipant as unknown as Participant}
              roleLabel="Usted está hablando"
              speakerTimer={<ConferenceTimer secondsLeft={secondsLeft} totalSeconds={totalSeconds} />}
            />
          </div>
        )}
      </div>

      {/* Barra de estado de participación */}
      <div className="conf-attendee__status-bar">
        {iAmSpeaking && (
          <div className="conf-attendee__status conf-attendee__status--speaking">
            <span className="conf-attendee__status-dot" />
            Usted tiene la palabra.{" "}
            <ConferenceTimer secondsLeft={secondsLeft} totalSeconds={totalSeconds} />
          </div>
        )}

        {iAmApproved && !iAmSpeaking && (
          <div className="conf-attendee__status conf-attendee__status--approved">
            Su turno fue aprobado. Active su micrófono para comenzar.
          </div>
        )}

        {iAmWaiting && (
          <div className="conf-attendee__status conf-attendee__status--waiting">
            <span>Solicitud enviada. Esperando aprobación del administrador…</span>
            <span className="conf-attendee__queue-pos">
              Posición en cola: {queue.findIndex((e) => e.participantIdentity === participantIdentity) + 1}
            </span>
          </div>
        )}

        {!iAmWaiting && !iAmSpeaking && !iAmApproved && isAssemblyActive && (
          <button
            type="button"
            className="conf-attendee__request-btn"
            disabled={queueLoading}
            onClick={() => void requestTurn(displayName)}
          >
            ✋ Solicitar la palabra
          </button>
        )}
      </div>

      {/* Controles de medios: solo si tenemos la palabra */}
      {(iAmSpeaking || iAmApproved) && (
        <MediaControls
          room={room}
          canCamera={currentSpeaker?.modalidad === "mic_camera"}
          canScreenShare={false}
        />
      )}
    </div>
  );
}

// ── Componente raíz ───────────────────────────────────────────────────────────

export function ConferenceAttendee({
  propertyId,
  assemblyId,
  assemblyTitle,
  participantIdentity,
  displayName,
  isAssemblyActive,
  allowConnectToRoom,
}: ConferenceAttendeeProps) {
  const mayConnect = allowConnectToRoom ?? isAssemblyActive;
  const [tokenData, setTokenData] = useState<{
    token: string;
    livekitUrl: string;
  } | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  // retryCount increments on each manual retry, forcing the useEffect to re-run
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (loading || tokenData || !mayConnect) return;

    setLoading(true);
    setTokenError(null);
    debugLog("info", `Solicitando token asistente (identity: ${participantIdentity})…`);
    fetchAttendeeToken(propertyId, assemblyId, participantIdentity, displayName)
      .then((res) => {
        setTokenData({ token: res.token, livekitUrl: res.livekitUrl });
        debugLog("ok", `Token asistente obtenido — LiveKit URL: ${res.livekitUrl}`);
        if (res.restoredSpeakerEntry) {
          const entry = res.restoredSpeakerEntry as { status?: string };
          debugLog("warn", `⚡ Reconexión: turno de speaker restaurado (${entry.status ?? "speaking"})`);
        }
      })
      .catch((e: Error) => {
        setTokenError(e.message);
        debugLog("error", `Error obteniendo token asistente: ${e.message}`);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount, tokenData, mayConnect, propertyId, assemblyId, participantIdentity, displayName]);

  if (!mayConnect) {
    return (
      <div className="conf-placeholder">
        <p>El acceso a la sala aún no está disponible para el estado actual de la asamblea.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="conf-placeholder">Uniéndose a la sala…</div>;
  }

  if (tokenError) {
    return (
      <div className="conf-placeholder conf-placeholder--error">
        <p>No fue posible unirse: {tokenError}</p>
        <button type="button" className="conf-placeholder__retry" onClick={() => setRetryCount(n => n + 1)}>
          Reintentar
        </button>
      </div>
    );
  }

  if (!tokenData) return null;

  return (
    <div className="conf-root">
      <div className="conf-root__title">{assemblyTitle}</div>
      {!isAssemblyActive && (
        <div
          className="conf-placeholder"
          style={{
            marginBottom: 8,
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            fontSize: 13
          }}
        >
          Sala de espera: el administrador aún no ha iniciado la reunión en vivo. Ya estás conectado; podrás ver la
          presentación cuando comience.
        </div>
      )}
      <LiveKitRoom
        token={tokenData.token}
        serverUrl={tokenData.livekitUrl}
        connect={true}
        style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
        onConnected={() => debugLog("ok", "✅ Conectado a LiveKit Room (asistente)")}
        onDisconnected={() => debugLog("warn", "Desconectado de LiveKit Room (asistente)")}
        options={{
          adaptiveStream: true,
          dynacast: true,
          stopLocalTrackOnUnpublish: true,
        }}
      >
        <AttendeeRoomContent
          propertyId={propertyId}
          assemblyId={assemblyId}
          participantIdentity={participantIdentity}
          displayName={displayName}
          isAssemblyActive={isAssemblyActive}
        />
      </LiveKitRoom>
    </div>
  );
}
