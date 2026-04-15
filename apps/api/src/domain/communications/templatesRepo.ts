import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";

export async function listTemplates(propertyId: string) {
  return prisma.communicationTemplate.findMany({
    where: { propertyId },
    orderBy: [{ channel: "asc" }, { templateKey: "asc" }]
  });
}

export async function upsertTemplate(input: {
  propertyId: string;
  templateKey: string;
  channel: string;
  name: string;
  subjectTemplate?: string | null;
  bodyTemplate: string;
  isActive?: boolean;
}) {
  return prisma.communicationTemplate.upsert({
    where: {
      propertyId_templateKey_channel: {
        propertyId: input.propertyId,
        templateKey: input.templateKey,
        channel: input.channel
      }
    },
    create: {
      id: randomUUID(),
      propertyId: input.propertyId,
      templateKey: input.templateKey,
      channel: input.channel,
      name: input.name,
      subjectTemplate: input.subjectTemplate ?? null,
      bodyTemplate: input.bodyTemplate,
      isActive: input.isActive ?? true
    },
    update: {
      name: input.name,
      subjectTemplate: input.subjectTemplate ?? null,
      bodyTemplate: input.bodyTemplate,
      isActive: input.isActive ?? true
    }
  });
}

export async function deleteTemplate(propertyId: string, templateId: string) {
  await prisma.communicationTemplate.deleteMany({
    where: { id: templateId, propertyId }
  });
}
