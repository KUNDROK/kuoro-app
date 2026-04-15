import type { CommunicationProvider, OutboundMessage, SendResult } from "../types";
import type { ChannelType, CommunicationProviderId } from "@kuoro/contracts";

/**
 * Proveedor de desarrollo: registra en consola sin enviar tráfico externo.
 */
export class ConsoleCommunicationProvider implements CommunicationProvider {
  readonly id: CommunicationProviderId = "console";
  readonly supportedChannels: ChannelType[] = ["email", "sms", "whatsapp"];

  async send(message: OutboundMessage): Promise<SendResult> {
    // eslint-disable-next-line no-console
    console.log(
      `[CommunicationProvider:console] channel=${message.channel} to=${message.to} subject=${message.subject ?? "(none)"}`
    );
    return {
      status: "sent",
      providerMessageId: `console-${Date.now()}`,
      providerId: "console",
    };
  }
}
