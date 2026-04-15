/**
 * Plantilla HTML transaccional Kuoro — tablas + estilos inline para clientes comunes (Gmail, Outlook, Apple Mail).
 */

export type CommunicationEmailTemplateData = {
  /** Texto de previsualización en bandeja (opcional) */
  preheader?: string;
  /** Etiqueta del tipo de mensaje (ej. Convocatoria) */
  badgeLabel: string;
  /** Título principal del correo */
  title: string;
  /** Párrafo introductorio (breve, formal) */
  introText: string;
  recipientName?: string;
  unitLabel?: string;
  assemblyName?: string;
  eventDate?: string;
  eventTime?: string;
  deadline?: string;
  documentTypeLabel?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  /** Email de contacto / administración (se muestra en footer y bloque de confianza) */
  contactEmail?: string;
  /** Nombre de la copropiedad */
  propertyName?: string;
  /** Texto opcional bajo la copropiedad (ej. administrador) */
  adminLabel?: string;
};

const BRAND_PRIMARY = "#5B52C7";
const BRAND_PRIMARY_DARK = "#4A43A8";
const TEXT_MAIN = "#1a1a2e";
const TEXT_MUTED = "#5c5c6f";
const BORDER = "#e8e8f0";
const SURFACE = "#f7f7fb";

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nl2br(s: string): string {
  return escapeHtml(s).replace(/\r\n/g, "\n").replace(/\n/g, "<br/>");
}

/** Fila de datos solo si hay valor */
function dataRow(label: string, value: string): string {
  return `
  <tr>
    <td style="padding:10px 16px;border-bottom:1px solid ${BORDER};font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${TEXT_MUTED};width:38%;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:10px 16px;border-bottom:1px solid ${BORDER};font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${TEXT_MAIN};font-weight:600;vertical-align:top;">${escapeHtml(value)}</td>
  </tr>`;
}

/**
 * Genera el HTML completo del correo transaccional Kuoro.
 */
