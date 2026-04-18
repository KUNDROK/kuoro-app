import type {
  AdminAssistantChatRequest,
  AdminAssistantChatResponse,
  AdminLoginInput,
  AdminRegistrationInput,
  ConferenceTokenResponse,
  SpeakerRequestInput,
  SpeakerApproveInput,
  SpeakerQueueEntry,
  AgendaItemInput,
  AgendaItemSummary,
  AssemblyAccessConfigInput,
  AssemblyAccessConfigSummary,
  AssemblyAccessGrantInput,
  AssemblyAccessGrantSummary,
  AssemblyDocumentInput,
  AssemblyDocumentSummary,
  AssemblyConfigInput,
  AssemblyInvitationDeliverySummary,
  AssemblyInvitationRecipientSummary,
  AssemblyOverview,
  AssemblyReadinessSummary,
  AssemblySummary,
  AssemblyVoteResultInput,
  AssemblyVoteResultSummary,
  AuthResponse,
  PendingProxyRequestSummary,
  PropertyCreateInput,
  PropertySummary,
  ProxyRequestPublicSummary,
  UnitCreateInput,
  UnitSummary,
  OpenVotingSessionInput,
  CastVoteInput,
  VotingSessionSummary,
  VotingSessionAttendeeView,
  CastVoteResponse,
  VoteValue,
  VoteSummary,
  AssemblyRepresentationSummary,
  CreateProxyRepresentationInput,
  SeedRepresentationsResult,
  VotingEligibilitySummary,
} from "@kuoro/contracts";

import { cacheGet, cacheSet, cacheIsStale, cacheInvalidate, cacheClear } from "./cache";

const DEFAULT_API_PREFIX = "/api/v1";

/** Origen del API: relativo en dev (proxy Vite) o absoluto en staging (Vercel → Railway). */
function getApiRequestPrefix(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!raw) return DEFAULT_API_PREFIX;
  return raw.replace(/\/$/, "");
}

const API_PREFIX = getApiRequestPrefix();
const TOKEN_KEY = "ph_admin_token";

export function getStoredToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  cacheClear();
  window.localStorage.removeItem(TOKEN_KEY);
}

