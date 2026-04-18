import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Prisma } from "@prisma/client";
import { prisma } from "./lib/prisma";
import { getBearerToken, readJson, sendJson } from "./http/httpUtil";
import {
  computeVoteApproval,
  getUnitValidationError,
  isValidAgendaItem,
  isValidAssemblyAccessConfig,
  isValidAssemblyAccessGrant,
  isValidAssemblyConfig,
  isValidAssemblyDocument,
  isValidInvitationDelivery,
  isValidProperty,
  isValidUnit
} from "./http/requestValidation";
import { ResendProvider } from "./lib/resendProvider";
import {
  renderCommunicationEmailPlainText,
  renderCommunicationEmailTemplate,
} from "./lib/email/communicationEmailTemplate";
import { resolveAppBaseUrl } from "./lib/appUrls";
import { getHealthPayload } from "./lib/health";
import type {
  AdminLoginInput,
  AdminRegistrationInput,
  AgendaItemInput,
  AssemblyAccessConfigInput,
  AssemblyAccessGrantInput,
  AssemblyAccessGrantSummary,
  AssemblyDocumentInput,
  AssemblyConfigInput,
  AssemblyInvitationDeliverySummary,
  AssemblyInvitationRecipientSummary,
  AssemblyReadinessSummary,
  AssemblyVoteResultInput,
  OwnerCreateInput,
  PendingProxyRequestSummary,
  PropertyCreateInput,
  ProxyRequestPublicSummary,
  UnitCreateInput,
  UnitOwnerInput
} from "@kuoro/contracts";
import {
  createAdmin,
  createAssembly,
  createAssemblyAccessConfig,
  createOwner,
  listAssembliesByProperty,
  createProperty,
  createSession,
  createUnitOwner,
  createUnits,
  clearUnitOwners,
  deleteUnitWithOwners,
  findAdminByEmail,
  findAssemblyById,
  findAssemblyAccessConfigByAssembly,
  findFirstProperty,
  findOwnerById,
  findPropertyById,
  findProxyRequestContext,
  findLatestAssemblyByProperty,
  listAgendaItemsByAssembly,
  listAssemblyDocumentsByAssembly,
  listAssemblyAccessGrantsByAssembly,
  listAssemblyInvitationsByAssembly,
  findAdminBySessionTokenHash,
  findOwnersForUnit,
  findUnitById,
  listPropertiesByAdmin,
  listUnitsByProperty,
  updateOwner,
  updateAssembly,
  updateUnit,
  updateProperty,
  replaceAgendaItems,
  replaceAssemblyAccessGrants,
  replaceAssemblyDocuments,
  replaceAssemblyInvitations,
  updateAssemblyAccessConfig,
  createVoteResult,
  listVoteResultsByAssembly
} from "./db";
import { buildAssemblyDashboardFromReadiness, buildAssemblyOverviewFromReadiness } from "./domain/assembly";
import {
  createSessionExpiry,
  createSessionToken,
  hashPassword,
  hashToken,
  verifyPassword
} from "./domain/security";
import { toAdminProfile, toPropertySummary } from "./domain/serializers";
import {
  buildRoomName,
  generateLiveKitToken,
  elevateParticipantToSpeaker,
  revokeParticipantSpeaker,
  adminIdentity,
  validateAttendeeIdentity,
  LIVEKIT_URL,
} from "./domain/livekit";
import {
  getQueue,
  requestSpeaker,
  approveSpeaker,
  rejectSpeaker,
  finishSpeaker,
  cancelAllActive,
  getParticipantState,
  getAuditLog,
  auditParticipantEvent,
} from "./domain/speakerQueue";
import { enqueueLiveKitAction } from "./domain/reconciliation";
import { closeRoom, getRoomStatus, onAdminLeft } from "./domain/roomLifecycle";
import {
  openSession,
  castVote,
  closeSession,
  cancelSession,
  getActiveSession,
  getAttendeeView,
  listSessions,
  getMyVote,
  getSessionVotes,
} from "./domain/voting";
import {
  seedRepresentationsForAssembly,
  createProxyRepresentation,
  listAssemblyRepresentations,
  revokeRepresentation,
  reactivateRepresentation,
  getRepresentedUnitsWithVoteStatus,
} from "./domain/representation";
import {
  getOrCreateCommunicationSettings,
  updateCommunicationSettings
} from "./domain/communications/settingsRepo";
import {
  recordProxySubmissionFromOwnerState,
  recordProxyReviewAction
} from "./domain/documentRequests/proxySync";
import { listCommunicationCampaigns, createDraftCampaign } from "./domain/communications/campaignRepo";
import {
  listDocumentRequestsForProperty,
  findPublicDocumentRequestByToken
} from "./domain/communications/documentRequestsRepo";
import { listDeliveriesForProperty } from "./domain/communications/deliveriesRepo";
import { listTemplates, upsertTemplate, deleteTemplate } from "./domain/communications/templatesRepo";
import { dispatchCampaignTest } from "./domain/communications/dispatchCampaign";
import { applyCommunicationWebhook } from "./domain/communications/webhookInbound";
import { sendAssemblyInvitationEmails } from "./domain/assemblyInvitations/sendAssemblyInvitationEmails";
import type { CommunicationSettingsInput, CampaignPurpose, ChannelType } from "@kuoro/contracts";
import type {
  AdminAssistantChatRequest,
  ConferenceRole,
  SpeakerRequestInput,
  SpeakerApproveInput,
  CreateProxyRepresentationInput,
} from "@kuoro/contracts";
import { runAdminAssistantChat } from "./domain/adminAssistant/runAdminAssistantChat";

// ── In-memory live-slide store ────────────────────────────────────────────────
// Stores the current slide payload per assemblyId. Lost on server restart.
const liveSlideStore = new Map<string, unknown>();

const resendProvider = new ResendProvider();

async function requireAdmin(request: IncomingMessage, response: ServerResponse) {
  const token = getBearerToken(request);

  if (!token) {
    sendJson(response, 401, { error: "Missing bearer token" });
    return null;
  }

  const session = await findAdminBySessionTokenHash(hashToken(token));

  if (!session || new Date(session.session.expiresAt) < new Date()) {
    sendJson(response, 401, { error: "Invalid or expired session" });
    return null;
  }

  return session.admin;
}

function parseAdminRegistration(body: unknown): AdminRegistrationInput | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  const fullName = typeof o.fullName === "string" ? o.fullName.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim().toLowerCase() : "";
  const phone = typeof o.phone === "string" ? o.phone.trim() : "";
  const password = typeof o.password === "string" ? o.password : "";
  if (fullName.length < 3 || !email.includes("@") || phone.length < 7 || password.length < 8) return null;
  return { fullName, email, phone, password };
}

function parseAdminLogin(body: unknown): AdminLoginInput | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  const email = typeof o.email === "string" ? o.email.trim().toLowerCase() : "";
  const password = typeof o.password === "string" ? o.password : "";
  if (!email.includes("@") || password.length < 8) return null;
  return { email, password };
}

async function resolveAssemblyForInvitations(propertyId: string, assemblyIdFromQuery: string | null) {
  const trimmed = assemblyIdFromQuery?.trim();
  if (trimmed) {
    const assembly = await findAssemblyById(trimmed);
    if (!assembly || assembly.propertyId !== propertyId) {
      return null;
    }
    return assembly;
  }
  return findLatestAssemblyByProperty(propertyId);
}

function mapInvitationDeliveriesToSummary(
  rows: Awaited<ReturnType<typeof listAssemblyInvitationsByAssembly>>
): Pick<AssemblyInvitationDeliverySummary, "unitId" | "sentAt" | "channel" | "status" | "note">[] {
  return rows.map((d) => ({
    unitId: d.unitId,
    sentAt: d.sentAt,
    channel: d.channel,
    status: d.status,
    note: d.note
  }));
}

function normalizeOwner(owner: UnitOwnerInput) {
  const isProxy = owner.participationRole === "apoderado";
  const hasProxyDocument = Boolean(owner.proxyDocumentData?.trim());
  const proxyApprovalStatus: NonNullable<UnitOwnerInput["proxyApprovalStatus"]> = isProxy
    ? !owner.proxyApprovalStatus || owner.proxyApprovalStatus === "not_required"
      ? hasProxyDocument
        ? "pending_review"
        : "awaiting_upload"
      : owner.proxyApprovalStatus
    : "not_required";

  const canVote = isProxy
    ? proxyApprovalStatus === "approved" ? (owner.canVote ?? true) : false
    : owner.canVote ?? true;

  const receivesInvitations = isProxy
    ? proxyApprovalStatus === "approved" ? (owner.receivesInvitations ?? true) : false
    : owner.receivesInvitations ?? true;

  return {
    ...owner,
    proxyDocumentName: isProxy ? owner.proxyDocumentName?.trim() || undefined : undefined,
    proxyDocumentMimeType: isProxy ? owner.proxyDocumentMimeType?.trim() || undefined : undefined,
    proxyDocumentData: isProxy ? owner.proxyDocumentData?.trim() || undefined : undefined,
    proxyRequestToken: isProxy ? owner.proxyRequestToken ?? randomUUID() : undefined,
    proxyRequestedAt: isProxy ? owner.proxyRequestedAt ?? new Date().toISOString() : undefined,
    proxyLastSubmittedAt: isProxy ? owner.proxyLastSubmittedAt : undefined,
    proxySubmittedByName: isProxy ? owner.proxySubmittedByName?.trim() || undefined : undefined,
    proxySubmittedByEmail: isProxy ? owner.proxySubmittedByEmail?.trim() || undefined : undefined,
    proxySubmittedByRole: isProxy ? owner.proxySubmittedByRole : undefined,
    proxyRejectionReasons: isProxy ? owner.proxyRejectionReasons ?? [] : [],
    proxyRejectionNote: isProxy ? owner.proxyRejectionNote?.trim() || undefined : undefined,
    proxyApprovalStatus,
    canVote,
    receivesInvitations
  };
}

async function toUnitSummary(unit: Awaited<ReturnType<typeof findUnitById>> extends infer T ? Exclude<T, null> : never) {
  const owners = await findOwnersForUnit(unit.id);
  const primaryOwner = owners.find((owner) => owner.isPrimary) ?? null;

  return {
    id: unit.id,
    propertyId: unit.propertyId,
    unitType: unit.unitType,
    groupingKind: unit.groupingKind,
    groupingLabel: unit.groupingLabel,
    unitNumber: unit.unitNumber,
    floor: unit.floor,
    destination: unit.destination,
    privateArea: unit.privateArea,
    coefficient: unit.coefficient,
    contributionModule: unit.contributionModule,
    owners: owners.map((owner) => ({
      id: owner.id,
      propertyId: owner.propertyId,
      fullName: owner.fullName,
      documentType: owner.documentType as OwnerCreateInput["documentType"],
      email: owner.email,
      phone: owner.phone,
      document: owner.document,
      participationRole: owner.participationRole,
      canVote: owner.canVote,
      receivesInvitations: owner.receivesInvitations,
      proxyDocumentName: owner.proxyDocumentName,
      proxyDocumentMimeType: owner.proxyDocumentMimeType,
      proxyApprovalStatus: owner.proxyApprovalStatus,
      proxyRequestToken: owner.proxyRequestToken,
      proxyRequestedAt: owner.proxyRequestedAt,
      proxyLastSubmittedAt: owner.proxyLastSubmittedAt,
      proxySubmittedByName: owner.proxySubmittedByName,
      proxySubmittedByEmail: owner.proxySubmittedByEmail,
      proxySubmittedByRole: owner.proxySubmittedByRole,
      proxyRejectionReasons: owner.proxyRejectionReasons,
      proxyRejectionNote: owner.proxyRejectionNote,
      isPrimary: owner.isPrimary,
      ownershipPercentage: owner.ownershipPercentage
    })),
    primaryOwner: primaryOwner
      ? {
          id: primaryOwner.id,
          propertyId: primaryOwner.propertyId,
          fullName: primaryOwner.fullName,
          documentType: primaryOwner.documentType as OwnerCreateInput["documentType"],
          email: primaryOwner.email,
          phone: primaryOwner.phone,
          document: primaryOwner.document,
          participationRole: primaryOwner.participationRole,
          canVote: primaryOwner.canVote,
          receivesInvitations: primaryOwner.receivesInvitations,
          proxyDocumentName: primaryOwner.proxyDocumentName,
          proxyDocumentMimeType: primaryOwner.proxyDocumentMimeType,
          proxyApprovalStatus: primaryOwner.proxyApprovalStatus,
          proxyRequestToken: primaryOwner.proxyRequestToken,
          proxyRequestedAt: primaryOwner.proxyRequestedAt,
          proxyLastSubmittedAt: primaryOwner.proxyLastSubmittedAt,
          proxySubmittedByName: primaryOwner.proxySubmittedByName,
          proxySubmittedByEmail: primaryOwner.proxySubmittedByEmail,
          proxySubmittedByRole: primaryOwner.proxySubmittedByRole,
          proxyRejectionReasons: primaryOwner.proxyRejectionReasons,
          proxyRejectionNote: primaryOwner.proxyRejectionNote,
          isPrimary: true,
          ownershipPercentage: primaryOwner.ownershipPercentage
        }
      : null
  };
}

