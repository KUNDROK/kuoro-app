import { randomUUID } from "node:crypto";
import type { CampaignAudience, CampaignPurpose, CampaignStatus, ChannelType } from "@kuoro/contracts";
import { prisma } from "../../lib/prisma";

export async function listCommunicationCampaigns(propertyId: string) {
  return prisma.communicationCampaign.findMany({
    where: { propertyId },
    orderBy: { createdAt: "desc" }
  });
}

export async function createDraftCampaign(input: {
  propertyId: string;
  assemblyId?: string | null;
  name: string;
  purpose: CampaignPurpose;
  audience?: CampaignAudience;
  primaryChannels: ChannelType[];
  fallbackChannel?: string | null;
}) {
  return prisma.communicationCampaign.create({
    data: {
      id: randomUUID(),
      propertyId: input.propertyId,
      assemblyId: input.assemblyId ?? null,
      name: input.name.trim(),
      purpose: input.purpose,
      audience: input.audience ?? "all",
      primaryChannels: input.primaryChannels,
      fallbackChannel: input.fallbackChannel ?? null,
      status: "draft" as CampaignStatus
    }
  });
}
