/**
 * Tile de vídeo/audio de un participante de LiveKit.
 * Renderiza el elemento <video> y un indicador de audio.
 *
 * El tile se suscribe a los eventos de track del participante para que
 * el vídeo se adjunte automáticamente cuando el participante active
 * su cámara o comparta pantalla DESPUÉS de que el asistente se haya unido,
 * sin necesidad de refrescar la página.
 */

import { useEffect, useRef, useState } from "react";
import type { Participant, Track } from "livekit-client";
import { Track as TrackNS, ParticipantEvent } from "livekit-client";

interface ParticipantTileProps {
  participant: Participant;
  /**
   * Fuente de vídeo a mostrar.
   * Por defecto: Camera. Usa ScreenShare para tiles de pantalla compartida.
   */
  source?: TrackNS.Source;
  /** Si true, renderiza el tile grande (administrador / speaker activo). */
  featured?: boolean;
  /** Label de rol a mostrar. */
  roleLabel?: string;
  /** Muestra el cronómetro de intervención. */
  speakerTimer?: React.ReactNode;
}

export function ParticipantTile({
  participant,
  source = TrackNS.Source.Camera,
  featured = false,
  roleLabel,
  speakerTimer,
}: ParticipantTileProps) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const audioRef  = useRef<HTMLAudioElement>(null);
  // Incrementado cada vez que el participante publica/subscribe/muta un track.
  // Fuerza re-render para que videoTrack / hasCam / isMuted se recalculen.
  const [, forceUpdate] = useState(0);

  // Suscribirse a eventos de track del participante
  useEffect(() => {
    const bump = () => forceUpdate(n => n + 1);

    participant.on(ParticipantEvent.TrackPublished,    bump);
    participant.on(ParticipantEvent.TrackUnpublished,  bump);
    participant.on(ParticipantEvent.TrackSubscribed,   bump);
    participant.on(ParticipantEvent.TrackUnsubscribed, bump);
    participant.on(ParticipantEvent.TrackMuted,        bump);
    participant.on(ParticipantEvent.TrackUnmuted,      bump);

    return () => {
      participant.off(ParticipantEvent.TrackPublished,    bump);
      participant.off(ParticipantEvent.TrackUnpublished,  bump);
      participant.off(ParticipantEvent.TrackSubscribed,   bump);
      participant.off(ParticipantEvent.TrackUnsubscribed, bump);
      participant.off(ParticipantEvent.TrackMuted,        bump);
      participant.off(ParticipantEvent.TrackUnmuted,      bump);
    };
  }, [participant]);

  // Derivar tracks de las publicaciones actuales (se recalculan en cada render)
  const videoTrack = participant.getTrackPublication(source)?.track as Track | undefined;
  const audioTrack = participant.getTrackPublication(TrackNS.Source.Microphone)?.track as Track | undefined;

  // Adjuntar/desadjuntar el track de vídeo cuando cambie
  useEffect(() => {
    if (videoTrack && videoRef.current) {
      videoTrack.attach(videoRef.current);
    }
    return () => {
      videoTrack?.detach();
    };
  }, [videoTrack]);

  // Adjuntar/desadjuntar el track de audio cuando cambie
  useEffect(() => {
    if (audioTrack && audioRef.current) {
      audioTrack.attach(audioRef.current);
    }
    return () => {
      audioTrack?.detach();
    };
  }, [audioTrack]);

  const hasVideo   = !!participant.getTrackPublication(source)?.track;
  const isMuted    = participant.getTrackPublication(TrackNS.Source.Microphone)?.isMuted ?? true;
  const isScreenShare = source === TrackNS.Source.ScreenShare;
  const isSpeaking = participant.isSpeaking;

  return (
    <div
      className={`conf-tile${featured ? " conf-tile--featured" : ""}${isSpeaking ? " conf-tile--speaking" : ""}`}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          className="conf-tile__video"
          autoPlay
          playsInline
          muted
        />
      ) : (
        <div className="conf-tile__avatar">
          <span className="conf-tile__avatar-initials">
            {(participant.name ?? participant.identity)
              .split(" ")
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase() ?? "")
              .join("")}
          </span>
        </div>
      )}

      {/* Audio solo para tracks de cámara/micro — no para pantalla compartida */}
      {!isScreenShare && <audio ref={audioRef} autoPlay hidden />}

      <div className="conf-tile__footer">
        <span className="conf-tile__name">
          {participant.name ?? participant.identity}
        </span>
        {roleLabel && (
          <span className="conf-tile__role">{roleLabel}</span>
        )}
        {!isScreenShare && (
          <span
            className={`conf-tile__mic${isMuted ? " conf-tile__mic--muted" : " conf-tile__mic--on"}`}
            title={isMuted ? "Micrófono silenciado" : "Micrófono activo"}
            aria-label={isMuted ? "Micrófono silenciado" : "Micrófono activo"}
          >
            {isMuted ? "🔇" : "🎤"}
          </span>
        )}
        {speakerTimer && (
          <span className="conf-tile__timer">{speakerTimer}</span>
        )}
      </div>
    </div>
  );
}
