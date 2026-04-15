import type { ChannelType, CommunicationProviderId } from "@kuoro/contracts";
import type { CommunicationProvider, ProviderFactory } from "./types";
import { ConsoleCommunicationProvider } from "./providers/ConsoleCommunicationProvider";
import { NoopCommunicationProvider } from "./providers/NoopCommunicationProvider";
import { ResendCommunicationProvider } from "./providers/ResendCommunicationProvider";
import { ResendProvider } from "../../lib/resendProvider";

const consoleSingleton = new ConsoleCommunicationProvider();
const noopSingleton = new NoopCommunicationProvider();
const resendApiSingleton = new ResendProvider();
const resendCommSingleton = new ResendCommunicationProvider(resendApiSingleton);

const builtIn: Partial<Record<CommunicationProviderId, CommunicationProvider>> = {
  console: consoleSingleton,
  noop: noopSingleton,
  resend: resendCommSingleton,
};

/**
 * Resuelve un proveedor por id. Los conectores reales (Resend, Twilio, …) se registrarán aquí en fases posteriores.
 */
export function resolveCommunicationProvider(id: CommunicationProviderId): CommunicationProvider | null {
  return builtIn[id] ?? null;
}

export const defaultProviderFactory: ProviderFactory = (id: CommunicationProviderId) =>
  resolveCommunicationProvider(id);

/** Elige proveedor para un canal según la configuración del tenant (JSON en BD). */
export function pickProviderForChannel(
  channel: ChannelType,
  bindings: Partial<Record<ChannelType, CommunicationProviderId>>
): CommunicationProvider {
  const id = bindings[channel] ?? "console";
  return resolveCommunicationProvider(id) ?? consoleSingleton;
}
