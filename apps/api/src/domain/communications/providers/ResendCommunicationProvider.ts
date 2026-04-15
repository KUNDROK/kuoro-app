import type { CommunicationProvider, OutboundMessage, SendResult } from "../types";
import type { ChannelType, CommunicationProviderId } from "@kuoro/contracts";
import { ResendProvider } from "../../../lib/resendProvider";
import { escapeHtml } from "../../../lib/email/communicationEmailTemplate";

/**
 * Envío real de email vía Resend (HTML + texto plano opcional).
 */
export class ResendCommunicationProvider implements CommunicationProvider {
  readonly id: CommunicationProviderId = "resend";
  readonly supportedChannels: ChannelType[] = ["email"];

  constructor(private readonly resend: ResendProvider) {}

  async send(message: OutboundMessage): Promise<SendResult> {
    if (message.channel !== "email") {
      return {
        status: "failed",
        error: "Resend solo admite el canal email",
        providerId: "resend",
      };
    }

    const subject = message.subject?.trim() || "(sin asunto)";
    const html =
      message.bodyHtml?.trim() ||
      `<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1a1a2e;">${escapeHtml(message.bodyText)}</p>`;

    const r = await this.resend.sendEmail({
      to: message.to.trim(),
      subject,
      html,
      text: message.bodyText?.trim() || undefined,
    });

    if (r.success) {
      return {
        status: "sent",
        providerMessageId: r.messageId,
        providerId: "resend",
      };
    }
    return {
      status: "failed",
      error: r.error ?? "Resend error",
      providerId: "resend",
    };
  }
}
