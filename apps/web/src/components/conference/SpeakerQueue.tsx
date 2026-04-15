/**
 * Panel de cola de participación — solo para el administrador.
 * Muestra los participantes en espera y permite aprobar / rechazar.
 */

import { useState } from "react";
import type { SpeakerApproveInput, SpeakerQueueEntry, SpeakDuration, SpeakModalidad } from "@kuoro/contracts";

interface SpeakerQueueProps {
  queue: SpeakerQueueEntry[];
  currentSpeaker: SpeakerQueueEntry | null;
  secondsLeft: number;
  isLoading: boolean;
  onApprove: (entryId: string, input: SpeakerApproveInput) => Promise<void>;
  onReject: (entryId: string) => Promise<void>;
  onFinish: (entryId: string) => Promise<void>;
}

const DURATIONS: SpeakDuration[] = [1, 3, 5];

export function SpeakerQueue({
  queue,
  currentSpeaker,
  secondsLeft,
  isLoading,
  onApprove,
  onReject,
  onFinish,
}: SpeakerQueueProps) {
  const [duration, setDuration] = useState<SpeakDuration>(3);
  const [modalidad, setModalidad] = useState<SpeakModalidad>("mic");

  const waiting = queue.filter((e) => e.status === "waiting");

  return (
    <div className="conf-queue">
      <h3 className="conf-queue__title">
        Cola de participación
        {waiting.length > 0 && (
          <span className="conf-queue__badge">{waiting.length}</span>
        )}
      </h3>

      {/* Turno activo */}
      {currentSpeaker && (
        <div className="conf-queue__active">
          <div className="conf-queue__active-header">
            <span className="conf-queue__active-dot" />
            <span className="conf-queue__active-name">{currentSpeaker.displayName}</span>
            <span className="conf-queue__active-meta">
              {currentSpeaker.modalidad === "mic_camera" ? "Mic + Cámara" : "Solo mic"}
            </span>
            <span className="conf-queue__active-timer">
              {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:
              {String(secondsLeft % 60).padStart(2, "0")}
            </span>
          </div>
          <button
            type="button"
            className="conf-queue__btn conf-queue__btn--danger"
            disabled={isLoading}
            onClick={() => onFinish(currentSpeaker.id)}
          >
            Finalizar turno
          </button>
        </div>
      )}

      {/* Sin espera */}
      {waiting.length === 0 && !currentSpeaker && (
        <p className="conf-queue__empty">No hay solicitudes en este momento.</p>
      )}

      {/* Lista de espera */}
      {waiting.length > 0 && (
        <>
          <div className="conf-queue__controls">
            <div className="conf-queue__control-group">
              <label className="conf-queue__control-label">Duración</label>
              <div className="conf-queue__pills">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`conf-queue__pill${duration === d ? " conf-queue__pill--active" : ""}`}
                    onClick={() => setDuration(d)}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>
            <div className="conf-queue__control-group">
              <label className="conf-queue__control-label">Modalidad</label>
              <div className="conf-queue__pills">
                <button
                  type="button"
                  className={`conf-queue__pill${modalidad === "mic" ? " conf-queue__pill--active" : ""}`}
                  onClick={() => setModalidad("mic")}
                >
                  Solo mic
                </button>
                <button
                  type="button"
                  className={`conf-queue__pill${modalidad === "mic_camera" ? " conf-queue__pill--active" : ""}`}
                  onClick={() => setModalidad("mic_camera")}
                >
                  Mic + Cámara
                </button>
              </div>
            </div>
          </div>

          <ul className="conf-queue__list">
            {waiting.map((entry) => (
              <li key={entry.id} className="conf-queue__item">
                <div className="conf-queue__item-info">
                  <span className="conf-queue__item-name">{entry.displayName}</span>
                  <span className="conf-queue__item-time">
                    {new Date(entry.requestedAt).toLocaleTimeString("es-CO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="conf-queue__item-actions">
                  <button
                    type="button"
                    className="conf-queue__btn conf-queue__btn--approve"
                    disabled={isLoading || Boolean(currentSpeaker)}
                    title={currentSpeaker ? "Finaliza el turno actual antes de aprobar otro" : ""}
                    onClick={() =>
                      onApprove(entry.id, { modalidad, durationMinutes: duration } as import("@kuoro/contracts").SpeakerApproveInput)
                    }
                  >
                    Dar palabra
                  </button>
                  <button
                    type="button"
                    className="conf-queue__btn conf-queue__btn--reject"
                    disabled={isLoading}
                    onClick={() => onReject(entry.id)}
                  >
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
