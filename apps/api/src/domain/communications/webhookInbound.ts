import { prisma } from "../../lib/prisma";

export type WebhookPayload = {
  event: string;
  providerMessageId?: string;
  trackingToken?: string;
  raw?: Record<string, unknown>;
};

/**
 * Actualiza una entrega con eventos de proveedor (entregado, abierto, fallo…).
 * En producción, validar firma del proveedor antes de llamar esto.
 */
export async function applyCommunicationWebhook(provider: string, payload: WebhookPayload) {
  if (!payload.providerMessageId && !payload.trackingToken) {
    return { ok: false as const, reason: "missing_ids" };
  }

  const delivery = await prisma.communicationDelivery.findFirst({
    where: {
      OR: [
        ...(payload.providerMessageId ? [{ providerMessageId: payload.providerMessageId }] : []),
        ...(payload.trackingToken ? [{ trackingToken: payload.trackingToken }] : [])
      ]
    }
  });

  if (!delivery) {
    return { ok: false as const, reason: "delivery_not_found" };
  }

  let events: Array<Record<string, unknown>> = [];
  try {
    events = JSON.parse(delivery.eventsJson ?? "[]") as Array<Record<string, unknown>>;
  } catch {
    events = [];
  }

  events.push({
    at: new Date().toISOString(),
    provider,
    event: payload.event,
    raw: payload.raw
  });

  let nextStatus = delivery.status;
  if (payload.event === "delivered" || payload.event === "sent") nextStatus = "delivered";
  if (payload.event === "opened") nextStatus = "opened";
  if (payload.event === "clicked") nextStatus = "clicked";
  if (payload.event === "failed" || payload.event === "bounced") nextStatus = "failed";

  await prisma.communicationDelivery.update({
    where: { id: delivery.id },
    data: {
      eventsJson: JSON.stringify(events),
      status: nextStatus,
      updatedAt: new Date()
    }
  });

  return { ok: true as const, deliveryId: delivery.id };
}
