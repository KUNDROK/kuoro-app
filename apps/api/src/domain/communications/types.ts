import type { ChannelType, CommunicationProviderId } from "@kuoro/contracts";

/** Mensaje agnóstico de proveedor — la capa de dominio solo conoce esto. */
export type OutboundMessage = {
  channel: ChannelType;
  to: string;
  subject?: string;
  bodyText: string;
  bodyHtml?: string;
  metadata?: Record<string, unknown>;
};

export type SendResult = {
  providerMessageId?: string;
  status: "queued" | "sent" | "failed";
  error?: string;
  /** Proveedor que procesó el envío (auditoría / CommunicationDelivery.providerType) */
  providerId?: CommunicationProviderId;
};

/**
 * Contrato de proveedor: implementación concreta (Resend, Twilio, etc.) detrás de este interface.
 */
export interface CommunicationProvider {
  readonly id: CommunicationProviderId;
  readonly supportedChannels: ChannelType[];
  send(message: OutboundMessage): Promise<SendResult>;
}

export type ProviderFactory = (providerId: CommunicationProviderId) => CommunicationProvider | null;
