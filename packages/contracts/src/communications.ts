/**
 * Contratos del motor de comunicaciones multicanal y solicitudes documentales.
 * La lógica de negocio depende de canales y casos de uso, no de proveedores concretos.
 */

/** Canal lógico (abstracción estable). */
export type ChannelType = "email" | "sms" | "whatsapp";

/** Identificador de proveedor de transporte (inyectable). */
export type CommunicationProviderId =
  | "console"
  | "noop"
  | "resend"
  | "twilio"
  | "meta_whatsapp"
  | "sendgrid"
  | string;

export type CommunicationUseCase =
  | "formal_notice"
  | "convocatoria"
  | "reminder_urgent"
  | "document_request"
  | "document_correction"
  | "approval_notice"
  | "ad_hoc";

export type CampaignPurpose =
  | "convocatoria"
  | "reminder"
  | "document_request"
  | "ad_hoc"
  | "custom";

export type CampaignAudience = "all" | "segment" | "single";

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "completed"
  | "cancelled"
  | "failed";

export type DeliveryStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "failed"
  | "bounced"
  | "suppressed";

export type DocumentRequestKind =
  | "proxy_power"
  | "cedula"
  | "certificado"
  | "carta"
  | "otro";

export type DocumentRequestStatus =
  | "draft"
  | "pending_upload"
  | "pending_review"
  | "approved"
  | "rejected"
  | "correction_requested";

export type DocumentReviewActionType = "approve" | "reject" | "request_correction";

/** Configuración persistida por copropiedad (aislamiento multi-tenant). */
export type CommunicationSettings = {
  id: string;
  propertyId: string;
  countryCode: string;
  locale: string;
  enabledChannels: ChannelType[];
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  defaultChannelsByUseCase: Partial<Record<CommunicationUseCase, ChannelType>>;
  fallbackChannel: ChannelType | null;
  senderDisplayName: string | null;
  senderEmailFrom: string | null;
  senderSmsFrom: string | null;
  senderWhatsappFrom: string | null;
  providerBindings: Partial<Record<ChannelType, CommunicationProviderId>>;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationSettingsInput = {
  countryCode?: string;
  locale?: string;
  enabledChannels?: ChannelType[];
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  whatsappEnabled?: boolean;
  defaultChannelsByUseCase?: Partial<Record<CommunicationUseCase, ChannelType>>;
  fallbackChannel?: ChannelType | null;
  senderDisplayName?: string | null;
  senderEmailFrom?: string | null;
  senderSmsFrom?: string | null;
  senderWhatsappFrom?: string | null;
  providerBindings?: Partial<Record<ChannelType, CommunicationProviderId>>;
};

export type CommunicationCampaignSummary = {
  id: string;
  propertyId: string;
  assemblyId: string | null;
  name: string;
  purpose: CampaignPurpose;
  audience: CampaignAudience;
  primaryChannels: ChannelType[];
  fallbackChannel: string | null;
  status: CampaignStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationDeliverySummary = {
  id: string;
  propertyId: string;
  campaignId: string | null;
  assemblyId: string | null;
  unitId: string | null;
  ownerId: string | null;
  channel: ChannelType;
  providerType: string;
  status: DeliveryStatus;
  useCase: string | null;
  trackingToken: string | null;
  providerMessageId: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
};
