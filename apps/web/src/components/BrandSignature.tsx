type BrandSignatureProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
};

export function BrandSignature({ eyebrow, title = "Kuoro", subtitle, compact = false }: BrandSignatureProps) {
  return (
    <div className={`brand-signature ${compact ? "brand-signature-compact" : ""}`}>
      <div className="brand-mark" aria-hidden="true">
        <span className="brand-mark-core" />
      </div>
      <div className="brand-copy">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <strong>{title}</strong>
        {subtitle ? <span className="brand-subtitle">{subtitle}</span> : null}
      </div>
    </div>
  );
}
