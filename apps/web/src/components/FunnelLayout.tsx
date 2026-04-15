import { Link } from "react-router-dom";

type FunnelLayoutProps = {
  children: React.ReactNode;
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

/** Marco visual alineado al landing (oscuro) para páginas del embudo de compra. */
export function FunnelLayout({ children, eyebrow, title, subtitle }: FunnelLayoutProps) {
  return (
    <div className="landing-root" style={{ minHeight: "100vh", backgroundColor: "#06040F", color: "#FFFFFF" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          height: 56,
          borderBottom: "0.5px solid rgba(255,255,255,0.06)",
          backgroundColor: "rgba(6,4,15,0.92)",
          backdropFilter: "blur(12px)"
        }}
      >
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "linear-gradient(135deg, #6258C4 0%, #9B7FE8 100%)"
            }}
          />
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              background: "linear-gradient(90deg, #FFFFFF 0%, #9B7FE8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent"
            }}
          >
            Kuoro
          </span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link to="/login-admin" style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>
            Ingresar
          </Link>
          <Link
            to="/contratar"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "#fff",
              textDecoration: "none",
              padding: "6px 14px",
              borderRadius: 8,
              background: "linear-gradient(90deg, #6258C4 0%, #9B7FE8 100%)"
            }}
          >
            Planes
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "40px 24px 72px" }}>
        {eyebrow && (
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(196,181,253,0.55)", margin: "0 0 10px" }}>
            {eyebrow}
          </p>
        )}
        <h1 style={{ fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 12px", lineHeight: 1.15 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", margin: "0 0 36px", lineHeight: 1.65, maxWidth: 560 }}>
            {subtitle}
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
