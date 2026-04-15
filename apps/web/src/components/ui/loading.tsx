import { AnimatePresence, motion } from "framer-motion";

// ─── Spinner atom (reusable internally) ──────────────────────────────────────

function KuoroSpinner({ size = 40 }: { size?: number }) {
  const s = size;
  const stroke = Math.max(2, s * 0.07);
  const r1 = (s / 2) - stroke;
  const r2 = r1 * 0.65;
  const cx = s / 2;
  const cy = s / 2;
  const c1 = 2 * Math.PI * r1;
  const c2 = 2 * Math.PI * r2;

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      fill="none"
      style={{ flexShrink: 0 }}
    >
      {/* Outer track */}
      <circle cx={cx} cy={cy} r={r1} stroke="currentColor" strokeWidth={stroke} opacity={0.1} />
      {/* Outer arc — spins CW */}
      <circle
        cx={cx} cy={cy} r={r1}
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c1 * 0.28} ${c1 * 0.72}`}
        style={{ animation: "kuoro-spin 1.1s linear infinite", transformOrigin: `${cx}px ${cy}px` }}
      />
      {/* Inner track */}
      <circle cx={cx} cy={cy} r={r2} stroke="currentColor" strokeWidth={stroke} opacity={0.1} />
      {/* Inner arc — spins CCW, offset */}
      <circle
        cx={cx} cy={cy} r={r2}
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c2 * 0.18} ${c2 * 0.82}`}
        style={{ animation: "kuoro-spin-reverse 0.8s linear infinite", transformOrigin: `${cx}px ${cy}px` }}
        opacity={0.7}
      />
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={stroke * 1.1} fill="currentColor" opacity={0.5} />
    </svg>
  );
}

// ─── Dot wave (for section / inline) ─────────────────────────────────────────

function DotWave({ size = 6, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.6 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            backgroundColor: color,
            animation: `kuoro-dot-bounce 1.2s ease-in-out ${i * 0.16}s infinite`
          }}
        />
      ))}
    </div>
  );
}

// ─── Bar wave ────────────────────────────────────────────────────────────────

function BarWave({ height = 20 }: { height?: number }) {
  const delays = [0, 0.1, 0.2, 0.1, 0];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height }}>
      {delays.map((d, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: `${40 + i * 15 + (i > 2 ? (4 - i) * 15 : 0)}%`,
            borderRadius: 2,
            backgroundColor: "currentColor",
            animation: `kuoro-bar-grow 1s ease-in-out ${d}s infinite`,
            transformOrigin: "bottom"
          }}
        />
      ))}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LoadingVariant = "overlay" | "section" | "inline";

interface LoadingProps {
  /** Whether to show the loader */
  visible?: boolean;
  /** Short label shown below the spinner */
  message?: string;
  /** "overlay" = full screen, "section" = fills a container, "inline" = compact row */
  variant?: LoadingVariant;
  /** Minimum height for section variant (default 240px) */
  minHeight?: number;
}

// ─── Overlay (full-screen) ────────────────────────────────────────────────────

function OverlayLoader({ message }: { message?: string }) {
  return (
    <motion.div
      key="overlay-loader"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "color-mix(in srgb, var(--background) 80%, transparent)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)"
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 6 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          padding: "36px 48px",
          borderRadius: 16,
          backgroundColor: "var(--card)",
          border: "0.5px solid var(--border)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)",
          minWidth: 200
        }}
      >
        {/* Logo mark */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Pulse ring */}
          <div
            style={{
              position: "absolute",
              width: 64,
              height: 64,
              borderRadius: "50%",
              backgroundColor: "var(--primary)",
              opacity: 0.08,
              animation: "kuoro-pulse-ring 2s ease-in-out infinite"
            }}
          />
          <div style={{ color: "var(--primary)" }}>
            <KuoroSpinner size={48} />
          </div>
        </div>

        {/* Brand */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--primary)"
              }}
            >
              Kuoro
            </span>
            <BarWave height={14} />
          </div>
          {message && (
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, textAlign: "center", maxWidth: 180 }}>
              {message}
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Section (fills a container) ─────────────────────────────────────────────

function SectionLoader({ message, minHeight = 240 }: { message?: string; minHeight?: number }) {
  return (
    <motion.div
      key="section-loader"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight,
        gap: 14,
        color: "var(--primary)"
      }}
    >
      <KuoroSpinner size={36} />
      {message && (
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>{message}</p>
      )}
    </motion.div>
  );
}

// ─── Inline ───────────────────────────────────────────────────────────────────

function InlineLoader({ message }: { message?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        color: "var(--text-secondary)",
        fontSize: 12
      }}
    >
      <span style={{ color: "var(--primary)" }}>
        <DotWave size={5} />
      </span>
      {message && <span>{message}</span>}
    </span>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * LoadingModal — three variants:
 *
 *   <LoadingModal visible={isLoading} />                         // overlay
 *   <LoadingModal variant="section" visible={isLoading} />       // fills container
 *   <LoadingModal variant="inline" visible={isLoading} />        // compact row
 *
 * All variants accept an optional `message` prop.
 */
export function LoadingModal({
  visible = true,
  message,
  variant = "overlay",
  minHeight = 240
}: LoadingProps) {
  if (variant === "inline") {
    return visible ? <InlineLoader message={message} /> : null;
  }

  if (variant === "section") {
    return (
      <AnimatePresence>
        {visible && <SectionLoader message={message} minHeight={minHeight} />}
      </AnimatePresence>
    );
  }

  // overlay
  return (
    <AnimatePresence>
      {visible && <OverlayLoader message={message} />}
    </AnimatePresence>
  );
}

// Re-exports for convenience
export { KuoroSpinner, DotWave, BarWave };
