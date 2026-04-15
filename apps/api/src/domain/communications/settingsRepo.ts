import type {
  CommunicationSettings,
  CommunicationSettingsInput,
  ChannelType,
  CommunicationUseCase,
  CommunicationProviderId
} from "@kuoro/contracts";
import { prisma } from "../../lib/prisma";

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw?.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toApi(row: {
  id: string;
  propertyId: string;
  countryCode: string;
  locale: string;
  enabledChannels: string[];
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  defaultChannelsByUseCase: string | null;
  fallbackChannel: string | null;
  senderDisplayName: string | null;
  senderEmailFrom: string | null;
  senderSmsFrom: string | null;
  senderWhatsappFrom: string | null;
  providerBindingsJson: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CommunicationSettings {
  return {
    id: row.id,
    propertyId: row.propertyId,
    countryCode: row.countryCode,
    locale: row.locale,
    enabledChannels: (row.enabledChannels as ChannelType[]) ?? ["email"],
    emailEnabled: row.emailEnabled,
    smsEnabled: row.smsEnabled,
    whatsappEnabled: row.whatsappEnabled,
    defaultChannelsByUseCase: parseJson<Partial<Record<CommunicationUseCase, ChannelType>>>(
      row.defaultChannelsByUseCase,
      {}
    ),
    fallbackChannel: (row.fallbackChannel as ChannelType | null) ?? null,
    senderDisplayName: row.senderDisplayName,
    senderEmailFrom: row.senderEmailFrom,
    senderSmsFrom: row.senderSmsFrom,
    senderWhatsappFrom: row.senderWhatsappFrom,
    providerBindings: parseJson<Partial<Record<ChannelType, CommunicationProviderId>>>(
      row.providerBindingsJson,
      { email: "console", sms: "console", whatsapp: "console" }
    ),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

const defaultChannels: ChannelType[] = ["email"];

export async function getOrCreateCommunicationSettings(propertyId: string): Promise<CommunicationSettings> {
  const existing = await prisma.communicationSettings.findUnique({ where: { propertyId } });
  if (existing) return toApi(existing);

  const created = await prisma.communicationSettings.create({
    data: {
      propertyId,
      countryCode: "CO",
      locale: "es-CO",
      enabledChannels: defaultChannels,
      emailEnabled: true,
      smsEnabled: false,
      whatsappEnabled: false,
      defaultChannelsByUseCase: JSON.stringify({
        formal_notice: "email",
        convocatoria: "email",
        reminder_urgent: "sms",
        document_request: "email"
      } satisfies Partial<Record<CommunicationUseCase, ChannelType>>),
      fallbackChannel: "email",
      providerBindingsJson: JSON.stringify({
        email: process.env.RESEND_API_KEY?.trim() ? "resend" : "console",
        sms: "console",
        whatsapp: "console"
      } satisfies Partial<Record<ChannelType, CommunicationProviderId>>)
    }
  });

  return toApi(created);
}

export async function updateCommunicationSettings(
  propertyId: string,
  input: CommunicationSettingsInput
): Promise<CommunicationSettings> {
  await getOrCreateCommunicationSettings(propertyId);

  const data: Record<string, unknown> = {};

  if (input.countryCode !== undefined) data.countryCode = input.countryCode;
  if (input.locale !== undefined) data.locale = input.locale;
  if (input.enabledChannels !== undefined) data.enabledChannels = input.enabledChannels;
  if (input.emailEnabled !== undefined) data.emailEnabled = input.emailEnabled;
  if (input.smsEnabled !== undefined) data.smsEnabled = input.smsEnabled;
  if (input.whatsappEnabled !== undefined) data.whatsappEnabled = input.whatsappEnabled;
  if (input.defaultChannelsByUseCase !== undefined) {
    data.defaultChannelsByUseCase = JSON.stringify(input.defaultChannelsByUseCase);
  }
  if (input.fallbackChannel !== undefined) data.fallbackChannel = input.fallbackChannel;
  if (input.senderDisplayName !== undefined) data.senderDisplayName = input.senderDisplayName;
  if (input.senderEmailFrom !== undefined) data.senderEmailFrom = input.senderEmailFrom;
  if (input.senderSmsFrom !== undefined) data.senderSmsFrom = input.senderSmsFrom;
  if (input.senderWhatsappFrom !== undefined) data.senderWhatsappFrom = input.senderWhatsappFrom;
  if (input.providerBindings !== undefined) {
    data.providerBindingsJson = JSON.stringify(input.providerBindings);
  }

  const row = await prisma.communicationSettings.update({
    where: { propertyId },
    data
  });

  return toApi(row);
}
