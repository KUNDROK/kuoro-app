import { randomUUID } from "node:crypto";
import type { ChannelType, CommunicationUseCase } from "@kuoro/contracts";
import { prisma } from "../../lib/prisma";
import { getOrCreateCommunicationSettings } from "./settingsRepo";
import { communicationServiceFromBindings } from "./CommunicationService";
import {
  renderCommunicationEmailPlainText,
  renderCommunicationEmailTemplate,
} from "../../lib/email/communicationEmailTemplate";
import { resolveAppBaseUrl } from "../../lib/appUrls";

function settingsToService(settings: Awaited<ReturnType<typeof getOrCreateCommunicationSettings>>) {
  return communicationServiceFromBindings(
    settings.enabledChannels,
    settings.providerBindings,
    settings.defaultChannelsByUseCase as Partial<Record<CommunicationUseCase, ChannelType>>,
    settings.fallbackChannel
  );
}

function campaignPurposeToBadge(purpose: string): string {
  switch (purpose) {
    case "convocatoria":
      return "Convocatoria";
    case "reminder":
      return "Recordatorio";
    case "document_request":
      return "Solicitud de documento";
    case "ad_hoc":
      return "Comunicación";
    case "custom":
      return "Comunicación";
    default:
      return "Comunicación";
  }
}

function defaultTitleForPurpose(purpose: string, campaignName: string): string {
  switch (purpose) {
    case "convocatoria":
      return "Ha sido convocado/a a la asamblea";
    case "reminder":
      return "Recordatorio de su copropiedad";
    case "document_request":
      return "Se ha solicitado un documento";
    case "ad_hoc":
      return "Tiene un mensaje de la administración";
    case "custom":
      return `Comunicación: ${campaignName}`;
    default:
      return `Comunicación: ${campaignName}`;
  }
}

function defaultIntroForPurpose(purpose: string, campaignName: string, purposeLine: string): string {
  switch (purpose) {
    case "convocatoria":
      return "La administración le informa que debe tomar conocimiento de la convocatoria y completar las acciones indicadas en el enlace, dentro de los plazos establecidos.";
    case "reminder":
      return "Este es un recordatorio relacionado con las gestiones de su copropiedad. Por favor revise la información y complete lo pendiente a la mayor brevedad.";
    case "document_request":
      return "Debe cargar o remitir la documentación solicitada para continuar con el trámite. Los detalles se indican a continuación.";
    case "ad_hoc":
    case "custom":
      return `Mensaje referente a «${campaignName}». Consulte el enlace para más información.`;
    default:
      return purposeLine;
  }
}

/**
 * Envío de prueba o primer lote: crea entregas y usa el motor (Resend si está configurado, o console).
 */
export async function dispatchCampaignTest(input: {
  propertyId: string;
  campaignId: string;
  channel: ChannelType;
  testRecipient: string;
  subject?: string;
  body?: string;
  ctaUrl?: string;
  ctaLabel?: string;
  recipientName?: string;
  unitLabel?: string;
  deadline?: string;
  documentTypeLabel?: string;
}) {
  const campaign = await prisma.communicationCampaign.findFirst({
    where: { id: input.campaignId, propertyId: input.propertyId },
  });
  if (!campaign) {
    throw Object.assign(new Error("Campaña no encontrada"), { statusCode: 404 });
  }

  const property = await prisma.property.findUnique({
    where: { id: input.propertyId },
    select: { name: true },
  });

  const assembly = campaign.assemblyId
    ? await prisma.assembly.findUnique({
        where: { id: campaign.assemblyId },
        select: { title: true, scheduledAt: true },
      })
    : null;

  const settingsRow = await getOrCreateCommunicationSettings(input.propertyId);
  const svc = settingsToService(settingsRow);

  const title =
    input.subject?.trim() || defaultTitleForPurpose(campaign.purpose, campaign.name);
  const subject = title;
  const purposeLine = `Campaña: ${campaign.name}\nPropósito: ${campaign.purpose}`;

  const introFromInput = input.body?.trim();
  const introText =
    introFromInput ||
    defaultIntroForPurpose(campaign.purpose, campaign.name, purposeLine);

  const scheduled = assembly?.scheduledAt;
  const eventDate = scheduled
    ? new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(scheduled)
    : undefined;
  const eventTime = scheduled
    ? new Intl.DateTimeFormat("es-CO", { timeStyle: "short" }).format(scheduled)
    : undefined;

  const fallbackAppUrl = resolveAppBaseUrl();

  const templateData = {
    preheader: `${title} — ${property?.name ?? "Kuoro"}`,
    badgeLabel: campaignPurposeToBadge(campaign.purpose),
    title,
    introText,
    recipientName: input.recipientName?.trim(),
    unitLabel: input.unitLabel?.trim(),
    assemblyName: assembly?.title?.trim(),
    eventDate,
    eventTime,
    deadline: input.deadline?.trim(),
    documentTypeLabel: input.documentTypeLabel?.trim(),
    ctaLabel: input.ctaLabel?.trim() || "Ver detalles",
    ctaUrl: input.ctaUrl?.trim() || fallbackAppUrl,
    contactEmail: settingsRow.senderEmailFrom?.trim() || undefined,
    propertyName: property?.name?.trim(),
  };

  const bodyHtml =
    input.channel === "email" ? renderCommunicationEmailTemplate(templateData) : undefined;

  const bodyText =
    input.channel === "email"
      ? renderCommunicationEmailPlainText(templateData)
      : [subject, introFromInput || purposeLine, templateData.ctaUrl ? `Enlace: ${templateData.ctaUrl}` : ""]
          .filter(Boolean)
          .join("\n\n");

  const trackingToken = randomUUID().replace(/-/g, "");
  const sendResult = await svc.send(input.channel, {
    to: input.testRecipient.trim(),
    subject,
    bodyText,
    bodyHtml,
  });

  const providerType = sendResult.providerId ?? "console";
  const status = sendResult.status === "sent" ? "sent" : "failed";

  const delivery = await prisma.communicationDelivery.create({
    data: {
      id: randomUUID(),
      propertyId: input.propertyId,
      campaignId: input.campaignId,
      assemblyId: campaign.assemblyId,
      channel: input.channel,
      providerType,
      status,
      useCase: campaign.purpose,
      trackingToken,
      providerMessageId: sendResult.providerMessageId,
      lastError: sendResult.error ?? null,
      eventsJson: JSON.stringify([
        {
          at: new Date().toISOString(),
          type: "dispatch",
          detail: "test_send",
        },
      ]),
      sentAt: sendResult.status === "sent" ? new Date() : null,
    },
  });

  await prisma.communicationCampaign.update({
    where: { id: input.campaignId },
    data: {
      status: "completed",
      completedAt: new Date(),
      startedAt: new Date(),
      statsJson: JSON.stringify({ deliveries: 1, channel: input.channel }),
    },
  });

  return { delivery, sendResult };
}