export function renderCommunicationEmailTemplate(data: CommunicationEmailTemplateData): string {
  const preheader =
    data.preheader?.trim() ||
    `${data.title} — ${data.propertyName ?? "Kuoro"}`.slice(0, 140);

  const rows: string[] = [];
  if (data.recipientName?.trim()) rows.push(dataRow("Destinatario", data.recipientName.trim()));
  if (data.unitLabel?.trim()) rows.push(dataRow("Unidad", data.unitLabel.trim()));
  if (data.assemblyName?.trim()) rows.push(dataRow("Asamblea", data.assemblyName.trim()));
  if (data.eventDate?.trim()) rows.push(dataRow("Fecha", data.eventDate.trim()));
  if (data.eventTime?.trim()) rows.push(dataRow("Hora", data.eventTime.trim()));
  if (data.deadline?.trim()) rows.push(dataRow("Fecha límite", data.deadline.trim()));
  if (data.documentTypeLabel?.trim()) rows.push(dataRow("Documento", data.documentTypeLabel.trim()));

  const dataBlock =
    rows.length > 0
      ? `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;border:1px solid ${BORDER};border-radius:8px;overflow:hidden;background:#ffffff;">
  ${rows.join("")}
</table>`
      : "";

  const ctaLabel = data.ctaLabel?.trim() || "Ver detalles";
  const ctaUrl = data.ctaUrl?.trim();
  const ctaBlock = ctaUrl
    ? `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 8px 0;">
  <tr>
    <td align="center" style="border-radius:8px;background:${BRAND_PRIMARY};">
      <a href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener noreferrer"
        style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;line-height:1.2;">
        ${escapeHtml(ctaLabel)}
      </a>
    </td>
  </tr>
</table>`
    : "";

  const propertyLine = data.propertyName?.trim()
    ? `<p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#ffffff;">${escapeHtml(data.propertyName.trim())}</p>`
    : "";

  const trustContact = data.contactEmail?.trim()
    ? ` Si tiene dudas, puede responder a este correo o escribir a <a href="mailto:${escapeHtml(data.contactEmail.trim())}" style="color:${BRAND_PRIMARY_DARK};">${escapeHtml(data.contactEmail.trim())}</a>.`
    : " Si tiene dudas, puede responder a este correo o contactar a la administración de su copropiedad.";

  const trustLead = ctaUrl
    ? "Este enlace es personal y no debe reenviarse."
    : "Mantenga la confidencialidad de la información recibida.";

  const footerProperty = data.propertyName?.trim()
    ? `<p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${TEXT_MAIN};font-weight:600;">${escapeHtml(data.propertyName.trim())}</p>`
    : "";
  const footerAdmin = data.adminLabel?.trim()
    ? `<p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${TEXT_MUTED};">${escapeHtml(data.adminLabel.trim())}</p>`
    : "";
  const footerEmail = data.contactEmail?.trim()
    ? `<p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${TEXT_MUTED};"><a href="mailto:${escapeHtml(data.contactEmail.trim())}" style="color:${BRAND_PRIMARY};text-decoration:none;">${escapeHtml(data.contactEmail.trim())}</a></p>`
    : `<p style="margin:0 0 16px 0;font-size:12px;line-height:1;">&nbsp;</p>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(data.title)}</title>
</head>
<body style="margin:0;padding:0;background:${SURFACE};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:transparent;opacity:0;">
    ${escapeHtml(preheader)}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${SURFACE};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;">
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND_PRIMARY} 0%,${BRAND_PRIMARY_DARK} 100%);background-color:${BRAND_PRIMARY};border-radius:12px 12px 0 0;padding:22px 24px 20px 24px;">
              <p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,0.85);">Kuoro</p>
              ${propertyLine}
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:12px;">
                <tr>
                  <td style="background:rgba(255,255,255,0.2);border-radius:999px;padding:6px 12px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;color:#ffffff;">
                    ${escapeHtml(data.badgeLabel)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:28px 24px 8px 24px;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};">
              <h1 style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;line-height:1.25;color:${TEXT_MAIN};">
                ${escapeHtml(data.title)}
              </h1>
              <p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:${TEXT_MUTED};">
                ${nl2br(data.introText.trim())}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:0 24px 8px 24px;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};">
              ${dataBlock}
              ${ctaBlock}
            </td>
          </tr>
          <tr>
            <td style="background:${SURFACE};padding:20px 24px;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};border-top:1px solid ${BORDER};">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:${TEXT_MUTED};">
                ${trustLead}${trustContact} Este mensaje fue enviado a través de <strong style="color:${TEXT_MAIN};">Kuoro</strong>, plataforma de gestión de asambleas.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:22px 24px;border:1px solid ${BORDER};border-top:none;border-radius:0 0 12px 12px;">
              ${footerProperty}
              ${footerAdmin}
              ${footerEmail}
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9a9aad;line-height:1.5;">
                © ${new Date().getFullYear()} Kuoro · <a href="https://kuoro.io" style="color:${BRAND_PRIMARY};text-decoration:none;">kuoro.io</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Versión texto plano para multipart/alternative y clientes sin HTML */
export function renderCommunicationEmailPlainText(data: CommunicationEmailTemplateData): string {
  const lines: string[] = [];
  lines.push(`Kuoro — ${data.badgeLabel}`);
  if (data.propertyName?.trim()) lines.push(data.propertyName.trim());
  lines.push("");
  lines.push(data.title);
  lines.push("");
  lines.push(data.introText.trim());
  if (data.recipientName?.trim()) lines.push(`Destinatario: ${data.recipientName.trim()}`);
  if (data.unitLabel?.trim()) lines.push(`Unidad: ${data.unitLabel.trim()}`);
  if (data.assemblyName?.trim()) lines.push(`Asamblea: ${data.assemblyName.trim()}`);
  if (data.eventDate?.trim()) lines.push(`Fecha: ${data.eventDate.trim()}`);
  if (data.eventTime?.trim()) lines.push(`Hora: ${data.eventTime.trim()}`);
  if (data.deadline?.trim()) lines.push(`Fecha límite: ${data.deadline.trim()}`);
  if (data.documentTypeLabel?.trim()) lines.push(`Documento: ${data.documentTypeLabel.trim()}`);
  const url = data.ctaUrl?.trim();
  if (url) {
    lines.push("", `${data.ctaLabel?.trim() || "Enlace"}: ${url}`);
    lines.push("", "Enlace personal — no reenviar.");
  }
  if (data.contactEmail?.trim()) lines.push(`Contacto: ${data.contactEmail.trim()}`);
  lines.push("", "Enviado con Kuoro (https://kuoro.io)");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}
