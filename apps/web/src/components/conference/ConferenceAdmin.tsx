/**
 * Vista de conferencia para el ADMINISTRADOR.
 *
 * Layout:
 * ┌──────────────────────────────┬──────────────────┐
 * │ Video principal + speaker    │ Cola de palabra  │
 * ├──────────────────────────────┴──────────────────┤
 * │ Lista de asistentes + controles de medios        │
 * └─────────────────────────────────────────────────┘
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
import type { SpeakerApproveInput, SpeakerQueueEntry } from "@kuoro/contracts";

import { MediaControls } from "./MediaControls";
import { ParticipantTile } from "./ParticipantTile";
import { SpeakerQueue } from "./SpeakerQueue";
import { ConferenceTimer } from "./ConferenceTimer";
import { ConferenceDebugPanel, debugLog } from "./ConferenceDebugPanel";
import { useSpeakerQueue } from "../../hooks/useSpeakerQueue";
import { fetchConferenceToken } from "../../lib/api";

const IS_DEV = import.meta.env.DEV;

/** Estado de la diapositiva actual que se retransmite a los asistentes. */
export interface SlidePayload {
  type: "slide" | "vote_active" | "vote_results";
  slideIndex:       number;
  totalSlides:      number;
  agendaTitle:      string;
  agendaSlideTitle?: string;
  agendaContent?:   string;
  votePrompt?:      string;
  /** Solo en vote_active */
  voteQuestion?:    string;
  /** Solo en vote_results */
  voteResult?: {
    question:        string;
    approved:        boolean;
    yesVotes:        number;
    noVotes:         number;
    abstainVotes:    number;
    blankVotes:      number;
  };
}

const SLIDE_TOPIC = "SLIDE_UPDATE";

interface ConferenceAdminProps {
  propertyId: string;
  assemblyId: string;
  assemblyTitle: string;
  isAssemblyActive: boolean;
  /** Diapositiva actual — se retransmite a los asistentes vía LiveKit data channel. */
  slidePayload?: SlidePayload;
  /**
   * Callback que recibe el MediaStream de la cámara local del admin.
   * El hub page lo usa para mostrar la cámara dentro del canvas de diapositivas.
   * Recibe `null` cuando la cámara se apaga.
   */
  onLocalCamera?: (stream: MediaStream | null) => void;
}

// ── Inner component (accede al contexto de la room) ──────────────────────────

