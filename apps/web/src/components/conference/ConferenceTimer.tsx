/** Cronómetro de cuenta regresiva para el turno activo. */

interface ConferenceTimerProps {
  secondsLeft: number;
  totalSeconds: number;
}

export function ConferenceTimer({ secondsLeft, totalSeconds }: ConferenceTimerProps) {
  const minutes = Math.floor(secondsLeft / 60);
  const secs    = secondsLeft % 60;
  const pct     = totalSeconds > 0 ? (secondsLeft / totalSeconds) * 100 : 0;

  const color = pct > 40 ? "#22c55e" : pct > 15 ? "#f59e0b" : "#ef4444";

  return (
    <div className="conf-timer">
      <svg viewBox="0 0 40 40" className="conf-timer__ring">
        <circle cx="20" cy="20" r="17" fill="none" stroke="#ffffff18" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r="17"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={`${(pct / 100) * 106.8} 106.8`}
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
          style={{ transition: "stroke-dasharray 0.9s linear, stroke 0.5s" }}
        />
      </svg>
      <span className="conf-timer__label" style={{ color }}>
        {String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
    </div>
  );
}
