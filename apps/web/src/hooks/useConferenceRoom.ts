/**
 * Hook para conectarse a una room de LiveKit.
 *
 * Abstrae la gestión de la conexión, el token y la reconexión.
 * Usa @livekit/components-react internamente a través de `useRoomContext`
 * pero también puede operar sin el provider usando Room directamente.
 *
 * Para el admin: llama fetchConferenceToken (con auth).
 * Para asistentes: llama fetchAttendeeToken (sin auth de admin).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, ConnectionState } from "livekit-client";
import { fetchConferenceToken, fetchAttendeeToken } from "../lib/api";

export type ConferenceParticipantRole = "admin" | "attendee";

interface UseConferenceRoomOptions {
  propertyId: string;
  assemblyId: string;
  role: ConferenceParticipantRole;
  /** Solo para asistentes: su identidad única y nombre a mostrar. */
  attendeeIdentity?: string;
  attendeeDisplayName?: string;
  /** Callback cuando cambia el estado de conexión. */
  onConnectionStateChange?: (state: ConnectionState) => void;
}

interface UseConferenceRoomReturn {
  room: Room | null;
  connectionState: ConnectionState;
  participantIdentity: string | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export function useConferenceRoom({
  propertyId,
  assemblyId,
  role,
  attendeeIdentity,
  attendeeDisplayName,
  onConnectionStateChange,
}: UseConferenceRoomOptions): UseConferenceRoomReturn {
  const [room, setRoom]                         = useState<Room | null>(null);
  const [connectionState, setConnectionState]   = useState<ConnectionState>(ConnectionState.Disconnected);
  const [participantIdentity, setIdentity]      = useState<string | null>(null);
  const [isConnecting, setIsConnecting]         = useState(false);
  const [error, setError]                       = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);

  const disconnect = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
      setRoom(null);
      setConnectionState(ConnectionState.Disconnected);
      setIdentity(null);
    }
  }, []);

  const connect = useCallback(async () => {
    if (isConnecting || connectionState === ConnectionState.Connected) return;
    setIsConnecting(true);
    setError(null);

    try {
      // Obtener token y URL del backend
      const tokenRes = role === "admin"
        ? await fetchConferenceToken(propertyId, assemblyId)
        : await fetchAttendeeToken(
            propertyId,
            assemblyId,
            attendeeIdentity ?? `attendee-${crypto.randomUUID()}`,
            attendeeDisplayName ?? "Participante",
          );

      setIdentity(tokenRes.participantIdentity);

      const lkRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        // Publicar audio/vídeo solo bajo demanda (ahorro de costos)
        stopLocalTrackOnUnpublish: true,
      });

      // Escuchar eventos de conexión
      lkRoom.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        setConnectionState(state);
        onConnectionStateChange?.(state);
      });

      lkRoom.on(RoomEvent.Disconnected, () => {
        setConnectionState(ConnectionState.Disconnected);
      });

      await lkRoom.connect(tokenRes.livekitUrl, tokenRes.token);

      roomRef.current = lkRoom;
      setRoom(lkRoom);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible conectar con la sala");
    } finally {
      setIsConnecting(false);
    }
  }, [
    isConnecting,
    connectionState,
    propertyId,
    assemblyId,
    role,
    attendeeIdentity,
    attendeeDisplayName,
    onConnectionStateChange,
  ]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
    };
  }, []);

  return {
    room,
    connectionState,
    participantIdentity,
    isConnecting,
    isConnected: connectionState === ConnectionState.Connected,
    error,
    connect,
    disconnect,
  };
}