function AdminRoomContent({
  propertyId,
  assemblyId,
  isAssemblyActive,
  slidePayload,
  onLocalCamera,
}: {
  propertyId:    string;
  assemblyId:    string;
  isAssemblyActive: boolean;
  slidePayload?: SlidePayload;
  onLocalCamera?: (stream: MediaStream | null) => void;
}) {
  const { localParticipant, cameraTrack } = useLocalParticipant();
  const remoteParticipants   = useParticipants();
  const { name: roomName }   = useRoomInfo();
  const room                 = useRoomContext();

  // Force re-render when local tracks are published/unpublished (e.g. screen share starts/stops).
  // useParticipants() only tracks remote participants; local track events need explicit listening.
  const [, bumpScreenShare] = useState(0);
  useEffect(() => {
    const bump = () => bumpScreenShare(n => n + 1);
    room.on(RoomEvent.LocalTrackPublished,   bump);
    room.on(RoomEvent.LocalTrackUnpublished, bump);
    return () => {
      room.off(RoomEvent.LocalTrackPublished,   bump);
      room.off(RoomEvent.LocalTrackUnpublished, bump);
    };
  }, [room]);

  // ── Expose local camera stream to parent (hub page canvas) ───────────────────
  useEffect(() => {
    if (!onLocalCamera) return;
    const mediaTrack = (cameraTrack?.track as { mediaStreamTrack?: MediaStreamTrack } | undefined)?.mediaStreamTrack;
    if (mediaTrack) {
      onLocalCamera(new MediaStream([mediaTrack]));
    } else {
      onLocalCamera(null);
    }
    return () => { onLocalCamera(null); };
  }, [cameraTrack, onLocalCamera]);

  // ── Slide broadcast ──────────────────────────────────────────────────────────
  // Publishes current slide state to all connected participants.
  // Uses a ref so the latest payload is always sent regardless of closure age.
  const slidePayloadRef = useRef<SlidePayload | undefined>(slidePayload);
  slidePayloadRef.current = slidePayload;

  const doPublish = useRef((payload: SlidePayload | undefined) => {
    if (!payload) return;
    try {
      const data = new TextEncoder().encode(JSON.stringify({ _topic: SLIDE_TOPIC, ...payload }));
      room.localParticipant.publishData(data, { reliable: true }).catch((e: unknown) => {
        console.warn("[ConferenceAdmin] slide broadcast rejected:", e);
      });
    } catch (e) {
      console.warn("[ConferenceAdmin] slide broadcast failed:", e);
    }
  });

  // Broadcast whenever slide changes
  useEffect(() => {
    doPublish.current(slidePayload);
  }, [slidePayload]);

  // Re-send after a short delay when a new participant connects
  // (data channel handshake may not be complete at the exact join moment)
  useEffect(() => {
    const onJoin = () => {
      setTimeout(() => doPublish.current(slidePayloadRef.current), 800);
    };
    room.on(RoomEvent.ParticipantConnected, onJoin);
    return () => { room.off(RoomEvent.ParticipantConnected, onJoin); };
  }, [room]);

  // Respond to REQUEST_SLIDE messages from attendees who just connected
  useEffect(() => {
    const onData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;
        if (msg._topic === "REQUEST_SLIDE") {
          doPublish.current(slidePayloadRef.current);
        }
      } catch { /* no-op */ }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => { room.off(RoomEvent.DataReceived, onData); };
  }, [room]);

  // Periodic heartbeat every 3 s — ensures late joiners receive the slide quickly.
  useEffect(() => {
    const id = setInterval(() => doPublish.current(slidePayloadRef.current), 3000);
    return () => clearInterval(id);
  }, []);

  const {
    queue,
    currentSpeaker,
    secondsLeft,
    totalSeconds,
    isLoading: queueLoading,
    error: queueError,
    approveTurn,
    rejectTurn,
    finishTurn,
  } = useSpeakerQueue({
    propertyId,
    assemblyId,
    localIdentity: localParticipant.identity,
    mode: "admin",
    enabled: isAssemblyActive,
    // El backend expira automáticamente; el frontend solo re-sincroniza
    onTurnEnded: (_entry: SpeakerQueueEntry) => { /* polling actualizará el estado */ },
  });

  const speakerParticipant = currentSpeaker
    ? remoteParticipants.find(
        (p: Participant) => p.identity === currentSpeaker.participantIdentity,
      )
    : null;

  // totalSeconds viene del hook, calculado desde speakingStartedAt y speakingEndsAt

  return (
    <div className="conf-admin">
      {/* Cabecera */}
      <div className="conf-admin__header">
        <div className="conf-admin__room-info">
          <span className="conf-admin__live-dot" />
          <span className="conf-admin__room-name">{roomName}</span>
          <span className="conf-admin__attendee-count">
            {remoteParticipants.length} participante{remoteParticipants.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="conf-admin__body">
        {/* Área de vídeo principal */}
        <div className="conf-admin__main">
          {/* Admin (yo) */}
          <ParticipantTile
            participant={localParticipant as unknown as Participant}
            featured
            roleLabel="Administrador"
          />

          {/* Speaker activo (si es remoto) */}
          {speakerParticipant && (
            <ParticipantTile
              participant={speakerParticipant}
              featured
              roleLabel="Con la palabra"
              speakerTimer={
                <ConferenceTimer secondsLeft={secondsLeft} totalSeconds={totalSeconds} />
              }
            />
          )}

          {/* Compartir pantalla si activo */}
          <ScreenShareView participants={[localParticipant as unknown as Participant, ...remoteParticipants]} />
        </div>

        {/* Sidebar: cola + asistentes */}
        <aside className="conf-admin__sidebar">
          {queueError && (
            <div className="conf-admin__queue-error" title={queueError}>
              ⚠️ Cola: {queueError}
            </div>
          )}
          <SpeakerQueue
            queue={queue}
            currentSpeaker={currentSpeaker}
            secondsLeft={secondsLeft}
            isLoading={queueLoading}
            onApprove={approveTurn}
            onReject={rejectTurn}
            onFinish={finishTurn}
          />

          <div className="conf-admin__attendees">
            <h3 className="conf-admin__attendees-title">
              Asistentes conectados ({remoteParticipants.length})
            </h3>
            <ul className="conf-admin__attendees-list">
              {remoteParticipants.map((p: Participant) => {
                const isThisSpeaker = p.identity === currentSpeaker?.participantIdentity;
                const isInQueue     = queue.some(
                  (e) => e.participantIdentity === p.identity && e.status === "waiting",
                );
                return (
                  <li
                    key={p.identity}
                    className={`conf-admin__attendee-row${isThisSpeaker ? " conf-admin__attendee-row--speaking" : ""}${isInQueue ? " conf-admin__attendee-row--queued" : ""}`}
                  >
                    <span className="conf-admin__attendee-name">
                      {p.name ?? p.identity}
                    </span>
                    {isThisSpeaker && <span className="conf-admin__attendee-badge conf-admin__attendee-badge--speaking">Hablando</span>}
                    {isInQueue     && <span className="conf-admin__attendee-badge conf-admin__attendee-badge--queued">En cola</span>}
                  </li>
                );
              })}
              {remoteParticipants.length === 0 && (
                <li className="conf-admin__attendee-empty">Sin participantes conectados aún.</li>
              )}
            </ul>
          </div>
        </aside>
      </div>

      {/* Barra de controles */}
      <MediaControls
        room={room}
        canCamera
        canScreenShare
      />
    </div>
  );
}

