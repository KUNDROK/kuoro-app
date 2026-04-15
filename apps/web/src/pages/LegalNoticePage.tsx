import { Link, Navigate, useParams } from "react-router-dom";

const DOCS: Record<string, { title: string; body: string[] }> = {
  terminos: {
    title: "Términos de uso",
    body: [
      "Este texto es un marcador de posición mientras se redacta el contrato completo de servicio (SaaS) para Kuoro.",
      "Al usar la demostración o el producto en fase beta aceptas no usar la plataforma para fines ilícitos y respetar la confidencialidad de los datos de copropiedades ajenas.",
      "La disponibilidad del servicio, los límites de uso y las exclusiones de garantía se detallarán en la versión final publicada aquí."
    ]
  },
  privacidad: {
    title: "Política de privacidad",
    body: [
      "Versión resumida de trabajo: tratamos los datos personales que nos confías para operar la copropiedad y las asambleas (identidad de administradores, propietarios y registros de votación según aplique).",
      "Implementaremos medidas técnicas y organizativas acordes a la Ley 1581 de 2012 (Habeas Data) y normativa aplicable en Colombia.",
      "Podrás ejercer derechos de consulta, rectificación y supresión cuando el módulo de privacidad esté conectado a tu cuenta."
    ]
  }
};

export function LegalNoticePage() {
  const { slug } = useParams();
  const doc = slug && DOCS[slug];

  if (!doc) {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--background)", color: "var(--foreground)", padding: 24 }}>
      <div className="card-base" style={{ maxWidth: 640, margin: "48px auto", padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 16px" }}>{doc.title}</h1>
        {doc.body.map((p, i) => (
          <p key={i} style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, margin: "0 0 14px" }}>
            {p}
          </p>
        ))}
        <p style={{ marginTop: 24 }}>
          <Link to="/" style={{ fontSize: 13, color: "var(--primary)", fontWeight: 500, textDecoration: "none" }}>
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
