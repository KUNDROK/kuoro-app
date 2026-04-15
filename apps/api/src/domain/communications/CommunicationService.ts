import { randomUUID } from "node:crypto";
import type { ChannelType, CommunicationUseCase } from "@kuoro/contracts";
import type { CommunicationProvider, OutboundMessage, SendResult } from "./types";
import { pickProviderForChannel } from "./providerRegistry";
import type { CommunicationProviderId } from "@kuoro/contracts";

export type TenantCommunicationConfig = {
  enabledChannels: ChannelType[];
  providerBindings: Partial<Record<ChannelType, CommunicationProviderId>>;
  defaultChannelsByUseCase: Partial<Record<CommunicationUseCase, ChannelType>>;
  fallbackChannel: ChannelType | null;
};

/**
 * Servicio central: la lógica de negocio usa este tipo, no SDKs de terceros.
 */
export class CommunicationService {
  constructor(private readonly tenant: TenantCommunicationConfig) {}

  isChannelEnabled(channel: ChannelType): boolean {
    return this.tenant.enabledChannels.includes(channel);
  }

  suggestedChannel(useCase: CommunicationUseCase): ChannelType | null {
    return this.tenant.defaultChannelsByUseCase[useCase] ?? null;
  }

  resolveProvider(channel: ChannelType): CommunicationProvider {
    return pickProviderForChannel(channel, this.tenant.providerBindings);
  }

  async send(
    channel: ChannelType,
    message: Omit<OutboundMessage, "channel">
  ): Promise<SendResult> {
    if (!this.isChannelEnabled(channel)) {
      const fb = this.tenant.fallbackChannel;
      if (fb && this.isChannelEnabled(fb)) {
        return this.send(fb, { ...message, bodyText: `[fallback:${channel}] ${message.bodyText}` });
      }
      return { status: "failed", error: `Channel ${channel} is disabled for this property` };
    }
    const provider = this.resolveProvider(channel);
    return provider.send({ ...message, channel });
  }

  /** Placeholder para registro de entrega en BD (Fase 1: devuelve id local). */
  createTrackingToken(): string {
    return randomUUID().replace(/-/g, "");
  }
}

export function communicationServiceFromBindings(
  enabled: ChannelType[],
  bindings: Partial<Record<ChannelType, CommunicationProviderId>>,
  defaults: Partial<Record<CommunicationUseCase, ChannelType>>,
  fallback: ChannelType | null
): CommunicationService {
  return new CommunicationService({
    enabledChannels: enabled.length ? enabled : ["email"],
    providerBindings: bindings,
    defaultChannelsByUseCase: defaults,
    fallbackChannel: fallback
  });
}
