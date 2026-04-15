/**
 * Barra de controles de medios (mic, cámara, compartir pantalla, colgar).
 * Solo se muestra si el participante tiene permisos para publicar.
 */

import { useCallback, useState } from "react";
import type { Room } from "livekit-client";
import { Track } from "livekit-client";

interface MediaControlsProps {
  room: Room;
  /** Permite publicar cámara. */
  canCamera?: boolean;
  /** Permite compartir pantalla (solo admin). */
  canScreenShare?: boolean;
  onLeave?: () => void;
}

export function MediaControls({
  room,
  canCamera = false,
  canScreenShare = false,
  onLeave,
}: MediaControlsProps) {
  const [micOn, setMicOn]         = useState(false);
  const [camOn, setCamOn]         = useState(false);
  const [screenOn, setScreenOn]   = useState(false);
  const [busy, setBusy]           = useState(false);

  const toggleMic = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (micOn) {
        await room.localParticipant.setMicrophoneEnabled(false);
        setMicOn(false);
      } else {
        await room.localParticipant.setMicrophoneEnabled(true);
        setMicOn(true);
      }
    } finally {
      setBusy(false);
    }
  }, [room, micOn, busy]);

  const toggleCam = useCallback(async () => {
    if (busy || !canCamera) return;
    setBusy(true);
    try {
      if (camOn) {
        await room.localParticipant.setCameraEnabled(false);
        setCamOn(false);
      } else {
        await room.localParticipant.setCameraEnabled(true);
        setCamOn(true);
      }
    } finally {
      setBusy(false);
    }
  }, [room, camOn, canCamera, busy]);

  const toggleScreen = useCallback(async () => {
    if (busy || !canScreenShare) return;
    setBusy(true);
    try {
      if (screenOn) {
        await room.localParticipant.setScreenShareEnabled(false);
        setScreenOn(false);
      } else {
        await room.localParticipant.setScreenShareEnabled(true);
        setScreenOn(true);
      }
    } catch {
      // User cancelled the screen picker or permission was denied — sync state with reality
      const actuallySharing =
        !!room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.isEnabled;
      setScreenOn(actuallySharing);
    } finally {
      setBusy(false);
    }
  }, [room, screenOn, canScreenShare, busy]);

  return (
    <div className="conf-controls">
      <button
        type="button"
        className={`conf-controls__btn${micOn ? " conf-controls__btn--on" : ""}`}
        onClick={toggleMic}
        disabled={busy}
        title={micOn ? "Silenciar micrófono" : "Activar micrófono"}
        aria-label={micOn ? "Silenciar micrófono" : "Activar micrófono"}
      >
        {micOn ? "🎤" : "🔇"}
        <span className="conf-controls__label">{micOn ? "Silenciar" : "Micrófono"}</span>
      </button>

      {canCamera && (
        <button
          type="button"
          className={`conf-controls__btn${camOn ? " conf-controls__btn--on" : ""}`}
          onClick={toggleCam}
          disabled={busy}
          title={camOn ? "Apagar cámara" : "Encender cámara"}
          aria-label={camOn ? "Apagar cámara" : "Encender cámara"}
        >
          {camOn ? "📹" : "📷"}
          <span className="conf-controls__label">{camOn ? "Apagar cám." : "Cámara"}</span>
        </button>
      )}

      {canScreenShare && (
        <button
          type="button"
          className={`conf-controls__btn${screenOn ? " conf-controls__btn--on" : ""}`}
          onClick={toggleScreen}
          disabled={busy}
          title={screenOn ? "Dejar de compartir" : "Compartir pantalla"}
          aria-label={screenOn ? "Dejar de compartir" : "Compartir pantalla"}
        >
          {screenOn ? "🖥️" : "📺"}
          <span className="conf-controls__label">{screenOn ? "Detener" : "Pantalla"}</span>
        </button>
      )}

      {onLeave && (
        <button
          type="button"
          className="conf-controls__btn conf-controls__btn--leave"
          onClick={onLeave}
          title="Salir de la sala"
          aria-label="Salir de la sala"
        >
          📵
          <span className="conf-controls__label">Salir</span>
        </button>
      )}
    </div>
  );
}