// ── Pantalla de compartición ──────────────────────────────────────────────────

/**
 * Muestra la pantalla compartida de cualquier participante (local o remoto).
 * Para participantes locales se comprueba `isEnabled`; para remotos, `isSubscribed`.
 */
function ScreenShareView({ participants }: { participants: Participant[] }) {
  const screenParticipant = participants.find((p) => {
    const pub = p.getTrackPublication(Track.Source.ScreenShare);
    return pub?.isSubscribed || pub?.isEnabled;
  });

  if (!screenParticipant) return null;

  return (
    <div className="conf-screenshare">
      <span className="conf-screenshare__label">
        Pantalla — {screenParticipant.name ?? screenParticipant.identity}
      </span>
      <ParticipantTile
        participant={screenParticipant}
        source={Track.Source.ScreenShare}
        featured
        roleLabel="Pantalla compartida"
      />
    </div>
  );
}

// ── Componente raíz ───────────────────────────────────────────────────────────

export function ConferenceAdmin({
  propertyId,
  assemblyId,
  assemblyTitle,
  isAssemblyActive,
  slidePayload,
  onLocalCamera,
}: ConferenceAdminProps) {
  const [tokenData, setTokenData] = useState<{
    token: string;
    livekitUrl: string;
    roomName?: string;
    participantIdentity?: string;
  } | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [joined, setJoined]         = useState(false);
  // retryCount increments on each manual retry, forcing the useEffect to re-run
  const [retryCount, setRetryCount] = useState(0);

  const [debugOpen, setDebugOpen] = useState(false);

  useEffect(() => {
    if (joined || loading || !isAssemblyActive) return;

    setLoading(true);
    setTokenError(null);
    debugLog("info", "Solicitando token de conferencia (admin)…");
    fetchConferenceToken(propertyId, assemblyId)
      .then((res) => {
        setTokenData({ token: res.token, livekitUrl: res.livekitUrl, roomName: res.roomName, participantIdentity: res.participantIdentity });
        debugLog("ok", `Token obtenido — LiveKit URL: ${res.livekitUrl}`);
        debugLog("info", `Sala: ${res.roomName} | Identity: ${res.participantIdentity}`);
      })
      .catch((e: Error) => {
        setTokenError(e.message);
        debugLog("error", `Error obteniendo token: ${e.message}`);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount, joined, isAssemblyActive, propertyId, assemblyId]);

  if (!isAssemblyActive) {
    return (
      <div className="conf-placeholder">
        <p>La asamblea aún no ha sido iniciada. Activa la sala para acceder a la conferencia.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="conf-placeholder">Conectando a la sala de conferencia…</div>;
  }

  if (tokenError) {
    return (
      <div className="conf-placeholder conf-placeholder--error">
        <p>No fue posible conectar: {tokenError}</p>
        <button type="button" className="conf-placeholder__retry" onClick={() => setRetryCount(n => n + 1)}>
          Reintentar
        </button>
      </div>
    );
  }

  if (!tokenData) return null;

  return (
    <div className="conf-root">
      <div className="conf-root__title">
        <span className="conf-root__live-badge">EN VIVO</span>
        {assemblyTitle}
        {IS_DEV && (
          <button
            className="conf-root__debug-toggle"
            onClick={() => setDebugOpen(v => !v)}
          >
            {debugOpen ? "▾ Debug" : "▸ Debug"}
          </button>
        )}
      </div>

      {IS_DEV && debugOpen && (
        <ConferenceDebugPanel
          participantIdentity={tokenData.participantIdentity ?? "admin"}
          displayName="Admin"
          assemblyId={assemblyId}
          propertyId={propertyId}
          mode="admin"
        />
      )}

      <LiveKitRoom
        token={tokenData.token}
        serverUrl={tokenData.livekitUrl}
        connect={true}
        style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
        onConnected={() => {
          setJoined(true);
          debugLog("ok", "✅ Conectado a LiveKit Room (admin)");
        }}
        onDisconnected={() => {
          setJoined(false);
          debugLog("warn", "Desconectado de LiveKit Room");
        }}
        options={{
          adaptiveStream: true,
          dynacast: true,
          stopLocalTrackOnUnpublish: true,
        }}
      >
        <AdminRoomContent
          propertyId={propertyId}
          assemblyId={assemblyId}
          isAssemblyActive={isAssemblyActive}
          slidePayload={slidePayload}
          onLocalCamera={onLocalCamera}
        />
      </LiveKitRoom>
    </div>
  );
}
