import type { CommunicationProvider, OutboundMessage, SendResult } from "../types";
import type { ChannelType, CommunicationProviderId } from "@kuoro/contracts";

/** Cola sin efectos — útil para tests o canales deshabilitados. */
export class NoopCommunicationProvider implements CommunicationProvider {
  readonly id: CommunicationProviderId = "noop";
  readonly supportedChannels: ChannelType[] = ["email", "sms", "whatsapp"];

  async send(_message: OutboundMessage): Promise<SendResult> {
    return { status: "queued", providerId: "noop" };
  }
}
