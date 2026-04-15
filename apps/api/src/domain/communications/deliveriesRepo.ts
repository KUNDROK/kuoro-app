import { prisma } from "../../lib/prisma";

export async function listDeliveriesForProperty(propertyId: string, limit = 100) {
  return prisma.communicationDelivery.findMany({
    where: { propertyId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      campaign: { select: { id: true, name: true, purpose: true } }
    }
  });
}