async function listPendingProxyRequests(propertyId: string): Promise<PendingProxyRequestSummary[]> {
  const units = await listUnitsByProperty(propertyId);
  const summaries = await Promise.all(
    units.map(async (unit) => {
      const owners = await findOwnersForUnit(unit.id);
      const unitLabel = [unit.groupingLabel, unit.unitNumber].filter(Boolean).join(" ");

      return owners
        .filter(
          (owner) =>
            owner.participationRole === "apoderado" &&
            owner.proxyApprovalStatus !== "not_required" &&
            Boolean(owner.proxyLastSubmittedAt)
        )
        .map((owner) => ({
          ownerId: owner.id,
          propertyId,
          unitId: unit.id,
          unitLabel,
          ownerName: owner.fullName,
          proxyApprovalStatus: owner.proxyApprovalStatus,
          proxyDocumentName: owner.proxyDocumentName,
          proxyDocumentMimeType: owner.proxyDocumentMimeType,
          proxyDocumentData: owner.proxyDocumentData,
          proxyLastSubmittedAt: owner.proxyLastSubmittedAt,
          proxySubmittedByName: owner.proxySubmittedByName,
          proxySubmittedByEmail: owner.proxySubmittedByEmail,
          proxySubmittedByRole: owner.proxySubmittedByRole,
          proxyRejectionReasons: owner.proxyRejectionReasons,
          proxyRejectionNote: owner.proxyRejectionNote
        }));
    })
  );

  return summaries.flat().sort((left, right) =>
    (right.proxyLastSubmittedAt ?? "").localeCompare(left.proxyLastSubmittedAt ?? "")
  );
}

async function buildAssemblyReadiness(propertyId: string): Promise<AssemblyReadinessSummary | null> {
  const property = await findPropertyById(propertyId);

  if (!property) {
    return null;
  }

  const units = await listUnitsByProperty(propertyId);
  const summaries = await Promise.all(
    units.map(async (unit) => {
      const owners = await findOwnersForUnit(unit.id);
      const unitLabel = [unit.groupingLabel, unit.unitNumber].filter(Boolean).join(" ");
      const representatives = owners
        .filter((owner) => owner.canVote || owner.receivesInvitations || owner.participationRole === "apoderado")
        .map((owner) => ({
          ownerId: owner.id,
          fullName: owner.fullName,
          participationRole: owner.participationRole,
          canVote: owner.canVote,
          receivesInvitations: owner.receivesInvitations,
          proxyApprovalStatus: owner.proxyApprovalStatus
        }));

      const hasApprovedProxy = owners.some(
        (owner) => owner.participationRole === "apoderado" && owner.proxyApprovalStatus === "approved" && owner.canVote
      );
      const hasOwnerVoter = owners.some(
        (owner) => owner.participationRole !== "apoderado" && owner.canVote
      );
      const hasPendingProxy = owners.some(
        (owner) =>
          owner.participationRole === "apoderado" &&
          ["awaiting_upload", "pending_review", "rejected"].includes(owner.proxyApprovalStatus)
      );

      const status: AssemblyReadinessSummary["units"][number]["status"] = hasApprovedProxy
        ? "proxy_approved"
        : hasOwnerVoter
          ? "owner_ready"
          : hasPendingProxy
            ? "proxy_pending"
            : "no_voter";

      return {
        unitId: unit.id,
        unitLabel,
        unitType: unit.unitType as AssemblyReadinessSummary["units"][number]["unitType"],
        groupingKind: unit.groupingKind as AssemblyReadinessSummary["units"][number]["groupingKind"],
        groupingLabelText: unit.groupingLabel,
        unitNumber: unit.unitNumber,
        status,
        representatives
      };
    })
  );

  return {
    propertyId: property.id,
    propertyName: property.name,
    totalUnits: units.length,
    representedUnits: summaries.filter((unit) => unit.status === "owner_ready" || unit.status === "proxy_approved").length,
    eligibleVoters: summaries.reduce(
      (total, unit) => total + unit.representatives.filter((representative) => representative.canVote).length,
      0
    ),
    invitationRecipients: summaries.reduce(
      (total, unit) => total + unit.representatives.filter((representative) => representative.receivesInvitations).length,
      0
    ),
    pendingProxyUnits: summaries.filter((unit) => unit.status === "proxy_pending").length,
    units: summaries
  };
}

async function buildAssemblyInvitationRecipients(propertyId: string): Promise<AssemblyInvitationRecipientSummary[]> {
  const units = await listUnitsByProperty(propertyId);

  const recipients = await Promise.all(
    units.map(async (unit) => {
      const unitLabel = [unit.groupingLabel, unit.unitNumber].filter(Boolean).join(" ");
      const owners = await findOwnersForUnit(unit.id);
      const invitationReceiver = owners.find((owner) => owner.receivesInvitations);

      if (!invitationReceiver) {
        const hasPendingProxy = owners.some(
          (owner) =>
            owner.participationRole === "apoderado" &&
            ["awaiting_upload", "pending_review", "rejected"].includes(owner.proxyApprovalStatus)
        );

        return {
          unitId: unit.id,
          unitLabel,
          unitType: unit.unitType as AssemblyInvitationRecipientSummary["unitType"],
          groupingKind: unit.groupingKind as AssemblyInvitationRecipientSummary["groupingKind"],
          groupingLabelText: unit.groupingLabel,
          unitNumber: unit.unitNumber,
          recipientName: "Sin destinatario definido",
          recipientEmail: undefined,
          recipientRole: "propietario" as const,
          canVote: false,
          receivesInvitations: false,
          status: (hasPendingProxy ? "pending_proxy" : "no_recipient") as AssemblyInvitationRecipientSummary["status"]
        };
      }

      return {
        unitId: unit.id,
        unitLabel,
        unitType: unit.unitType as AssemblyInvitationRecipientSummary["unitType"],
        groupingKind: unit.groupingKind as AssemblyInvitationRecipientSummary["groupingKind"],
        groupingLabelText: unit.groupingLabel,
        unitNumber: unit.unitNumber,
        recipientName: invitationReceiver.fullName,
        recipientEmail: invitationReceiver.email,
        recipientRole: invitationReceiver.participationRole,
        canVote: invitationReceiver.canVote,
        receivesInvitations: invitationReceiver.receivesInvitations,
        status: (invitationReceiver.email ? "ready" : "missing_contact") as AssemblyInvitationRecipientSummary["status"]
      };
    })
  );

  return recipients;
}

async function buildAssemblyAccessGrants(
  propertyId: string,
  assemblyId: string
): Promise<AssemblyAccessGrantSummary[]> {
  const units = await listUnitsByProperty(propertyId);
  const savedGrants = await listAssemblyAccessGrantsByAssembly(assemblyId);

  const summaries = await Promise.all(
    units.map(async (unit) => {
      const unitLabel = [unit.groupingLabel, unit.unitNumber].filter(Boolean).join(" ");
      const owners = await findOwnersForUnit(unit.id);
      const savedGrant = savedGrants.find((grant) => grant.unitId === unit.id);
      const voter = owners.find((owner) => owner.canVote);
      const contactableRepresentative =
        owners.find((owner) => owner.canVote && (owner.email || owner.phone)) ??
        owners.find((owner) => owner.receivesInvitations || owner.canVote) ??
        owners[0];

      const hasPendingProxy = owners.some(
        (owner) =>
          owner.participationRole === "apoderado" &&
          ["awaiting_upload", "pending_review", "rejected"].includes(owner.proxyApprovalStatus)
      );

      let accessStatus: AssemblyAccessGrantSummary["accessStatus"] = "ready";

      if (!contactableRepresentative) {
        accessStatus = hasPendingProxy ? "pending_proxy" : "no_representative";
      } else if (!contactableRepresentative.document) {
        accessStatus = "missing_document";
      } else if (!contactableRepresentative.email && !contactableRepresentative.phone) {
        accessStatus = "missing_contact";
      } else if (hasPendingProxy && contactableRepresentative.participationRole === "apoderado") {
        accessStatus = "pending_proxy";
      }

      return {
        unitId: unit.id,
        unitLabel,
        unitType: unit.unitType as AssemblyAccessGrantSummary["unitType"],
        groupingKind: unit.groupingKind as AssemblyAccessGrantSummary["groupingKind"],
        groupingLabelText: unit.groupingLabel,
        unitNumber: unit.unitNumber,
        representativeName: contactableRepresentative?.fullName ?? "Sin representante habilitado",
        representativeEmail: contactableRepresentative?.email,
        representativePhone: contactableRepresentative?.phone,
        representativeRole: contactableRepresentative?.participationRole,
        hasDocumentOnRecord: Boolean(contactableRepresentative?.document),
        canVote: Boolean(voter),
        accessStatus,
        deliveryChannel: savedGrant?.deliveryChannel ?? "pendiente",
        validationMethod: savedGrant?.validationMethod ?? "otp_email",
        preRegistrationStatus: savedGrant?.preRegistrationStatus ?? "pending",
        dispatchStatus: savedGrant?.dispatchStatus ?? "draft",
        note: savedGrant?.note
      };
    })
  );

  return summaries;
}

async function findProxyRequestByToken(token: string) {
  return findProxyRequestContext(token);
}

async function syncUnitOwners(propertyId: string, unitId: string, owners: UnitOwnerInput[]) {
  await clearUnitOwners(unitId);

  for (const rawOwnerInput of owners) {
    const ownerInput = normalizeOwner(rawOwnerInput);
    const owner = await createOwner({
      propertyId,
      fullName: ownerInput.fullName.trim(),
      documentType: ownerInput.documentType,
      email: ownerInput.email?.trim() || undefined,
      phone: ownerInput.phone?.trim() || undefined,
      document: ownerInput.document?.trim() || undefined,
      participationRole: ownerInput.participationRole ?? "propietario",
      canVote: ownerInput.canVote ?? true,
      receivesInvitations: ownerInput.receivesInvitations ?? true,
      proxyDocumentName: ownerInput.proxyDocumentName,
      proxyDocumentMimeType: ownerInput.proxyDocumentMimeType,
      proxyDocumentData: ownerInput.proxyDocumentData,
      proxyApprovalStatus: ownerInput.proxyApprovalStatus ?? "not_required",
      proxyRequestToken: ownerInput.proxyRequestToken,
      proxyRequestedAt: ownerInput.proxyRequestedAt,
      proxyLastSubmittedAt: ownerInput.proxyLastSubmittedAt,
      proxySubmittedByName: ownerInput.proxySubmittedByName,
      proxySubmittedByEmail: ownerInput.proxySubmittedByEmail,
      proxySubmittedByRole: ownerInput.proxySubmittedByRole,
      proxyRejectionReasons: ownerInput.proxyRejectionReasons ?? [],
      proxyRejectionNote: ownerInput.proxyRejectionNote
    });

    await createUnitOwner({
      unitId,
      ownerId: owner.id,
      isPrimary: ownerInput.isPrimary ?? false,
      ownershipPercentage: ownerInput.ownershipPercentage
    });
  }
}

