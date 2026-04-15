export function Skeleton({ width = "100%", height = 16, radius = 6, className }: {
  width?: string | number;
  height?: string | number;
  radius?: number;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        width,
        height,
        borderRadius: radius,
        background: "linear-gradient(90deg, var(--muted) 25%, color-mix(in srgb, var(--muted) 60%, var(--border)) 50%, var(--muted) 75%)",
        backgroundSize: "200% 100%",
        animation: "skeleton-shimmer 1.4s ease infinite"
      }}
    />
  );
}

export function SkeletonCard({ rows = 3, height = 80 }: { rows?: number; height?: number }) {
  return (
    <div className="card-base" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, height }}>
      <Skeleton width="45%" height={12} />
      {Array.from({ length: rows - 1 }).map((_, i) => (
        <Skeleton key={i} width={i === rows - 2 ? "60%" : "90%"} height={10} />
      ))}
    </div>
  );
}

export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  const widths = ["30%", "20%", "15%", "12%", "8%"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 0", borderBottom: "0.5px solid var(--border)" }}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} width={widths[i % widths.length]} height={10} />
      ))}
    </div>
  );
}
