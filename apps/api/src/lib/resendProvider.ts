import { Resend } from "resend";
import { logger } from "./logger";

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  /** Texto plano (multipart); recomendado junto a HTML */
  text?: string;
};

/**
 * Envío de correo vía Resend. Requiere `RESEND_API_KEY` en el entorno.
 * Opcional: `RESEND_FROM_EMAIL` (p. ej. noreply@kuoro.io tras verificar kuoro.io en Resend); si falta, se usa onboarding@resend.dev (solo pruebas).
 */
export class ResendProvider {
  private client: Resend | null = null;

  private getClient(): Resend | null {
    const key = process.env.RESEND_API_KEY?.trim();
    if (!key) {
      return null;
    }
    if (!this.client) {
      this.client = new Resend(key);
    }
    return this.client;
  }

  async sendEmail({ to, subject, html, text }: SendEmailParams): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    const key = process.env.RESEND_API_KEY?.trim();
    if (!key) {
      return {
        success: false,
        error:
          "RESEND_API_KEY no está definida o está vacía. Configúrala en .env para enviar correos.",
      };
    }

    const resend = this.getClient();
    if (!resend) {
      return {
        success: false,
        error:
          "RESEND_API_KEY no está definida o está vacía. Configúrala en .env para enviar correos.",
      };
    }

    const from =
      process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";

    logger.info("resend", "Enviando correo", { to, subject });

    try {
      const { data, error } = await resend.emails.send({
        from,
        to,
        subject,
        html,
        ...(text?.trim() ? { text: text.trim() } : {}),
      });

      if (error) {
        logger.error("resend", "Error de API Resend", {
          message: error.message,
          name: error.name,
          statusCode: error.statusCode,
        });
        return { success: false, error: error.message };
      }

      const messageId = data?.id;
      if (!messageId) {
        logger.error("resend", "Respuesta sin id de mensaje", {});
        return { success: false, error: "Resend no devolvió un id de mensaje" };
      }

      logger.info("resend", "Correo enviado", { messageId, to });
      return { success: true, messageId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("resend", "Excepción al enviar correo", { message });
      return { success: false, error: message };
    }
  }
}