export async function routeRequest(request: IncomingMessage, response: ServerResponse) {
  const method = request.method ?? "GET";
  const rawUrl = request.url ?? "/";
  const url = new URL(rawUrl, "http://localhost");
  const pathname = url.pathname;

  if (method === "GET" && (pathname === "/health" || pathname === "/api/v1/health")) {
    return sendJson(response, 200, getHealthPayload());
  }

  if (method === "POST" && pathname === "/test-email") {
    const sampleBaseUrl = resolveAppBaseUrl();
    const templatePayload = {
      preheader: "Ejemplo de plantilla transaccional Kuoro",
      badgeLabel: "Comunicación",
      title: "Ejemplo de mensaje para copropietarios",
      introText:
        "Este correo muestra la plantilla oficial de Kuoro. Así verán los propietarios las convocatorias, solicitudes de documentos y recordatorios: diseño claro, datos ordenados y un botón de acción visible.",
      recipientName: "María Gómez",
      unitLabel: "Torre A · Apartamento 402",
      assemblyName: "Asamblea ordinaria 2026",
      eventDate: "30 de abril de 2026",
      eventTime: "7:00 p. m.",
      deadline: "28 de abril de 2026, 6:00 p. m.",
      documentTypeLabel: "Certificado de tradición y libertad",
      ctaLabel: "Abrir en Kuoro",
      ctaUrl: sampleBaseUrl,
      contactEmail: "administracion@ejemplo-copropiedad.co",
      propertyName: "Conjunto Residencial Ejemplo",
    };
    const html = renderCommunicationEmailTemplate(templatePayload);
    const text = renderCommunicationEmailPlainText(templatePayload);
    const result = await resendProvider.sendEmail({
      to: "kundroksas@gmail.com",
      subject: "Kuoro — Ejemplo de plantilla de correo",
      html,
      text,
    });
    if (result.success) {
      return sendJson(response, 200, {
        ok: true,
        messageId: result.messageId,
      });
    }
    const isConfig = result.error?.includes("RESEND_API_KEY") ?? false;
    return sendJson(response, isConfig ? 503 : 502, {
      ok: false,
      error: result.error,
    });
  }

  const publicDocumentRequestMatch = pathname.match(/^\/api\/v1\/public\/document-requests\/([^/]+)$/);
  if (publicDocumentRequestMatch && method === "GET") {
    const token = publicDocumentRequestMatch[1];
    const data = await findPublicDocumentRequestByToken(token);
    if (!data) {
      return sendJson(response, 404, { error: "Document request not found" });
    }
    return sendJson(response, 200, data);
  }

  const commWebhookMatch = pathname.match(/^\/api\/v1\/integrations\/communications\/webhooks\/([^/]+)$/);
  if (commWebhookMatch && method === "POST") {
    const provider = commWebhookMatch[1];
    const body = (await readJson(request)) as {
      event?: string;
      providerMessageId?: string;
      trackingToken?: string;
    };
    const result = await applyCommunicationWebhook(provider, {
      event: String(body.event ?? "unknown"),
      providerMessageId: body.providerMessageId,
      trackingToken: body.trackingToken,
      raw: body as Record<string, unknown>
    });
    return sendJson(response, 200, result);
  }

  if (method === "GET" && pathname === "/api/v1/assemblies/demo/dashboard") {
    const property = await findFirstProperty();

    if (!property) {
      return sendJson(response, 404, { error: "No property found" });
    }

    const readiness = await buildAssemblyReadiness(property.id);
    if (!readiness) {
      return sendJson(response, 404, { error: "Assembly readiness not found" });
    }

    return sendJson(response, 200, buildAssemblyDashboardFromReadiness(readiness));
  }

  if (method === "GET" && pathname === "/api/v1/assemblies/demo") {
    const property = await findFirstProperty();

    if (!property) {
      return sendJson(response, 404, { error: "No property found" });
    }

    const readiness = await buildAssemblyReadiness(property.id);
    if (!readiness) {
      return sendJson(response, 404, { error: "Assembly readiness not found" });
    }

    return sendJson(response, 200, buildAssemblyOverviewFromReadiness(readiness, "asm-demo"));
  }

  if (method === "POST" && pathname === "/api/v1/auth/register") {
    const body = await readJson(request);
    const input = parseAdminRegistration(body);

    if (!input) {
      return sendJson(response, 400, {
        error: "Invalid registration payload"
      });
    }

    try {
      const existing = await findAdminByEmail(input.email);

      if (existing) {
        return sendJson(response, 409, {
          error: "An administrator with this email already exists"
        });
      }

      const admin = await createAdmin({
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        passwordHash: hashPassword(input.password),
        emailVerified: false
      });

      const token = createSessionToken();

      await createSession({
        adminId: admin.id,
        tokenHash: hashToken(token),
        expiresAt: createSessionExpiry().toISOString()
      });

      return sendJson(response, 201, {
        token,
        admin: toAdminProfile(admin)
      });
    } catch (err) {
      console.error("[auth/register]", err);
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return sendJson(response, 409, {
          error: "An administrator with this email already exists"
        });
      }
      return sendJson(response, 500, {
        error: "No se pudo completar el registro. Revisa la conexión a la base de datos o intenta de nuevo."
      });
    }
  }

  if (method === "POST" && pathname === "/api/v1/auth/login") {
    const body = await readJson(request);
    const input = parseAdminLogin(body);

    if (!input) {
      return sendJson(response, 400, {
        error: "Invalid login payload"
      });
    }

    const admin = await findAdminByEmail(input.email);

    if (!admin || !verifyPassword(input.password, admin.passwordHash)) {
      return sendJson(response, 401, {
        error: "Invalid credentials"
      });
    }

    const token = createSessionToken();

    await createSession({
      adminId: admin.id,
      tokenHash: hashToken(token),
      expiresAt: createSessionExpiry().toISOString()
    });

    return sendJson(response, 200, {
      token,
      admin: toAdminProfile(admin)
    });
  }

  if (method === "GET" && pathname === "/api/v1/auth/me") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const properties = await listPropertiesByAdmin(admin.id);

    return sendJson(response, 200, {
      admin: toAdminProfile(admin),
      properties: properties.map(toPropertySummary)
    });
  }

  if (method === "POST" && pathname === "/api/v1/admin-assistant/chat") {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    let body: AdminAssistantChatRequest;
    try {
      body = (await readJson(request)) as AdminAssistantChatRequest;
    } catch {
      return sendJson(response, 400, { error: "JSON inválido" });
    }

    try {
      const result = await runAdminAssistantChat(admin.id, body);
      return sendJson(response, 200, result);
    } catch (err) {
      const e = err as { statusCode?: number; message?: string };
      const code = e.statusCode ?? 500;
      return sendJson(response, code, { error: e.message ?? "Error del asistente" });
    }
  }

  const publicProxyRequestMatch = pathname.match(/^\/api\/v1\/proxy-requests\/([^/]+)$/);
  if (publicProxyRequestMatch && method === "GET") {
    const token = publicProxyRequestMatch[1];
    const requestData = await findProxyRequestByToken(token);

    if (!requestData) {
      return sendJson(response, 404, { error: "Proxy request not found" });
    }

    const payload: ProxyRequestPublicSummary = {
      token,
      propertyName: requestData.property.name,
      unitLabel: [requestData.unit.groupingLabel, requestData.unit.unitNumber].filter(Boolean).join(" "),
      ownerName: requestData.owner.fullName,
      proxyApprovalStatus: requestData.owner.proxyApprovalStatus,
      proxyDocumentName: requestData.owner.proxyDocumentName,
      proxyLastSubmittedAt: requestData.owner.proxyLastSubmittedAt,
      proxyRejectionReasons: requestData.owner.proxyRejectionReasons,
      proxyRejectionNote: requestData.owner.proxyRejectionNote
    };

    return sendJson(response, 200, { request: payload });
  }

  if (publicProxyRequestMatch && method === "POST") {
    const token = publicProxyRequestMatch[1];
    const requestData = await findProxyRequestByToken(token);

    if (!requestData) {
      return sendJson(response, 404, { error: "Proxy request not found" });
    }

    const body = (await readJson(request)) as {
      senderName?: string;
      senderEmail?: string;
      senderRole?: "propietario" | "copropietario" | "apoderado" | "otro";
      proxyDocumentName?: string;
      proxyDocumentMimeType?: string;
      proxyDocumentData?: string;
    };

    if (!body.senderName?.trim() || !body.proxyDocumentName?.trim() || !body.proxyDocumentData?.trim()) {
      return sendJson(response, 400, { error: "Invalid proxy submission payload" });
    }

    await updateOwner(requestData.owner.id, {
      fullName: requestData.owner.fullName,
      documentType: requestData.owner.documentType,
      email: requestData.owner.email,
      phone: requestData.owner.phone,
      document: requestData.owner.document,
      participationRole: requestData.owner.participationRole,
      canVote: false,
      receivesInvitations: false,
      proxyDocumentName: body.proxyDocumentName.trim(),
      proxyDocumentMimeType: body.proxyDocumentMimeType?.trim() || undefined,
      proxyDocumentData: body.proxyDocumentData.trim(),
      proxyApprovalStatus: "pending_review",
      proxyRequestToken: requestData.owner.proxyRequestToken,
      proxyRequestedAt: requestData.owner.proxyRequestedAt ?? new Date().toISOString(),
      proxyLastSubmittedAt: new Date().toISOString(),
      proxySubmittedByName: body.senderName.trim(),
      proxySubmittedByEmail: body.senderEmail?.trim() || undefined,
      proxySubmittedByRole: body.senderRole ?? "otro",
      proxyRejectionReasons: [],
      proxyRejectionNote: undefined
    });

    await recordProxySubmissionFromOwnerState(requestData.owner.id);

    return sendJson(response, 200, { success: true });
  }

  if (method === "POST" && pathname === "/api/v1/properties") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const existingProperties = await listPropertiesByAdmin(admin.id);
    if (existingProperties.length > 0) {
      return sendJson(response, 409, {
        error: "This administrator already has a property registered"
      });
    }

    const body = (await readJson(request)) as PropertyCreateInput;

    if (!isValidProperty(body)) {
      return sendJson(response, 400, {
        error: "Invalid property payload"
      });
    }

    const property = await createProperty({
      adminId: admin.id,
      name: body.name.trim(),
      city: body.city.trim(),
      address: body.address.trim(),
      nit: body.nit?.trim() || null,
      legalType: body.legalType,
      developmentShape: body.developmentShape,
      buildingSubtype: body.buildingSubtype,
      structureModes: body.structureModes,
      privateUnitTypes: body.privateUnitTypes,
      usesCoefficients: body.usesCoefficients,
      usesContributionModules: body.usesContributionModules,
      supportsProxies: body.supportsProxies,
      totalUnits: 0
    });

    return sendJson(response, 201, {
      property: toPropertySummary(property)
    });
  }

  if (method === "GET" && pathname === "/api/v1/properties") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const properties = await listPropertiesByAdmin(admin.id);

    return sendJson(response, 200, {
      properties: properties.map(toPropertySummary)
    });
  }

  const propertyMatch = pathname.match(/^\/api\/v1\/properties\/([^/]+)$/);
  if (method === "PUT" && propertyMatch) {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = propertyMatch[1];
    const property = await findPropertyById(propertyId);

    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, {
        error: "Property not found"
      });
    }

    const body = (await readJson(request)) as PropertyCreateInput;

    if (!isValidProperty(body)) {
      return sendJson(response, 400, {
        error: "Invalid property payload"
      });
    }

    const updated = await updateProperty(propertyId, {
      name: body.name.trim(),
      city: body.city.trim(),
      address: body.address.trim(),
      nit: body.nit?.trim() || null,
      legalType: body.legalType,
      developmentShape: body.developmentShape,
      buildingSubtype: body.buildingSubtype,
      structureModes: body.structureModes,
      privateUnitTypes: body.privateUnitTypes,
      usesCoefficients: body.usesCoefficients,
      usesContributionModules: body.usesContributionModules,
      supportsProxies: body.supportsProxies,
      totalUnits: property.totalUnits
    });

    return sendJson(response, 200, {
      property: updated ? toPropertySummary(updated) : null
    });
  }

  const propertyProxyRequestsMatch = pathname.match(/^\/api\/v1\/properties\/([^/]+)\/proxy-requests$/);
  if (propertyProxyRequestsMatch && method === "GET") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = propertyProxyRequestsMatch[1];
    const property = await findPropertyById(propertyId);

    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const requests = await listPendingProxyRequests(propertyId);
    return sendJson(response, 200, { requests });
  }

  const assembliesListMatch = pathname.match(/^\/api\/v1\/properties\/([^/]+)\/assemblies$/);
  if (assembliesListMatch && method === "GET") {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const propertyId = assembliesListMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const assemblies = await listAssembliesByProperty(propertyId);
    return sendJson(response, 200, { assemblies });
  }

  if (assembliesListMatch && method === "POST") {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const propertyId = assembliesListMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    // Guard: only one active assembly at a time
    const activeAssembly = await findLatestAssemblyByProperty(propertyId);
    if (activeAssembly) {
      return sendJson(response, 409, {
        error: "Ya existe una asamblea activa. Ciérrala antes de crear una nueva."
      });
    }

    const body = (await readJson(request)) as AssemblyConfigInput;
    if (!isValidAssemblyConfig(body)) {
      return sendJson(response, 400, { error: "Configuracion de asamblea invalida" });
    }

    const assembly = await createAssembly({
      propertyId,
      title: body.title.trim(),
      type: body.type,
      modality: body.modality,
      status: body.status,
      scheduledAt: body.scheduledAt,
      conferenceService: body.conferenceService,
      location: body.location?.trim() || undefined,
      virtualAccessUrl: body.virtualAccessUrl?.trim() || undefined,
      notes: body.notes?.trim() || undefined,
      votingBasis: body.votingBasis,
      allowsSecondCall: body.allowsSecondCall,
      secondCallScheduledAt: body.secondCallScheduledAt?.trim() || undefined
    });
    return sendJson(response, 201, { assembly });
  }

  const assemblyReadinessMatch = pathname.match(/^\/api\/v1\/properties\/([^/]+)\/assembly-readiness$/);
  if (assemblyReadinessMatch && method === "GET") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = assemblyReadinessMatch[1];
    const property = await findPropertyById(propertyId);

    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const readiness = await buildAssemblyReadiness(propertyId);
    return sendJson(response, 200, { readiness });
  }

  const assemblySettingsMatch = pathname.match(/^\/api\/v1\/properties\/([^/]+)\/assembly-settings$/);
  if (assemblySettingsMatch && method === "GET") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = assemblySettingsMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const assembly = await findLatestAssemblyByProperty(propertyId);
    return sendJson(response, 200, { assembly });
  }

  if (assemblySettingsMatch && method === "PUT") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = assemblySettingsMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const body = (await readJson(request)) as AssemblyConfigInput;
    if (!isValidAssemblyConfig(body)) {
      return sendJson(response, 400, { error: "Configuracion de asamblea invalida" });
    }

    const existingAssembly = await findLatestAssemblyByProperty(propertyId);
    const assembly = existingAssembly
      ? await updateAssembly(existingAssembly.id, {
          title: body.title.trim(),
          type: body.type,
          modality: body.modality,
          status: body.status,
          scheduledAt: body.scheduledAt,
          conferenceService: body.conferenceService,
          location: body.location?.trim() || undefined,
          virtualAccessUrl: body.virtualAccessUrl?.trim() || undefined,
          notes: body.notes?.trim() || undefined,
          votingBasis: body.votingBasis,
          allowsSecondCall: body.allowsSecondCall,
          secondCallScheduledAt: body.secondCallScheduledAt?.trim() || undefined
        })
      : await createAssembly({
          propertyId,
          title: body.title.trim(),
          type: body.type,
          modality: body.modality,
          status: body.status,
          scheduledAt: body.scheduledAt,
          conferenceService: body.conferenceService,
          location: body.location?.trim() || undefined,
          virtualAccessUrl: body.virtualAccessUrl?.trim() || undefined,
          notes: body.notes?.trim() || undefined,
          votingBasis: body.votingBasis,
          allowsSecondCall: body.allowsSecondCall,
          secondCallScheduledAt: body.secondCallScheduledAt?.trim() || undefined
        });

    return sendJson(response, 200, { assembly });
  }

  const agendaMatch = pathname.match(/^\/api\/v1\/properties\/([^/]+)\/assembly-agenda$/);
  if (agendaMatch && method === "GET") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = agendaMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const assembly = await findLatestAssemblyByProperty(propertyId);
    if (!assembly) {
      return sendJson(response, 200, { agenda: [] });
    }

    const agenda = await listAgendaItemsByAssembly(assembly.id);
    return sendJson(response, 200, { agenda });
  }

  if (agendaMatch && method === "PUT") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = agendaMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const assembly = await findLatestAssemblyByProperty(propertyId);
    if (!assembly) {
      return sendJson(response, 400, { error: "Primero debes guardar la configuracion base de la asamblea" });
    }

    const body = (await readJson(request)) as { agenda?: AgendaItemInput[] };
    const agenda = body.agenda ?? [];

    if (!Array.isArray(agenda) || agenda.some((item) => !isValidAgendaItem(item))) {
      return sendJson(response, 400, { error: "Orden del dia invalido" });
    }

    const savedAgenda = await replaceAgendaItems(
      assembly.id,
      agenda.map((item, index) => ({
        title: item.title.trim(),
        description: item.description?.trim() || undefined,
        slideTitle: item.slideTitle?.trim() || undefined,
        slideContent: item.slideContent?.trim() || undefined,
        speakerNotes: item.speakerNotes?.trim() || undefined,
        votePrompt: item.votePrompt?.trim() || undefined,
        type: item.type,
        votingRule: item.votingRule,
        requiresAttachment: item.requiresAttachment,
        order: index + 1,
        status: index === 0 ? "active" : "pending"
      }))
    );

    return sendJson(response, 200, { agenda: savedAgenda });
  }

  const documentsMatch = pathname.match(/^\/api\/v1\/properties\/([^/]+)\/assembly-documents$/);
  if (documentsMatch && method === "GET") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = documentsMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const assembly = await findLatestAssemblyByProperty(propertyId);
    if (!assembly) {
      return sendJson(response, 200, { documents: [] });
    }

    const documents = await listAssemblyDocumentsByAssembly(assembly.id);
    return sendJson(response, 200, { documents });
  }

  if (documentsMatch && method === "PUT") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = documentsMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const assembly = await findLatestAssemblyByProperty(propertyId);
    if (!assembly) {
      return sendJson(response, 400, { error: "Primero debes guardar la configuracion base de la asamblea" });
    }

    const body = (await readJson(request)) as { documents?: AssemblyDocumentInput[] };
    const documents = body.documents ?? [];

    if (!Array.isArray(documents) || documents.some((document) => !isValidAssemblyDocument(document))) {
      return sendJson(response, 400, { error: "Documentos de asamblea invalidos" });
    }

    const savedDocuments = await replaceAssemblyDocuments(
      assembly.id,
      documents.map((document) => ({
        title: document.title.trim(),
        documentName: document.documentName.trim(),
        documentMimeType: document.documentMimeType?.trim() || undefined,
        documentData: document.documentData.trim(),
        category: document.category,
        agendaItemId: document.agendaItemId?.trim() || undefined
      }))
    );

    return sendJson(response, 200, { documents: savedDocuments });
  }

  const commSettingsMatch = pathname.match(/^\/api\/v1\/properties\/([^/]+)\/communication-settings$/);
  if (commSettingsMatch && method === "GET") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = commSettingsMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const settings = await getOrCreateCommunicationSettings(propertyId);
    return sendJson(response, 200, { settings });
  }

  if (commSettingsMatch && method === "PUT") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = commSettingsMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const body = (await readJson(request)) as CommunicationSettingsInput;
    const settings = await updateCommunicationSettings(propertyId, body);
    return sendJson(response, 200, { settings });
  }

  const commCampaignsMatch = pathname.match(/^\/api\/v1\/properties\/([^/]+)\/communication-campaigns$/);
  if (commCampaignsMatch && method === "GET") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = commCampaignsMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const campaigns = await listCommunicationCampaigns(propertyId);
    return sendJson(response, 200, { campaigns });
  }

  if (commCampaignsMatch && method === "POST") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = commCampaignsMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const body = (await readJson(request)) as {
      name?: string;
      purpose?: CampaignPurpose;
      primaryChannels?: ChannelType[];
      assemblyId?: string | null;
      audience?: "all" | "segment" | "single";
      fallbackChannel?: string | null;
    };

    if (!body.name?.trim() || !body.purpose || !Array.isArray(body.primaryChannels) || body.primaryChannels.length < 1) {
      return sendJson(response, 400, { error: "Invalid campaign payload" });
    }

    const row = await createDraftCampaign({
      propertyId,
      name: body.name,
      purpose: body.purpose,
      audience: body.audience,
      primaryChannels: body.primaryChannels,
      assemblyId: body.assemblyId,
      fallbackChannel: body.fallbackChannel ?? null
    });

    return sendJson(response, 201, { campaign: row });
  }

  const campaignDispatchMatch = pathname.match(
    /^\/api\/v1\/properties\/([^/]+)\/communication-campaigns\/([^/]+)\/dispatch$/
  );
  if (campaignDispatchMatch && method === "POST") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = campaignDispatchMatch[1];
    const campaignId = campaignDispatchMatch[2];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const body = (await readJson(request)) as {
      channel?: ChannelType;
      testRecipient?: string;
      subject?: string;
      body?: string;
      ctaUrl?: string;
      ctaLabel?: string;
      recipientName?: string;
      unitLabel?: string;
      deadline?: string;
      documentTypeLabel?: string;
    };

    if (!body.channel || !body.testRecipient?.trim()) {
      return sendJson(response, 400, {
        error: "Se requieren channel (email|sms|whatsapp) y testRecipient"
      });
    }

    try {
      const outcome = await dispatchCampaignTest({
        propertyId,
        campaignId,
        channel: body.channel,
        testRecipient: body.testRecipient.trim(),
        subject: typeof body.subject === "string" ? body.subject : undefined,
        body: typeof body.body === "string" ? body.body : undefined,
        ctaUrl: typeof body.ctaUrl === "string" ? body.ctaUrl : undefined,
        ctaLabel: typeof body.ctaLabel === "string" ? body.ctaLabel : undefined,
        recipientName: typeof body.recipientName === "string" ? body.recipientName : undefined,
        unitLabel: typeof body.unitLabel === "string" ? body.unitLabel : undefined,
        deadline: typeof body.deadline === "string" ? body.deadline : undefined,
        documentTypeLabel:
          typeof body.documentTypeLabel === "string" ? body.documentTypeLabel : undefined,
      });
      return sendJson(response, 200, {
        delivery: outcome.delivery,
        sendResult: outcome.sendResult
      });
    } catch (err) {
      const e = err as { statusCode?: number; message?: string };
      return sendJson(response, e.statusCode ?? 500, { error: e.message ?? "Dispatch failed" });
    }
  }

  const propertyDocumentRequestsMatch = pathname.match(/^\/api\/v1\/properties\/([^/]+)\/document-requests$/);
  if (propertyDocumentRequestsMatch && method === "GET") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = propertyDocumentRequestsMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const items = await listDocumentRequestsForProperty(propertyId);
    return sendJson(response, 200, { documentRequests: items });
  }

  const propertyDeliveriesMatch = pathname.match(/^\/api\/v1\/properties\/([^/]+)\/communication-deliveries$/);
  if (propertyDeliveriesMatch && method === "GET") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = propertyDeliveriesMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
    const rows = await listDeliveriesForProperty(propertyId, limit);
    return sendJson(response, 200, {
      deliveries: rows.map((d) => ({
        id: d.id,
        propertyId: d.propertyId,
        campaignId: d.campaignId,
        assemblyId: d.assemblyId,
        unitId: d.unitId,
        ownerId: d.ownerId,
        channel: d.channel,
        providerType: d.providerType,
        status: d.status,
        useCase: d.useCase,
        trackingToken: d.trackingToken,
        providerMessageId: d.providerMessageId,
        lastError: d.lastError,
        eventsJson: d.eventsJson,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        sentAt: d.sentAt?.toISOString() ?? null,
        campaign: d.campaign
      }))
    });
  }

  const propertyTemplatesMatch = pathname.match(/^\/api\/v1\/properties\/([^/]+)\/communication-templates$/);
  if (propertyTemplatesMatch && method === "GET") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = propertyTemplatesMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const templates = await listTemplates(propertyId);
    return sendJson(response, 200, { templates });
  }

  if (propertyTemplatesMatch && method === "POST") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = propertyTemplatesMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const body = (await readJson(request)) as {
      templateKey?: string;
      channel?: string;
      name?: string;
      subjectTemplate?: string;
      bodyTemplate?: string;
      isActive?: boolean;
    };

    if (!body.templateKey?.trim() || !body.channel?.trim() || !body.name?.trim() || !body.bodyTemplate?.trim()) {
      return sendJson(response, 400, { error: "templateKey, channel, name y bodyTemplate son requeridos" });
    }

    const row = await upsertTemplate({
      propertyId,
      templateKey: body.templateKey.trim(),
      channel: body.channel.trim(),
      name: body.name.trim(),
      subjectTemplate: body.subjectTemplate ?? null,
      bodyTemplate: body.bodyTemplate.trim(),
      isActive: body.isActive
    });

    return sendJson(response, 200, { template: row });
  }

  const propertyTemplateByIdMatch = pathname.match(
    /^\/api\/v1\/properties\/([^/]+)\/communication-templates\/([^/]+)$/
  );
  if (propertyTemplateByIdMatch && method === "DELETE") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = propertyTemplateByIdMatch[1];
    const templateId = propertyTemplateByIdMatch[2];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    await deleteTemplate(propertyId, templateId);
    return sendJson(response, 200, { ok: true });
  }

  if (propertyTemplateByIdMatch && method === "PUT") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = propertyTemplateByIdMatch[1];
    const templateId = propertyTemplateByIdMatch[2];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const existing = await listTemplates(propertyId);
    const current = existing.find((t) => t.id === templateId);
    if (!current) {
      return sendJson(response, 404, { error: "Template not found" });
    }

    const body = (await readJson(request)) as {
      name?: string;
      subjectTemplate?: string | null;
      bodyTemplate?: string;
      isActive?: boolean;
    };

    const row = await upsertTemplate({
      propertyId,
      templateKey: current.templateKey,
      channel: current.channel,
      name: body.name?.trim() ?? current.name,
      subjectTemplate: body.subjectTemplate !== undefined ? body.subjectTemplate : current.subjectTemplate,
      bodyTemplate: body.bodyTemplate?.trim() ?? current.bodyTemplate,
      isActive: body.isActive ?? current.isActive
    });

    return sendJson(response, 200, { template: row });
  }

  const invitationsSendMatch = pathname.match(/^\/api\/v1\/properties\/([^/]+)\/assembly-invitations\/send$/);
  if (invitationsSendMatch && method === "POST") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = invitationsSendMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const body = (await readJson(request)) as {
      assemblyId?: string;
      scope?: string;
      unitId?: string;
    };

    const assemblyIdBody = body.assemblyId?.trim();
    if (!assemblyIdBody) {
      return sendJson(response, 400, { error: "assemblyId es requerido" });
    }

    const assembly = await findAssemblyById(assemblyIdBody);
    if (!assembly || assembly.propertyId !== propertyId) {
      return sendJson(response, 404, { error: "Asamblea no encontrada" });
    }

    if (body.scope !== "all_ready" && body.scope !== "unit") {
      return sendJson(response, 400, { error: "scope debe ser all_ready o unit" });
    }

    if (body.scope === "unit" && !body.unitId?.trim()) {
      return sendJson(response, 400, { error: "unitId es requerido cuando scope es unit" });
    }

    if (!process.env.RESEND_API_KEY?.trim()) {
      return sendJson(response, 503, {
        error:
          "RESEND_API_KEY no está configurada. Añádela en .env del API para enviar convocatorias por correo."
      });
    }

    const recipients = await buildAssemblyInvitationRecipients(propertyId);
    const settings = await getOrCreateCommunicationSettings(propertyId);
    const contactEmail = settings.senderEmailFrom?.trim() || admin.email;

    const { deliveries, results } = await sendAssemblyInvitationEmails({
      propertyId,
      assembly,
      propertyName: property.name,
      recipients,
      scope: body.scope,
      unitId: body.unitId?.trim(),
      resend: resendProvider,
      contactEmail,
      locale: settings.locale ?? "es-CO"
    });

    return sendJson(response, 200, { deliveries, results });
  }

  const invitationsMatch = pathname.match(/^\/api\/v1\/properties\/([^/]+)\/assembly-invitations$/);
  if (invitationsMatch && method === "GET") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = invitationsMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const assemblyIdQuery = url.searchParams.get("assemblyId");
    const trimmedAssemblyQuery = assemblyIdQuery?.trim();
    const assembly = await resolveAssemblyForInvitations(propertyId, assemblyIdQuery);
    if (trimmedAssemblyQuery && !assembly) {
      return sendJson(response, 404, { error: "Asamblea no encontrada" });
    }
    const recipients = await buildAssemblyInvitationRecipients(propertyId);

    if (!assembly) {
      return sendJson(response, 200, { recipients, deliveries: [] });
    }

    const rows = await listAssemblyInvitationsByAssembly(assembly.id);
    const deliveries = mapInvitationDeliveriesToSummary(rows);
    return sendJson(response, 200, { recipients, deliveries });
  }

  if (invitationsMatch && method === "PUT") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = invitationsMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const assemblyIdQuery = url.searchParams.get("assemblyId");
    const trimmedAssemblyQuery = assemblyIdQuery?.trim();
    const assembly = await resolveAssemblyForInvitations(propertyId, assemblyIdQuery);
    if (trimmedAssemblyQuery && !assembly) {
      return sendJson(response, 404, { error: "Asamblea no encontrada" });
    }
    if (!assembly) {
      return sendJson(response, 400, { error: "Primero debes guardar la configuracion base de la asamblea" });
    }

    const body = (await readJson(request)) as { deliveries?: AssemblyInvitationDeliverySummary[] };
    const deliveries = body.deliveries ?? [];

    if (!Array.isArray(deliveries) || deliveries.some((delivery) => !isValidInvitationDelivery(delivery))) {
      return sendJson(response, 400, { error: "Registro de convocatoria invalido" });
    }

    const savedDeliveries = await replaceAssemblyInvitations(
      assembly.id,
      deliveries.map((delivery) => ({
        unitId: delivery.unitId,
        sentAt: delivery.sentAt,
        channel: delivery.channel,
        status: delivery.status,
        note: delivery.note?.trim() || undefined
      }))
    );

    return sendJson(response, 200, { deliveries: mapInvitationDeliveriesToSummary(savedDeliveries) });
  }

  const accessMatch = pathname.match(/^\/api\/v1\/properties\/([^/]+)\/assembly-access$/);
  if (accessMatch && method === "GET") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = accessMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const assembly = await findLatestAssemblyByProperty(propertyId);
    if (!assembly) {
      return sendJson(response, 200, { config: null, grants: [] });
    }

    const config = await findAssemblyAccessConfigByAssembly(assembly.id);
    const grants = await buildAssemblyAccessGrants(propertyId, assembly.id);
    return sendJson(response, 200, { config, grants });
  }

  if (accessMatch && method === "PUT") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = accessMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const assembly = await findLatestAssemblyByProperty(propertyId);
    if (!assembly) {
      return sendJson(response, 400, { error: "Primero debes guardar la configuracion base de la asamblea" });
    }

    const body = (await readJson(request)) as {
      config?: AssemblyAccessConfigInput;
      grants?: AssemblyAccessGrantInput[];
    };

    if (!body.config || !isValidAssemblyAccessConfig(body.config)) {
      return sendJson(response, 400, { error: "Configuracion de acceso invalida" });
    }

    const grants = body.grants ?? [];
    if (!Array.isArray(grants) || grants.some((grant) => !isValidAssemblyAccessGrant(grant))) {
      return sendJson(response, 400, { error: "Matriz de acceso invalida" });
    }

    const existingConfig = await findAssemblyAccessConfigByAssembly(assembly.id);
    const config = existingConfig
      ? await updateAssemblyAccessConfig(existingConfig.id, {
          sessionAccessMode: body.config.sessionAccessMode,
          identityValidationMethod: body.config.identityValidationMethod,
          otpChannel: body.config.otpChannel,
          requireDocumentMatch: body.config.requireDocumentMatch,
          enableLobby: body.config.enableLobby,
          allowCompanions: body.config.allowCompanions,
          oneActiveVoterPerUnit: body.config.oneActiveVoterPerUnit,
          fallbackManualValidation: body.config.fallbackManualValidation
        })
      : await createAssemblyAccessConfig({
          assemblyId: assembly.id,
          sessionAccessMode: body.config.sessionAccessMode,
          identityValidationMethod: body.config.identityValidationMethod,
          otpChannel: body.config.otpChannel,
          requireDocumentMatch: body.config.requireDocumentMatch,
          enableLobby: body.config.enableLobby,
          allowCompanions: body.config.allowCompanions,
          oneActiveVoterPerUnit: body.config.oneActiveVoterPerUnit,
          fallbackManualValidation: body.config.fallbackManualValidation
        });

    await replaceAssemblyAccessGrants(
      assembly.id,
      grants.map((grant) => ({
        unitId: grant.unitId,
        deliveryChannel: grant.deliveryChannel,
        validationMethod: grant.validationMethod,
        preRegistrationStatus: grant.preRegistrationStatus,
        dispatchStatus: grant.dispatchStatus,
        note: grant.note?.trim() || undefined
      }))
    );

    const mergedGrants = await buildAssemblyAccessGrants(propertyId, assembly.id);
    return sendJson(response, 200, { config, grants: mergedGrants });
  }

  // ─── Assembly vote results ──────────────────────────────────────────────────

  const voteResultsMatch = pathname.match(/^\/api\/v1\/properties\/([^/]+)\/assembly-votes$/);
  if (voteResultsMatch && method === "GET") {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const propertyId = voteResultsMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const assembly = await findLatestAssemblyByProperty(propertyId);
    if (!assembly) return sendJson(response, 200, { results: [] });

    const results = await listVoteResultsByAssembly(assembly.id);
    return sendJson(response, 200, { results });
  }

  if (voteResultsMatch && method === "POST") {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const propertyId = voteResultsMatch[1];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const assembly = await findLatestAssemblyByProperty(propertyId);
    if (!assembly) return sendJson(response, 404, { error: "No active assembly" });

    const body = (await readJson(request)) as AssemblyVoteResultInput;
    if (!body.question?.trim() || typeof body.yesVotes !== "number") {
      return sendJson(response, 400, { error: "Datos de votación inválidos" });
    }

    const approved = computeVoteApproval(body.yesVotes, body.noVotes, body.abstainVotes, body.votingRule);

    const result = await createVoteResult({
      assemblyId: assembly.id,
      agendaItemId: body.agendaItemId,
      question: body.question.trim(),
      votingRule: body.votingRule,
      yesVotes: body.yesVotes,
      noVotes: body.noVotes,
      abstainVotes: body.abstainVotes,
      blankVotes: body.blankVotes,
      totalCoefficient: body.totalCoefficient,
      approved
    });
    return sendJson(response, 201, { result });
  }

  // GET /api/v1/properties/:propertyId/assemblies/:assemblyId/votes — works for any status (including closed)
  const assemblyVotesMatch = pathname.match(/^\/api\/v1\/properties\/([^/]+)\/assemblies\/([^/]+)\/votes$/);
  if (assemblyVotesMatch && method === "GET") {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const propertyId = assemblyVotesMatch[1];
    const assemblyId = assemblyVotesMatch[2];
    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const assembly = await findAssemblyById(assemblyId);
    if (!assembly || assembly.propertyId !== propertyId) {
      return sendJson(response, 404, { error: "Assembly not found" });
    }

    const results = await listVoteResultsByAssembly(assemblyId);
    return sendJson(response, 200, { results });
  }

  const propertyAssemblyMatch = pathname.match(/^\/api\/v1\/properties\/([^/]+)\/assemblies\/([^/]+)$/);
  if (propertyAssemblyMatch && method === "GET") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = propertyAssemblyMatch[1];
    const assemblyId = propertyAssemblyMatch[2];
    const property = await findPropertyById(propertyId);

    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const assembly = await findAssemblyById(assemblyId);
    if (!assembly || assembly.propertyId !== propertyId) {
      return sendJson(response, 404, { error: "Assembly not found" });
    }

    const readiness = await buildAssemblyReadiness(propertyId);
    if (!readiness) {
      return sendJson(response, 404, { error: "Assembly readiness not found" });
    }

    const savedAgenda = await listAgendaItemsByAssembly(assemblyId);
    const agenda = savedAgenda.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      slideTitle: item.slideTitle,
      slideContent: item.slideContent,
      speakerNotes: item.speakerNotes,
      votePrompt: item.votePrompt,
      type: item.type,
      votingRule: item.votingRule,
      requiresAttachment: item.requiresAttachment,
      order: item.order,
      status: item.status
    }));

    return sendJson(response, 200, { assembly: buildAssemblyOverviewFromReadiness(readiness, assemblyId, agenda) });
  }

  const proxyReviewMatch = pathname.match(/^\/api\/v1\/properties\/([^/]+)\/proxy-requests\/([^/]+)\/review$/);
  if (proxyReviewMatch && method === "PUT") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = proxyReviewMatch[1];
    const ownerId = proxyReviewMatch[2];
    const property = await findPropertyById(propertyId);
    const owner = await findOwnerById(ownerId);

    if (!property || property.adminId !== admin.id || !owner || owner.propertyId !== propertyId) {
      return sendJson(response, 404, { error: "Proxy request not found" });
    }

    const body = (await readJson(request)) as {
      decision?: "approved" | "rejected";
      reasons?: string[];
      note?: string;
    };

    if (!body.decision || !["approved", "rejected"].includes(body.decision)) {
      return sendJson(response, 400, { error: "Invalid review payload" });
    }

    if (body.decision === "rejected" && (!Array.isArray(body.reasons) || body.reasons.length < 1)) {
      return sendJson(response, 400, { error: "Debes seleccionar al menos una razon de rechazo" });
    }

    await updateOwner(owner.id, {
      fullName: owner.fullName,
      documentType: owner.documentType,
      email: owner.email,
      phone: owner.phone,
      document: owner.document,
      participationRole: owner.participationRole,
      canVote: body.decision === "approved",
      receivesInvitations: body.decision === "approved",
      proxyDocumentName: owner.proxyDocumentName,
      proxyDocumentMimeType: owner.proxyDocumentMimeType,
      proxyDocumentData: owner.proxyDocumentData,
      proxyApprovalStatus: body.decision,
      proxyRequestToken: owner.proxyRequestToken,
      proxyRequestedAt: owner.proxyRequestedAt,
      proxyLastSubmittedAt: owner.proxyLastSubmittedAt,
      proxySubmittedByName: owner.proxySubmittedByName,
      proxySubmittedByEmail: owner.proxySubmittedByEmail,
      proxySubmittedByRole: owner.proxySubmittedByRole,
      proxyRejectionReasons: body.decision === "rejected" ? body.reasons : [],
      proxyRejectionNote: body.decision === "rejected" ? body.note?.trim() || undefined : undefined
    });

    await recordProxyReviewAction(
      owner.id,
      admin.id,
      body.decision,
      body.decision === "rejected" ? body.reasons ?? [] : [],
      body.decision === "rejected" ? body.note?.trim() : undefined
    );

    return sendJson(response, 200, { success: true });
  }

  const propertyUnitsMatch = pathname.match(/^\/api\/v1\/properties\/([^/]+)\/units$/);
  if (propertyUnitsMatch && method === "GET") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = propertyUnitsMatch[1];
    const property = await findPropertyById(propertyId);

    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const units = await listUnitsByProperty(propertyId);
    const summaries = await Promise.all(units.map((unit) => toUnitSummary(unit)));
    return sendJson(response, 200, { units: summaries });
  }

  if (propertyUnitsMatch && method === "POST") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = propertyUnitsMatch[1];
    const property = await findPropertyById(propertyId);

    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 404, { error: "Property not found" });
    }

    const body = (await readJson(request)) as { units?: UnitCreateInput[] };
    const units = body.units ?? [];

    if (!Array.isArray(units) || units.length < 1) {
      return sendJson(response, 400, { error: "Debes registrar al menos una unidad" });
    }

    const firstUnitError = units.map(getUnitValidationError).find(Boolean);
    if (firstUnitError) {
      return sendJson(response, 400, { error: firstUnitError });
    }

    const created = await createUnits(
      units.map((unit) => ({
        propertyId,
        unitType: unit.unitType,
        groupingKind: unit.groupingKind,
        groupingLabel: unit.groupingLabel.trim(),
        unitNumber: unit.unitNumber.trim(),
        floor: unit.floor?.trim() || undefined,
        destination: unit.destination.trim(),
        privateArea: unit.privateArea,
        coefficient: unit.coefficient,
        contributionModule: unit.contributionModule
      }))
    );

    for (const [index, unit] of units.entries()) {
      await syncUnitOwners(propertyId, created[index].id, unit.owners);
    }

    const totalUnits = (await listUnitsByProperty(propertyId)).length;
    await updateProperty(propertyId, {
      ...property,
      totalUnits
    });

    const summaries = await Promise.all(created.map((unit) => toUnitSummary(unit)));
    return sendJson(response, 201, { units: summaries });
  }

  const propertyUnitMatch = pathname.match(/^\/api\/v1\/properties\/([^/]+)\/units\/([^/]+)$/);
  if (propertyUnitMatch && method === "GET") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = propertyUnitMatch[1];
    const unitId = propertyUnitMatch[2];
    const property = await findPropertyById(propertyId);
    const unit = await findUnitById(unitId);

    if (!property || property.adminId !== admin.id || !unit || unit.propertyId !== propertyId) {
      return sendJson(response, 404, { error: "Unit not found" });
    }

    return sendJson(response, 200, { unit: await toUnitSummary(unit) });
  }

  if (propertyUnitMatch && method === "PUT") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = propertyUnitMatch[1];
    const unitId = propertyUnitMatch[2];
    const property = await findPropertyById(propertyId);
    const unit = await findUnitById(unitId);

    if (!property || property.adminId !== admin.id || !unit || unit.propertyId !== propertyId) {
      return sendJson(response, 404, { error: "Unit not found" });
    }

    const body = (await readJson(request)) as UnitCreateInput;

    const validationError = getUnitValidationError(body);
    if (validationError) {
      return sendJson(response, 400, { error: validationError });
    }

    const updated = await updateUnit(unitId, {
      groupingLabel: body.groupingLabel.trim(),
      unitNumber: body.unitNumber.trim(),
      floor: body.floor?.trim() || undefined,
      destination: body.destination.trim(),
      privateArea: body.privateArea,
      coefficient: body.coefficient,
      contributionModule: body.contributionModule
    });

    await syncUnitOwners(propertyId, unitId, body.owners);

    return sendJson(response, 200, { unit: updated ? await toUnitSummary(updated) : null });
  }

  if (propertyUnitMatch && method === "DELETE") {
    const admin = await requireAdmin(request, response);
    if (!admin) {
      return;
    }

    const propertyId = propertyUnitMatch[1];
    const unitId = propertyUnitMatch[2];
    const property = await findPropertyById(propertyId);
    const unit = await findUnitById(unitId);

    if (!property || property.adminId !== admin.id || !unit || unit.propertyId !== propertyId) {
      return sendJson(response, 404, { error: "Unit not found" });
    }

    await deleteUnitWithOwners(unitId);
    const remainingUnits = await listUnitsByProperty(propertyId);
    await updateProperty(propertyId, {
      ...property,
      totalUnits: remainingUnits.length
    });

    return sendJson(response, 200, { success: true });
  }

  // ─── Conference / LiveKit endpoints ─────────────────────────────────────────
  // Convención: /api/v1/properties/:pId/assemblies/:aId/conference/...
  //
  // Seguridad multi-tenant:
  //   - Todos los endpoints de admin verifican que property.adminId === admin.id
  //   - Los tokens de asistente validan que la asamblea esté in_progress
  //   - Las operaciones de cola verifican que el entryId pertenece a la asamblea correcta

  // POST …/conference/token  — Token admin (autenticado)
  if (
    method === "POST" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/conference\/token$/.test(pathname)
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const [, , , , propertyId, , assemblyId] = pathname.split("/");

    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 403, { error: "Forbidden: not your property" });
    }

    const assembly = await findAssemblyById(assemblyId);
    if (!assembly || assembly.propertyId !== propertyId) {
      return sendJson(response, 404, { error: "Assembly not found" });
    }

    const participantIdentity = adminIdentity(admin.id);
    const token = await generateLiveKitToken({
      propertyId,
      assemblyId,
      participantIdentity,
      displayName: admin.fullName,
      role: "admin" as ConferenceRole,
      metadata: { role: "admin", adminId: admin.id, propertyId },
    });

    // Auditar ingreso del admin
    await auditParticipantEvent(assemblyId, propertyId, "participant_joined", participantIdentity, admin.fullName);

    return sendJson(response, 200, {
      token,
      roomName: buildRoomName(propertyId, assemblyId),
      participantIdentity,
      livekitUrl: LIVEKIT_URL,
    });
  }

  // POST …/conference/attendee-token  — Token asistente
  if (
    method === "POST" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/conference\/attendee-token$/.test(pathname)
  ) {
    const [, , , , propertyId, , assemblyId] = pathname.split("/");

    const body = (await readJson(request)) as {
      participantIdentity?: string;
      displayName?: string;
    };

    if (!body.participantIdentity?.trim() || !body.displayName?.trim()) {
      return sendJson(response, 400, { error: "participantIdentity and displayName are required" });
    }

    const identity    = body.participantIdentity.trim();
    const displayName = body.displayName.trim();

    // Validación estricta de identidad: formato, longitud, prefijo reservado
    try {
      validateAttendeeIdentity(identity);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      return sendJson(response, e.statusCode ?? 400, { error: e.message ?? "Invalid identity" });
    }

    const assembly = await findAssemblyById(assemblyId);
    if (!assembly || assembly.propertyId !== propertyId) {
      return sendJson(response, 404, { error: "Assembly not found" });
    }

    const attendeeMayEnterRoom = ["invitation_sent", "scheduled", "in_progress"].includes(assembly.status);
    if (!attendeeMayEnterRoom) {
      return sendJson(response, 403, {
        error:
          "Esta asamblea aún no admite entrada de asistentes (debe estar convocada o programada), o ya finalizó."
      });
    }

    // Verificar si el participante tiene un turno activo para restaurar permisos correctos
    const participantState = await getParticipantState(assemblyId, identity);
    const isSpeaking = participantState?.status === "speaking" &&
      participantState.speakingEndsAt != null &&
      new Date(participantState.speakingEndsAt) > new Date();

    const role: ConferenceRole = isSpeaking ? "speaker" : "attendee";

    const token = await generateLiveKitToken({
      propertyId,
      assemblyId,
      participantIdentity: identity,
      displayName,
      role,
      metadata: { role, propertyId, assemblyId, queueEntryId: participantState?.id ?? null },
    });

    if (isSpeaking) {
      // Restaurar permisos elevados en LiveKit tras reconexión
      try {
        await elevateParticipantToSpeaker(
          propertyId,
          assemblyId,
          identity,
          (participantState?.modalidad ?? "mic") as import("@kuoro/contracts").SpeakModalidad,
        );
      } catch { /* LiveKit puede no estar disponible en dev */ }

      await auditParticipantEvent(assemblyId, propertyId, "speaker_reconnected", identity, displayName);
    } else {
      await auditParticipantEvent(assemblyId, propertyId, "participant_joined", identity, displayName);
    }

    return sendJson(response, 200, {
      token,
      roomName: buildRoomName(propertyId, assemblyId),
      participantIdentity: identity,
      livekitUrl: LIVEKIT_URL,
      restoredSpeakerEntry: isSpeaking ? participantState : null,
    });
  }

  // PUT …/conference/live-slide  — Admin publica la diapositiva actual
  if (
    method === "PUT" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/conference\/live-slide$/.test(pathname)
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    const [, , , , , , assemblyId] = pathname.split("/");
    const body = await readJson(request);
    liveSlideStore.set(assemblyId, body);
    return sendJson(response, 200, { ok: true });
  }

  // GET …/conference/live-slide  — Asistente obtiene la diapositiva actual
  if (
    method === "GET" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/conference\/live-slide$/.test(pathname)
  ) {
    const [, , , , , , assemblyId] = pathname.split("/");
    const slide = liveSlideStore.get(assemblyId) ?? null;
    return sendJson(response, 200, { slide });
  }

  // GET …/conference/queue  — Cola completa (admin)
  if (
    method === "GET" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/conference\/queue$/.test(pathname)
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const [, , , , propertyId, , assemblyId] = pathname.split("/");

    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 403, { error: "Forbidden" });
    }

    const queue = await getQueue(assemblyId);
    return sendJson(response, 200, { queue });
  }

  // GET …/conference/queue/my-state  — Estado del participante (asistente, reconexión)
  if (
    method === "GET" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/conference\/queue\/my-state$/.test(pathname)
  ) {
    const [, , , , propertyId, , assemblyId] = pathname.split("/");
    const identity = url.searchParams.get("identity");

    if (!identity?.trim()) {
      return sendJson(response, 400, { error: "identity query param required" });
    }

    try {
      validateAttendeeIdentity(identity);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      return sendJson(response, e.statusCode ?? 400, { error: e.message ?? "Invalid identity" });
    }

    const assembly = await findAssemblyById(assemblyId);
    if (!assembly || assembly.propertyId !== propertyId || assembly.status !== "in_progress") {
      return sendJson(response, 403, { error: "Assembly not in progress" });
    }

    const state = await getParticipantState(assemblyId, identity);
    return sendJson(response, 200, { entry: state });
  }

  // POST …/conference/queue  — Solicitar la palabra (asistente)
  if (
    method === "POST" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/conference\/queue$/.test(pathname)
  ) {
    const [, , , , propertyId, , assemblyId] = pathname.split("/");

    const body = (await readJson(request)) as SpeakerRequestInput;
    if (!body.participantIdentity?.trim() || !body.displayName?.trim()) {
      return sendJson(response, 400, { error: "participantIdentity and displayName are required" });
    }

    // Validación estricta de identidad del asistente
    try {
      validateAttendeeIdentity(body.participantIdentity.trim());
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      return sendJson(response, e.statusCode ?? 400, { error: e.message ?? "Invalid identity" });
    }

    const assembly = await findAssemblyById(assemblyId);
    if (!assembly || assembly.propertyId !== propertyId || assembly.status !== "in_progress") {
      return sendJson(response, 403, { error: "Assembly is not currently in progress" });
    }

    const entry = await requestSpeaker(
      propertyId,
      assemblyId,
      body.participantIdentity.trim(),
      body.displayName.trim(),
    );
    return sendJson(response, 200, { entry });
  }

  // POST …/conference/queue/:entryId/approve  — Aprobar turno (admin)
  if (
    method === "POST" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/conference\/queue\/[^/]+\/approve$/.test(pathname)
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const segments   = pathname.split("/");
    const propertyId = segments[4];
    const assemblyId = segments[6];
    const entryId    = segments[9];

    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 403, { error: "Forbidden" });
    }

    const body = (await readJson(request)) as SpeakerApproveInput;
    if (
      !["mic", "mic_camera"].includes(body.modalidad) ||
      ![1, 3, 5].includes(body.durationMinutes)
    ) {
      return sendJson(response, 400, { error: "Invalid modalidad or durationMinutes" });
    }

    const durationSeconds = body.durationMinutes * 60;

    let entry;
    try {
      entry = await approveSpeaker(
        assemblyId,
        propertyId,
        entryId,
        body.modalidad,
        durationSeconds,
        admin.id,
      );
    } catch (err) {
      const e = err as { statusCode?: number; message: string };
      return sendJson(response, e.statusCode ?? 500, { error: e.message });
    }

    // Elevar permisos en LiveKit (no bloquea si falla — la BD ya tiene el estado)
    try {
      await elevateParticipantToSpeaker(propertyId, assemblyId, entry.participantIdentity, body.modalidad);
    } catch (lkErr) {
      console.error("[conference/approve] LiveKit elevate failed — encolando para reintento:", lkErr);
      await enqueueLiveKitAction({
        assemblyId,
        propertyId,
        roomName:            buildRoomName(propertyId, assemblyId),
        participantIdentity: entry.participantIdentity,
        actionType:          "elevate_speaker",
        payload:             { modalidad: body.modalidad },
      });
    }

    return sendJson(response, 200, { entry });
  }

  // POST …/conference/queue/:entryId/reject  — Rechazar turno (admin)
  if (
    method === "POST" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/conference\/queue\/[^/]+\/reject$/.test(pathname)
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const segments   = pathname.split("/");
    const propertyId = segments[4];
    const assemblyId = segments[6];
    const entryId    = segments[9];

    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 403, { error: "Forbidden" });
    }

    let entry;
    try {
      entry = await rejectSpeaker(assemblyId, propertyId, entryId, admin.id);
    } catch (err) {
      const e = err as { statusCode?: number; message: string };
      return sendJson(response, e.statusCode ?? 500, { error: e.message });
    }

    return sendJson(response, 200, { entry });
  }

  // POST …/conference/queue/:entryId/finish  — Finalizar turno manualmente (admin)
  if (
    method === "POST" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/conference\/queue\/[^/]+\/finish$/.test(pathname)
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const segments   = pathname.split("/");
    const propertyId = segments[4];
    const assemblyId = segments[6];
    const entryId    = segments[9];

    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 403, { error: "Forbidden" });
    }

    let entry;
    try {
      entry = await finishSpeaker(assemblyId, propertyId, entryId, admin.id);
    } catch (err) {
      const e = err as { statusCode?: number; message: string };
      return sendJson(response, e.statusCode ?? 500, { error: e.message });
    }

    try {
      await revokeParticipantSpeaker(propertyId, assemblyId, entry.participantIdentity);
    } catch (lkErr) {
      console.error("[conference/finish] LiveKit revoke failed — encolando para reintento:", lkErr);
      await enqueueLiveKitAction({
        assemblyId,
        propertyId,
        roomName:            buildRoomName(propertyId, assemblyId),
        participantIdentity: entry.participantIdentity,
        actionType:          "revoke_speaker",
      });
    }

    return sendJson(response, 200, { entry });
  }

  // DELETE …/conference/queue  — Cancelar toda la cola (sin cerrar la sala)
  if (
    method === "DELETE" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/conference\/queue$/.test(pathname)
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const [, , , , propertyId, , assemblyId] = pathname.split("/");

    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 403, { error: "Forbidden" });
    }

    const cancelled = await cancelAllActive(assemblyId, propertyId, admin.id);
    return sendJson(response, 200, { success: true, cancelled });
  }

  // POST …/conference/close  — Cerrar sala (admin): cancela cola + revoca speaker + cierra asamblea
  if (
    method === "POST" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/conference\/close$/.test(pathname)
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const [, , , , propertyId, , assemblyId] = pathname.split("/");

    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 403, { error: "Forbidden" });
    }

    const assembly = await findAssemblyById(assemblyId);
    if (!assembly || assembly.propertyId !== propertyId) {
      return sendJson(response, 404, { error: "Assembly not found" });
    }

    const result = await closeRoom(assemblyId, propertyId, admin.id);
    return sendJson(response, 200, { success: true, ...result });
  }

  // POST …/conference/admin-left  — Notificación: admin salió temporalmente (no cierra sala)
  if (
    method === "POST" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/conference\/admin-left$/.test(pathname)
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const [, , , , propertyId, , assemblyId] = pathname.split("/");

    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 403, { error: "Forbidden" });
    }

    await onAdminLeft(assemblyId, propertyId, admin.id, admin.fullName);
    return sendJson(response, 200, { success: true });
  }

  // GET …/conference/room-status  — Estado actual de la sala (admin)
  if (
    method === "GET" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/conference\/room-status$/.test(pathname)
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const [, , , , propertyId, , assemblyId] = pathname.split("/");

    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 403, { error: "Forbidden" });
    }

    const status = await getRoomStatus(assemblyId, propertyId);
    return sendJson(response, 200, status);
  }

  // GET …/conference/audit  — Log de auditoría (admin)
  if (
    method === "GET" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/conference\/audit$/.test(pathname)
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const [, , , , propertyId, , assemblyId] = pathname.split("/");

    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 403, { error: "Forbidden" });
    }

    const limitStr = url.searchParams.get("limit");
    const limit    = limitStr ? Math.min(Number(limitStr), 200) : 50;
    const logs     = await getAuditLog(assemblyId, limit);
    return sendJson(response, 200, { logs });
  }

  // ─── Votación digital ──────────────────────────────────────────────────────
  // Convención: /api/v1/properties/:pId/assemblies/:aId/voting-sessions/...
  //
  // Seguridad:
  //   - Endpoints de admin (open, close, cancel, list, votes) verifican adminId === property.adminId
  //   - Endpoints de asistente (vote, my-vote, attendee view) usan accessToken como credencial
  //   - active: público dentro del tenant (accesible por admin y asistentes)

  // POST …/voting-sessions — Abrir sesión de votación (admin)
  if (
    method === "POST" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/voting-sessions$/.test(pathname)
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const [, , , , propertyId, , assemblyId] = pathname.split("/");

    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 403, { error: "Forbidden" });
    }

    const assembly = await findAssemblyById(assemblyId);
    if (!assembly || assembly.propertyId !== propertyId) {
      return sendJson(response, 404, { error: "Assembly not found" });
    }
    if (assembly.status !== "in_progress") {
      return sendJson(response, 403, { error: "La asamblea no está en curso" });
    }

    const body = (await readJson(request)) as import("@kuoro/contracts").OpenVotingSessionInput;
    if (!body.question?.trim()) {
      return sendJson(response, 400, { error: "question es requerido" });
    }
    if (!["simple", "dos_tercios", "unanimidad"].includes(body.votingRule)) {
      return sendJson(response, 400, { error: "votingRule inválido" });
    }
    if (!["coeficientes", "modulos", "unidad"].includes(body.votingBasis)) {
      return sendJson(response, 400, { error: "votingBasis inválido" });
    }

    try {
      const session = await openSession(
        assemblyId, propertyId, admin.id,
        body.question.trim(), body.votingRule, body.votingBasis,
        body.agendaItemId,
      );
      return sendJson(response, 201, { session });
    } catch (err) {
      const e = err as { statusCode?: number; message: string };
      return sendJson(response, e.statusCode ?? 500, { error: e.message });
    }
  }

  // GET …/voting-sessions — Listar sesiones de la asamblea (admin)
  if (
    method === "GET" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/voting-sessions$/.test(pathname)
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const [, , , , propertyId, , assemblyId] = pathname.split("/");

    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 403, { error: "Forbidden" });
    }

    const sessions = await listSessions(assemblyId, propertyId);
    return sendJson(response, 200, { sessions });
  }

  // GET …/voting-sessions/active — Sesión activa actual (admin + asistente)
  if (
    method === "GET" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/voting-sessions\/active$/.test(pathname)
  ) {
    const [, , , , propertyId, , assemblyId] = pathname.split("/");

    try {
      const assembly = await findAssemblyById(assemblyId);
      if (!assembly || assembly.propertyId !== propertyId) {
        console.warn(`[Voting] active session — assembly not found: assemblyId=${assemblyId} propertyId=${propertyId}`);
        return sendJson(response, 404, { error: "Assembly not found" });
      }

      const session = await getActiveSession(assemblyId, propertyId);
      console.log(`[Voting] active session query — assemblyId=${assemblyId} found=${!!session}`);
      return sendJson(response, 200, { session });
    } catch (err) {
      const e = err as { statusCode?: number; message: string };
      console.error(`[Voting] active session error — assemblyId=${assemblyId}:`, err);
      return sendJson(response, e.statusCode ?? 500, { error: e.message ?? "Error al obtener sesión activa" });
    }
  }

  // POST …/voting-sessions/:sId/vote — Emitir voto (asistente vía accessToken)
  if (
    method === "POST" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/voting-sessions\/[^/]+\/vote$/.test(pathname)
  ) {
    const segments   = pathname.split("/");
    const propertyId = segments[4];
    const assemblyId = segments[6];
    const sessionId  = segments[8];

    const assembly = await findAssemblyById(assemblyId);
    if (!assembly || assembly.propertyId !== propertyId) {
      return sendJson(response, 404, { error: "Assembly not found" });
    }
    if (assembly.status !== "in_progress") {
      return sendJson(response, 403, { error: "La asamblea no está en curso" });
    }

    const body = (await readJson(request)) as import("@kuoro/contracts").CastVoteInput;
    if (!body.accessToken?.trim()) {
      return sendJson(response, 400, { error: "accessToken es requerido" });
    }
    if (!["yes", "no", "abstain", "blank"].includes(body.voteValue)) {
      return sendJson(response, 400, { error: "voteValue inválido" });
    }

    try {
      const result = await castVote(
        sessionId,
        body.accessToken.trim(),
        body.voteValue,
        propertyId,
        body.participantIdentity,
        body.unitId?.trim(),   // soporte multi-unidad vía representación
      );
      return sendJson(response, 200, result);
    } catch (err) {
      const e = err as { statusCode?: number; message: string };
      return sendJson(response, e.statusCode ?? 500, { error: e.message });
    }
  }

  // GET …/voting-sessions/:sId/attendee-view?accessToken= — Vista del asistente
  if (
    method === "GET" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/voting-sessions\/[^/]+\/attendee-view$/.test(pathname)
  ) {
    const segments   = pathname.split("/");
    const propertyId = segments[4];
    const assemblyId = segments[6];
    const sessionId  = segments[8];
    const accessToken = url.searchParams.get("accessToken") ?? "";

    if (!accessToken) {
      return sendJson(response, 400, { error: "accessToken es requerido" });
    }

    try {
      const view = await getAttendeeView(sessionId, assemblyId, propertyId, accessToken);
      return sendJson(response, 200, { view });
    } catch (err) {
      const e = err as { statusCode?: number; message: string };
      return sendJson(response, e.statusCode ?? 500, { error: e.message });
    }
  }

  // GET …/voting-sessions/:sId/my-vote?accessToken= — Mi voto
  if (
    method === "GET" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/voting-sessions\/[^/]+\/my-vote$/.test(pathname)
  ) {
    const segments   = pathname.split("/");
    const propertyId = segments[4];
    const assemblyId = segments[6];
    const sessionId  = segments[8];
    const accessToken = url.searchParams.get("accessToken") ?? "";

    if (!accessToken) {
      return sendJson(response, 400, { error: "accessToken es requerido" });
    }

    const assembly = await findAssemblyById(assemblyId);
    if (!assembly || assembly.propertyId !== propertyId) {
      return sendJson(response, 404, { error: "Assembly not found" });
    }

    const result = await getMyVote(sessionId, accessToken, assemblyId);
    return sendJson(response, 200, result);
  }

  // POST …/voting-sessions/:sId/close — Cerrar votación (admin)
  if (
    method === "POST" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/voting-sessions\/[^/]+\/close$/.test(pathname)
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const segments   = pathname.split("/");
    const propertyId = segments[4];
    const assemblyId = segments[6];
    const sessionId  = segments[8];

    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 403, { error: "Forbidden" });
    }

    try {
      const session = await closeSession(sessionId, admin.id, propertyId);
      return sendJson(response, 200, { session });
    } catch (err) {
      const e = err as { statusCode?: number; message: string };
      return sendJson(response, e.statusCode ?? 500, { error: e.message });
    }
  }

  // POST …/voting-sessions/:sId/cancel — Cancelar sesión (admin)
  if (
    method === "POST" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/voting-sessions\/[^/]+\/cancel$/.test(pathname)
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const segments   = pathname.split("/");
    const propertyId = segments[4];
    const sessionId  = segments[8];

    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 403, { error: "Forbidden" });
    }

    try {
      await cancelSession(sessionId, admin.id, propertyId);
      return sendJson(response, 200, { success: true });
    } catch (err) {
      const e = err as { statusCode?: number; message: string };
      return sendJson(response, e.statusCode ?? 500, { error: e.message });
    }
  }

  // GET …/voting-sessions/:sId/votes — Votos individuales (admin, sin PII)
  if (
    method === "GET" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/voting-sessions\/[^/]+\/votes$/.test(pathname)
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const segments   = pathname.split("/");
    const propertyId = segments[4];
    const sessionId  = segments[8];

    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 403, { error: "Forbidden" });
    }

    try {
      const votes = await getSessionVotes(sessionId, propertyId);
      return sendJson(response, 200, { votes });
    } catch (err) {
      const e = err as { statusCode?: number; message: string };
      return sendJson(response, e.statusCode ?? 500, { error: e.message });
    }
  }

  // ─── Acceso público para asistentes ─────────────────────────────────────────

  /**
   * GET /api/v1/attendee-info?accessToken=<token>
   *
   * Endpoint PÚBLICO (sin autenticación de admin).
   * Dado un accessToken (de AssemblyAccessGrant o AssemblyRepresentation),
   * devuelve la información mínima que necesita el asistente para unirse:
   *   - propertyId, assemblyId, assemblyTitle, assemblyStatus
   *   - unitLabel (de la representación o del grant)
   *   - representativeFullName, representationType
   *
   * No expone datos sensibles. El token es el único secreto.
   */
  if (
    method === "GET" &&
    pathname === "/api/v1/attendee-info"
  ) {
    const accessToken = url.searchParams.get("accessToken") ?? "";
    if (!accessToken) {
      return sendJson(response, 400, { error: "accessToken es requerido" });
    }

    // Buscar primero en AssemblyRepresentation
    const rep = await prisma.assemblyRepresentation.findFirst({
      where: { accessToken, status: "active" },
      include: {
        assembly: {
          select: {
            id: true, propertyId: true, status: true,
            title: true, scheduledAt: true,
          }
        },
        representedUnit: {
          select: { id: true, groupingKind: true, groupingLabel: true, unitNumber: true }
        }
      },
      orderBy: { createdAt: "asc" },
    });

    if (rep) {
      return sendJson(response, 200, {
        mode: "representation",
        propertyId:              rep.assembly.propertyId,
        assemblyId:              rep.assembly.id,
        assemblyTitle:           rep.assembly.title ?? "Asamblea",
        assemblyStatus:          rep.assembly.status,
        unitId:                  rep.representedUnit.id,
        unitLabel:               `${rep.representedUnit.groupingKind} ${rep.representedUnit.groupingLabel} - ${rep.representedUnit.unitNumber}`,
        representativeFullName:  rep.representativeFullName,
        representationType:      rep.representationType,
      });
    }

    // Fallback: buscar en AssemblyAccessGrant (legacy)
    const grant = await prisma.assemblyAccessGrant.findFirst({
      where: { accessToken },
      include: {
        assembly: {
          select: {
            id: true, propertyId: true, status: true,
            title: true, scheduledAt: true,
          }
        },
      }
    });

    if (grant) {
      const assembly = grant.assembly;
      // Cargar datos de unidad por separado (no hay relación directa en el grant)
      const unit = await prisma.unit.findUnique({
        where: { id: grant.unitId },
        select: { id: true, groupingKind: true, groupingLabel: true, unitNumber: true }
      });
      return sendJson(response, 200, {
        mode: "grant",
        propertyId:     assembly.propertyId,
        assemblyId:     assembly.id,
        assemblyTitle:  assembly.title ?? "Asamblea",
        assemblyStatus: assembly.status,
        unitId:         grant.unitId,
        unitLabel:      unit
          ? `${unit.groupingKind} ${unit.groupingLabel} - ${unit.unitNumber}`
          : `Unidad ${grant.unitId}`,
        representativeFullName: null,
        representationType:     "owner",
      });
    }

    return sendJson(response, 404, { error: "Token de acceso no encontrado o inválido." });
  }

  // ─── Representaciones ────────────────────────────────────────────────────────

  // POST …/representations/seed — Auto-generar representaciones de propietarios/apoderados
  if (
    method === "POST" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/representations\/seed$/.test(pathname)
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const segments   = pathname.split("/");
    const propertyId = segments[4];
    const assemblyId = segments[6];

    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 403, { error: "Forbidden" });
    }

    try {
      const result = await seedRepresentationsForAssembly(assemblyId, propertyId, admin.id);
      return sendJson(response, 200, result);
    } catch (err) {
      const e = err as { statusCode?: number; message: string };
      return sendJson(response, e.statusCode ?? 500, { error: e.message });
    }
  }

  // POST …/representations — Crear representación de apoderado manual
  if (
    method === "POST" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/representations$/.test(pathname)
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const segments   = pathname.split("/");
    const propertyId = segments[4];
    const assemblyId = segments[6];

    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 403, { error: "Forbidden" });
    }

    const body = (await readJson(request)) as CreateProxyRepresentationInput;
    if (!body.representedUnitId?.trim()) {
      return sendJson(response, 400, { error: "representedUnitId es requerido" });
    }
    if (!body.representativeFullName?.trim()) {
      return sendJson(response, 400, { error: "representativeFullName es requerido" });
    }

    try {
      const rep = await createProxyRepresentation(assemblyId, propertyId, body, admin.id);
      return sendJson(response, 201, { representation: rep });
    } catch (err) {
      const e = err as { statusCode?: number; message: string };
      return sendJson(response, e.statusCode ?? 500, { error: e.message });
    }
  }

  // GET …/representations — Listar representaciones (admin)
  if (
    method === "GET" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/representations$/.test(pathname)
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const segments   = pathname.split("/");
    const propertyId = segments[4];
    const assemblyId = segments[6];

    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 403, { error: "Forbidden" });
    }

    try {
      const representations = await listAssemblyRepresentations(assemblyId, propertyId);
      return sendJson(response, 200, { representations });
    } catch (err) {
      const e = err as { statusCode?: number; message: string };
      return sendJson(response, e.statusCode ?? 500, { error: e.message });
    }
  }

  // PATCH …/representations/:rId/revoke — Revocar representación (admin)
  if (
    method === "PATCH" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/representations\/[^/]+\/revoke$/.test(pathname)
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const segments   = pathname.split("/");
    const propertyId = segments[4];
    const assemblyId = segments[6];
    const rId        = segments[8];

    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 403, { error: "Forbidden" });
    }

    try {
      await revokeRepresentation(rId, assemblyId, propertyId, admin.id);
      return sendJson(response, 200, { ok: true });
    } catch (err) {
      const e = err as { statusCode?: number; message: string };
      return sendJson(response, e.statusCode ?? 500, { error: e.message });
    }
  }

  // PATCH …/representations/:rId/reactivate — Reactivar representación (admin)
  if (
    method === "PATCH" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/representations\/[^/]+\/reactivate$/.test(pathname)
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const segments   = pathname.split("/");
    const propertyId = segments[4];
    const assemblyId = segments[6];
    const rId        = segments[8];

    const property = await findPropertyById(propertyId);
    if (!property || property.adminId !== admin.id) {
      return sendJson(response, 403, { error: "Forbidden" });
    }

    try {
      await reactivateRepresentation(rId, assemblyId, propertyId, admin.id);
      return sendJson(response, 200, { ok: true });
    } catch (err) {
      const e = err as { statusCode?: number; message: string };
      return sendJson(response, e.statusCode ?? 500, { error: e.message });
    }
  }

  // GET …/voting-sessions/:sId/my-eligibility?accessToken= — Elegibilidad multi-unidad
  if (
    method === "GET" &&
    /^\/api\/v1\/properties\/[^/]+\/assemblies\/[^/]+\/voting-sessions\/[^/]+\/my-eligibility$/.test(pathname)
  ) {
    const segments    = pathname.split("/");
    const assemblyId  = segments[6];
    const sessionId   = segments[8];
    const accessToken = url.searchParams.get("accessToken") ?? "";

    if (!accessToken) {
      return sendJson(response, 400, { error: "accessToken es requerido" });
    }

    try {
      const eligibility = await getRepresentedUnitsWithVoteStatus(accessToken, assemblyId, sessionId);
      return sendJson(response, 200, { eligibility });
    } catch (err) {
      const e = err as { statusCode?: number; message: string };
      return sendJson(response, e.statusCode ?? 500, { error: e.message });
    }
  }

  return sendJson(response, 404, {
    error: "Route not found",
    method,
    pathname
  });
}