async function fetchRaw<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  let response: Response;

  try {
    response = await fetch(`${API_PREFIX}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {})
      }
    });
  } catch {
    throw new Error("No fue posible conectar con la API del proyecto");
  }

  const raw = await response.text();
  const payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};

  if (!response.ok) {
    throw new Error(String(payload.error ?? `HTTP ${response.status}`));
  }

  return payload as T;
}

/**
 * SWR-aware request:
 * - GET requests: returns cached data immediately if available, revalidates in background if stale
 * - Mutations (POST/PUT/DELETE): invalidate related cache entries
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const isRead = method === "GET";

  if (isRead) {
    const cached = cacheGet<T>(path);
    if (cached !== undefined) {
      // Return stale data immediately; revalidate in background if stale
      if (cacheIsStale(path)) {
        fetchRaw<T>(path, init).then((fresh) => cacheSet(path, fresh)).catch(() => {});
      }
      return cached;
    }
    // No cache — fetch and store
    const data = await fetchRaw<T>(path, init);
    cacheSet(path, data);
    return data;
  }

  // Mutation: execute then invalidate cache for the same resource prefix
  const data = await fetchRaw<T>(path, init);
  // Invalidate the base path (e.g. PUT /properties/123/units → invalidate "/properties/123")
  const segments = path.split("/");
  // Invalidate up to 2 levels deep to cover list + detail endpoints
  if (segments.length >= 4) cacheInvalidate(segments.slice(0, 4).join("/"));
  if (segments.length >= 3) cacheInvalidate(segments.slice(0, 3).join("/"));
  // Always invalidate /auth/me (totalUnits etc may change)
  cacheInvalidate("/auth/me");
  return data;
}

export async function registerAdmin(input: AdminRegistrationInput) {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function loginAdmin(input: AdminLoginInput) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function fetchMe() {
  return request<{
    admin: AuthResponse["admin"];
    properties: PropertySummary[];
  }>("/auth/me");
}

export async function postAdminAssistantChat(body: AdminAssistantChatRequest) {
  return fetchRaw<AdminAssistantChatResponse>("/admin-assistant/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createProperty(input: PropertyCreateInput) {
  return request<{ property: PropertySummary }>("/properties", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateProperty(propertyId: string, input: PropertyCreateInput) {
  return request<{ property: PropertySummary }>(`/properties/${propertyId}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function fetchUnits(propertyId: string) {
  return request<{ units: UnitSummary[] }>(`/properties/${propertyId}/units`);
}

export async function createUnits(propertyId: string, units: UnitCreateInput[]) {
  return request<{ units: UnitSummary[] }>(`/properties/${propertyId}/units`, {
    method: "POST",
    body: JSON.stringify({ units })
  });
}

export async function fetchUnit(propertyId: string, unitId: string) {
  return request<{ unit: UnitSummary }>(`/properties/${propertyId}/units/${unitId}`);
}

export async function updateUnit(propertyId: string, unitId: string, unit: UnitCreateInput) {
  return request<{ unit: UnitSummary }>(`/properties/${propertyId}/units/${unitId}`, {
    method: "PUT",
    body: JSON.stringify(unit)
  });
}

export async function deleteUnit(propertyId: string, unitId: string) {
  return request<{ success: boolean }>(`/properties/${propertyId}/units/${unitId}`, {
    method: "DELETE"
  });
}

export async function fetchPendingProxyRequests(propertyId: string) {
  return request<{ requests: PendingProxyRequestSummary[] }>(`/properties/${propertyId}/proxy-requests`);
}

export async function listAssemblies(propertyId: string) {
  return request<{ assemblies: AssemblySummary[] }>(`/properties/${propertyId}/assemblies`);
}

export async function createNewAssembly(propertyId: string, input: AssemblyConfigInput) {
  return request<{ assembly: AssemblySummary }>(`/properties/${propertyId}/assemblies`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function listVoteResults(propertyId: string) {
  return request<{ results: AssemblyVoteResultSummary[] }>(`/properties/${propertyId}/assembly-votes`);
}

export async function listAssemblyVoteResults(propertyId: string, assemblyId: string) {
  return request<{ results: AssemblyVoteResultSummary[] }>(
    `/properties/${propertyId}/assemblies/${assemblyId}/votes`
  );
}

export async function saveVoteResult(propertyId: string, input: AssemblyVoteResultInput) {
  return request<{ result: AssemblyVoteResultSummary }>(`/properties/${propertyId}/assembly-votes`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function fetchAssemblyReadiness(propertyId: string) {
  return request<{ readiness: AssemblyReadinessSummary }>(`/properties/${propertyId}/assembly-readiness`);
}

export async function fetchAssembly(propertyId: string, assemblyId: string) {
  return request<{ assembly: AssemblyOverview }>(`/properties/${propertyId}/assemblies/${assemblyId}`);
}

export async function fetchAssemblySettings(propertyId: string) {
  return request<{ assembly: AssemblySummary | null }>(`/properties/${propertyId}/assembly-settings`);
}

export async function saveAssemblySettings(propertyId: string, input: AssemblyConfigInput) {
  return request<{ assembly: AssemblySummary }>(`/properties/${propertyId}/assembly-settings`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function fetchAssemblyAgenda(propertyId: string) {
  return request<{ agenda: AgendaItemSummary[] }>(`/properties/${propertyId}/assembly-agenda`);
}

export async function saveAssemblyAgenda(propertyId: string, agenda: AgendaItemInput[]) {
  return request<{ agenda: AgendaItemSummary[] }>(`/properties/${propertyId}/assembly-agenda`, {
    method: "PUT",
    body: JSON.stringify({ agenda })
  });
}

export async function fetchAssemblyDocuments(propertyId: string) {
  return request<{ documents: AssemblyDocumentSummary[] }>(`/properties/${propertyId}/assembly-documents`);
}

export async function saveAssemblyDocuments(propertyId: string, documents: AssemblyDocumentInput[]) {
  return request<{ documents: AssemblyDocumentSummary[] }>(`/properties/${propertyId}/assembly-documents`, {
    method: "PUT",
    body: JSON.stringify({ documents })
  });
}

export async function fetchAssemblyInvitations(propertyId: string, assemblyId?: string) {
  const qs = assemblyId ? `?assemblyId=${encodeURIComponent(assemblyId)}` : "";
  return request<{
    recipients: AssemblyInvitationRecipientSummary[];
    deliveries: AssemblyInvitationDeliverySummary[];
  }>(`/properties/${propertyId}/assembly-invitations${qs}`);
}

export async function saveAssemblyInvitations(
  propertyId: string,
  deliveries: AssemblyInvitationDeliverySummary[],
  assemblyId?: string
) {
  const qs = assemblyId ? `?assemblyId=${encodeURIComponent(assemblyId)}` : "";
  return request<{ deliveries: AssemblyInvitationDeliverySummary[] }>(`/properties/${propertyId}/assembly-invitations${qs}`, {
    method: "PUT",
    body: JSON.stringify({ deliveries })
  });
}

export type SendAssemblyInvitationsEmailResponse = {
  deliveries: AssemblyInvitationDeliverySummary[];
  results: Array<{ unitId: string; ok: boolean; skipped?: string; error?: string }>;
};

export async function sendAssemblyInvitationsEmail(
  propertyId: string,
  body: { assemblyId: string; scope: "all_ready" | "unit"; unitId?: string }
) {
  return request<SendAssemblyInvitationsEmailResponse>(`/properties/${propertyId}/assembly-invitations/send`, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export async function fetchAssemblyAccess(propertyId: string) {
  return request<{
    config: AssemblyAccessConfigSummary | null;
    grants: AssemblyAccessGrantSummary[];
  }>(`/properties/${propertyId}/assembly-access`);
}

export async function saveAssemblyAccess(
  propertyId: string,
  input: { config: AssemblyAccessConfigInput; grants: AssemblyAccessGrantInput[] }
) {
  return request<{
    config: AssemblyAccessConfigSummary;
    grants: AssemblyAccessGrantSummary[];
  }>(`/properties/${propertyId}/assembly-access`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function reviewProxyRequest(
  propertyId: string,
  ownerId: string,
  input: { decision: "approved" | "rejected"; reasons?: string[]; note?: string }
) {
  return request<{ success: boolean }>(`/properties/${propertyId}/proxy-requests/${ownerId}/review`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function fetchPublicProxyRequest(token: string) {
  return request<{ request: ProxyRequestPublicSummary }>(`/proxy-requests/${token}`);
}

export type CommunicationSettingsDTO = {
  id: string;
  propertyId: string;
  countryCode: string;
  locale: string;
  enabledChannels: ("email" | "sms" | "whatsapp")[];
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  defaultChannelsByUseCase: Record<string, string>;
  fallbackChannel: string | null;
  senderDisplayName: string | null;
  senderEmailFrom: string | null;
  senderSmsFrom: string | null;
  senderWhatsappFrom: string | null;
  providerBindings: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

export async function fetchCommunicationSettings(propertyId: string) {
  return request<{ settings: CommunicationSettingsDTO }>(`/properties/${propertyId}/communication-settings`);
}

export async function saveCommunicationSettings(
  propertyId: string,
  input: Partial<{
    countryCode: string;
    locale: string;
    enabledChannels: ("email" | "sms" | "whatsapp")[];
    emailEnabled: boolean;
    smsEnabled: boolean;
    whatsappEnabled: boolean;
    defaultChannelsByUseCase: Record<string, string>;
    fallbackChannel: string | null;
    senderDisplayName: string | null;
    senderEmailFrom: string | null;
    senderSmsFrom: string | null;
    senderWhatsappFrom: string | null;
    providerBindings: Record<string, string>;
  }>
) {
  return request<{ settings: CommunicationSettingsDTO }>(`/properties/${propertyId}/communication-settings`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function fetchCommunicationCampaigns(propertyId: string) {
  return request<{ campaigns: Array<Record<string, unknown>> }>(
    `/properties/${propertyId}/communication-campaigns`
  );
}

export async function createCommunicationCampaign(
  propertyId: string,
  input: {
    name: string;
    purpose: "convocatoria" | "reminder" | "document_request" | "ad_hoc" | "custom";
    primaryChannels: ("email" | "sms" | "whatsapp")[];
    assemblyId?: string | null;
    audience?: "all" | "segment" | "single";
    fallbackChannel?: string | null;
  }
) {
  return request<{ campaign: { id: string; name: string; purpose: string; status: string } }>(
    `/properties/${propertyId}/communication-campaigns`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export async function dispatchCommunicationCampaign(
  propertyId: string,
  campaignId: string,
  input: {
    channel: "email" | "sms" | "whatsapp";
    testRecipient: string;
    subject?: string;
    body?: string;
  }
) {
  return request<{ delivery: unknown; sendResult: unknown }>(
    `/properties/${propertyId}/communication-campaigns/${campaignId}/dispatch`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export async function fetchPropertyDocumentRequests(propertyId: string) {
  return request<{
    documentRequests: Array<{
      id: string;
      kind: string;
      status: string;
      publicToken: string;
      ownerName: string;
      unitLabel: string | null;
      submissionsCount: number;
      reviewsCount: number;
    }>;
  }>(`/properties/${propertyId}/document-requests`);
}

export async function fetchCommunicationDeliveries(propertyId: string, limit?: number) {
  const q = limit ? `?limit=${limit}` : "";
  return request<{ deliveries: unknown[] }>(`/properties/${propertyId}/communication-deliveries${q}`);
}

export async function fetchCommunicationTemplates(propertyId: string) {
  return request<{ templates: Array<Record<string, unknown>> }>(`/properties/${propertyId}/communication-templates`);
}

export async function upsertCommunicationTemplate(
  propertyId: string,
  input: {
    templateKey: string;
    channel: string;
    name: string;
    subjectTemplate?: string;
    bodyTemplate: string;
    isActive?: boolean;
  }
) {
  return request<{ template: unknown }>(`/properties/${propertyId}/communication-templates`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function deleteCommunicationTemplate(propertyId: string, templateId: string) {
  return request<{ ok: boolean }>(`/properties/${propertyId}/communication-templates/${templateId}`, {
    method: "DELETE"
  });
}

export async function fetchPublicDocumentRequest(token: string) {
  return fetchRaw<{
    documentRequest: {
      id: string;
      kind: string;
      status: string;
      title: string | null;
      instructions: string | null;
      publicToken: string;
      createdAt: string;
      updatedAt: string;
    };
    property: { id: string; name: string; city: string };
    owner: { fullName: string; participationRole: string };
    unitLabel: string | null;
    submissions: Array<{ id: string; fileName: string; submittedAt: string }>;
    reviews: Array<{ id: string; action: string; reasons: string[]; createdAt: string }>;
    legacyProxyStatus: {
      proxyApprovalStatus: string;
      proxyRejectionReasons: string[];
      proxyRejectionNote: string | null;
    } | null;
  }>(`/public/document-requests/${token}`);
}

export async function postCommunicationWebhook(
  provider: string,
  payload: { event: string; providerMessageId?: string; trackingToken?: string }
) {
  return fetchRaw<{ ok: boolean }>(`/integrations/communications/webhooks/${provider}`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

// ─── Conference / LiveKit ─────────────────────────────────────────────────────

export async function fetchConferenceToken(
  propertyId: string,
  assemblyId: string,
): Promise<ConferenceTokenResponse & { livekitUrl: string }> {
  return fetchRaw(`/properties/${propertyId}/assemblies/${assemblyId}/conference/token`, {
    method: "POST",
  });
}

export async function fetchAttendeeToken(
  propertyId: string,
  assemblyId: string,
  participantIdentity: string,
  displayName: string,
): Promise<ConferenceTokenResponse & { livekitUrl: string; restoredSpeakerEntry?: unknown }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/conference/attendee-token`,
    {
      method: "POST",
      body: JSON.stringify({ participantIdentity, displayName }),
    },
  );
}

export async function putLiveSlide(
  propertyId: string,
  assemblyId: string,
  slide: Record<string, unknown>,
): Promise<void> {
  await fetchRaw(`/properties/${propertyId}/assemblies/${assemblyId}/conference/live-slide`, {
    method: "PUT",
    body: JSON.stringify(slide),
  });
}

export async function getLiveSlide(
  propertyId: string,
  assemblyId: string,
): Promise<{ slide: Record<string, unknown> | null }> {
  return fetchRaw(`/properties/${propertyId}/assemblies/${assemblyId}/conference/live-slide`);
}

export async function fetchSpeakerQueue(
  propertyId: string,
  assemblyId: string,
): Promise<{ queue: SpeakerQueueEntry[] }> {
  return fetchRaw(`/properties/${propertyId}/assemblies/${assemblyId}/conference/queue`);
}

/** Estado del participante en la cola (para reconexión / polling del asistente). */
export async function fetchParticipantState(
  propertyId: string,
  assemblyId: string,
  identity: string,
): Promise<{ entry: SpeakerQueueEntry | null }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/conference/queue/my-state?identity=${encodeURIComponent(identity)}`,
  );
}

export async function requestSpeakerTurn(
  propertyId: string,
  assemblyId: string,
  input: SpeakerRequestInput,
): Promise<{ entry: SpeakerQueueEntry }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/conference/queue`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function approveSpeakerTurn(
  propertyId: string,
  assemblyId: string,
  entryId: string,
  input: SpeakerApproveInput,
): Promise<{ entry: SpeakerQueueEntry }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/conference/queue/${entryId}/approve`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function rejectSpeakerTurn(
  propertyId: string,
  assemblyId: string,
  entryId: string,
): Promise<{ entry: SpeakerQueueEntry }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/conference/queue/${entryId}/reject`,
    { method: "POST" },
  );
}

export async function finishSpeakerTurn(
  propertyId: string,
  assemblyId: string,
  entryId: string,
): Promise<{ entry: SpeakerQueueEntry }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/conference/queue/${entryId}/finish`,
    { method: "POST" },
  );
}

export async function clearConferenceQueue(
  propertyId: string,
  assemblyId: string,
): Promise<{ success: boolean }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/conference/queue`,
    { method: "DELETE" },
  );
}

/** Cierra la sala: revoca permisos del speaker, cancela cola y marca asamblea como closed. */
export async function closeConferenceRoom(
  propertyId: string,
  assemblyId: string,
): Promise<{ success: boolean; cancelledEntries: number }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/conference/close`,
    { method: "POST" },
  );
}

/** Notifica que el admin salió temporalmente (sin cerrar la sala). */
export async function notifyAdminLeft(
  propertyId: string,
  assemblyId: string,
): Promise<{ success: boolean }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/conference/admin-left`,
    { method: "POST" },
  );
}

/** Estado actual de la sala: assembly status, speaker activo, etc. */
export async function fetchRoomStatus(
  propertyId: string,
  assemblyId: string,
): Promise<{
  assemblyStatus:   string;
  hasActiveSpeaker: boolean;
  currentSpeaker:   import("@kuoro/contracts").SpeakerQueueEntry | null;
}> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/conference/room-status`,
  );
}

// ─── Votación digital ─────────────────────────────────────────────────────────

/** Abre una nueva sesión de votación (admin). */
export async function openVotingSession(
  propertyId: string,
  assemblyId: string,
  input: OpenVotingSessionInput,
): Promise<{ session: VotingSessionSummary }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/voting-sessions`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

/** Lista todas las sesiones de votación de una asamblea (admin). */
export async function listVotingSessions(
  propertyId: string,
  assemblyId: string,
): Promise<{ sessions: VotingSessionSummary[] }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/voting-sessions`,
  );
}

/** Devuelve la sesión activa actualmente, o null. */
export async function fetchActiveVotingSession(
  propertyId: string,
  assemblyId: string,
): Promise<{ session: VotingSessionSummary | null }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/voting-sessions/active`,
  );
}

/** Emite un voto (asistente, vía accessToken). */
export async function castVote(
  propertyId: string,
  assemblyId: string,
  sessionId: string,
  input: CastVoteInput,
): Promise<CastVoteResponse> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/voting-sessions/${sessionId}/vote`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

/** Vista del asistente para una sesión: pregunta, elegibilidad, mi voto. */
export async function fetchAttendeeVotingView(
  propertyId: string,
  assemblyId: string,
  sessionId: string,
  accessToken: string,
): Promise<{ view: VotingSessionAttendeeView }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/voting-sessions/${sessionId}/attendee-view?accessToken=${encodeURIComponent(accessToken)}`,
  );
}

/** Mi voto en una sesión (asistente). */
export async function fetchMyVote(
  propertyId: string,
  assemblyId: string,
  sessionId: string,
  accessToken: string,
): Promise<{ voteValue: VoteValue | null; unitId: string | null }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/voting-sessions/${sessionId}/my-vote?accessToken=${encodeURIComponent(accessToken)}`,
  );
}

/** Cierra una sesión de votación y calcula el resultado (admin). */
export async function closeVotingSession(
  propertyId: string,
  assemblyId: string,
  sessionId: string,
): Promise<{ session: VotingSessionSummary }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/voting-sessions/${sessionId}/close`,
    { method: "POST" },
  );
}

/** Cancela una sesión sin calcular resultado (admin). */
export async function cancelVotingSession(
  propertyId: string,
  assemblyId: string,
  sessionId: string,
): Promise<{ success: boolean }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/voting-sessions/${sessionId}/cancel`,
    { method: "POST" },
  );
}

/** Votos individuales de una sesión (admin, sin PII). */
export async function fetchSessionVotes(
  propertyId: string,
  assemblyId: string,
  sessionId: string,
): Promise<{ votes: VoteSummary[] }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/voting-sessions/${sessionId}/votes`,
  );
}

// ─── Info pública del asistente ───────────────────────────────────────────────

export type AttendeeInfo = {
  mode: "representation" | "grant";
  propertyId: string;
  assemblyId: string;
  assemblyTitle: string;
  assemblyStatus: string;
  unitId: string;
  unitLabel: string;
  representativeFullName: string | null;
  representationType: string;
};

/**
 * Endpoint público: dado un accessToken, devuelve la información de la asamblea
 * y del representante sin requerir autenticación admin.
 */
export async function fetchAttendeeInfo(accessToken: string): Promise<AttendeeInfo> {
  return fetchRaw(`/attendee-info?accessToken=${encodeURIComponent(accessToken)}`);
}

// ─── API de representaciones ──────────────────────────────────────────────────

/** Auto-genera representaciones a partir de propietarios/apoderados existentes. */
export async function seedRepresentations(
  propertyId: string,
  assemblyId: string,
): Promise<SeedRepresentationsResult> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/representations/seed`,
    { method: "POST" },
  );
}

/** Crea una representación de apoderado manualmente. */
export async function createRepresentation(
  propertyId: string,
  assemblyId: string,
  input: CreateProxyRepresentationInput,
): Promise<{ representation: AssemblyRepresentationSummary }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/representations`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

/** Lista todas las representaciones de una asamblea (admin). */
export async function fetchRepresentations(
  propertyId: string,
  assemblyId: string,
): Promise<{ representations: AssemblyRepresentationSummary[] }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/representations`,
  );
}

/** Revoca una representación. */
export async function revokeRepresentation(
  propertyId:       string,
  assemblyId:       string,
  representationId: string,
): Promise<{ ok: boolean }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/representations/${representationId}/revoke`,
    { method: "PATCH" },
  );
}

/** Reactiva una representación revocada. */
export async function reactivateRepresentation(
  propertyId:       string,
  assemblyId:       string,
  representationId: string,
): Promise<{ ok: boolean }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/representations/${representationId}/reactivate`,
    { method: "PATCH" },
  );
}

/** Elegibilidad de votación multi-unidad para el asistente. */
export async function fetchMyEligibility(
  propertyId:  string,
  assemblyId:  string,
  sessionId:   string,
  accessToken: string,
): Promise<{ eligibility: VotingEligibilitySummary }> {
  return fetchRaw(
    `/properties/${propertyId}/assemblies/${assemblyId}/voting-sessions/${sessionId}/my-eligibility?accessToken=${encodeURIComponent(accessToken)}`,
  );
}

export async function submitPublicProxyRequest(
  token: string,
  input: {
    senderName: string;
    senderEmail?: string;
    senderRole: "propietario" | "copropietario" | "apoderado" | "otro";
    proxyDocumentName: string;
    proxyDocumentMimeType?: string;
    proxyDocumentData: string;
  }
) {
  return request<{ success: boolean }>(`/proxy-requests/${token}`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}
