export type AssemblyStatus =
  | "draft"
  | "scheduled"
  | "invitation_sent"
  | "in_progress"
  | "closed"
  | "archived";

export type AgendaStatus = "pending" | "active" | "completed";

export type AssemblyType =
  | "ordinaria"
  | "extraordinaria"
  | "segunda_convocatoria"
  | "derecho_propio"
  | "no_presencial"
  | "mixta"
  | "comunicacion_escrita";

export type AssemblyModality = "presencial" | "virtual" | "mixta";

export type AssemblyVotingBasis = "coeficientes" | "modulos" | "unidad";
export type AssemblyConferenceService =
  | "ninguno"
  | "kuoro_live"
  | "enlace_externo"
  | "zoom"
  | "google_meet"
  | "microsoft_teams"
  | "jitsi"
  | "servicio_propio"
  | "por_definir";

export type AdminRegistrationInput = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
};

export type AdminLoginInput = {
  email: string;
  password: string;
};

export type PropertyLegalType = "residencial" | "comercial" | "mixto";

export type PropertyOperationalStatus = "active" | "inactive_payment" | "suspended" | "pending_setup";

export type PropertyDevelopmentShape =
  | "edificio"
  | "conjunto"
  | "conjunto_por_etapas";

export type PropertyBuildingSubtype =
  | "edificio_apartamentos"
  | "edificio_oficinas"
  | "torre_empresarial"
  | "edificio_consultorios"
  | "centro_medico"
  | "edificio_locales"
  | "centro_comercial"
  | "plazoleta_comercial"
  | "edificio_bodegas"
  | "parque_empresarial"
  | "parque_industrial"
  | "edificio_apartamentos_con_locales"
  | "edificio_apartamentos_con_oficinas"
  | "edificio_mixto_comercial"
  | "edificio_mixto_integrado"
  | "otro";

export type PropertyStructureMode =
  | "torres_apartamentos"
  | "bloques_apartamentos"
  | "manzanas_casas"
  | "casas_y_torres"
  | "locales"
  | "oficinas"
  | "consultorios"
  | "bodegas"
  | "mixto_sectorizado"
  | "personalizado";

export type PrivateUnitType =
  | "apartamento"
  | "casa"
  | "local"
  | "oficina"
  | "consultorio"
  | "bodega"
  | "parqueadero"
  | "deposito"
  | "otro";

export type PropertyCompositionInput = {
  label: string;
  unitType: PrivateUnitType;
  count: number;
  groupingType: string;
  identifierPattern: string;
  sectorName?: string;
};

export type PropertyCreateInput = {
  name: string;
  city: string;
  address: string;
  nit?: string;
  legalType: PropertyLegalType;
  developmentShape: PropertyDevelopmentShape;
  buildingSubtype?: PropertyBuildingSubtype;
  structureModes: PropertyStructureMode[];
  privateUnitTypes: PrivateUnitType[];
  usesCoefficients: boolean;
  usesContributionModules: boolean;
  supportsProxies: boolean;
};

export type PropertySummary = {
  id: string;
  name: string;
  city: string;
  address?: string;
  nit?: string | null;
  totalUnits: number;
  legalType?: PropertyLegalType;
  developmentShape?: PropertyDevelopmentShape;
  buildingSubtype?: PropertyBuildingSubtype;
  structureModes?: PropertyStructureMode[];
  privateUnitTypes?: PrivateUnitType[];
  usesCoefficients?: boolean;
  usesContributionModules?: boolean;
  supportsProxies?: boolean;
  operationalStatus?: PropertyOperationalStatus;
};

export type UnitGroupingKind =
  | "torre"
  | "bloque"
  | "manzana"
  | "sector"
  | "modulo"
  | "ninguno";

export type DocumentType =
  | "rc"
  | "ti"
  | "cc"
  | "te"
  | "ce"
  | "nit"
  | "pasaporte"
  | "documento_extranjero"
  | "pep"
  | "ppt";

export type OwnerCreateInput = {
  fullName: string;
  documentType?: DocumentType;
  email?: string;
  phone?: string;
  document?: string;
  participationRole?: "propietario" | "copropietario" | "apoderado";
  canVote?: boolean;
  receivesInvitations?: boolean;
  proxyDocumentName?: string;
  proxyDocumentMimeType?: string;
  proxyDocumentData?: string;
  proxyApprovalStatus?: "not_required" | "awaiting_upload" | "pending_review" | "approved" | "rejected";
  proxyRequestToken?: string;
  proxyRequestedAt?: string;
  proxyLastSubmittedAt?: string;
  proxySubmittedByName?: string;
  proxySubmittedByEmail?: string;
  proxySubmittedByRole?: "propietario" | "copropietario" | "apoderado" | "otro";
  proxyRejectionReasons?: string[];
  proxyRejectionNote?: string;
};

export type OwnerSummary = OwnerCreateInput & {
  id: string;
  propertyId: string;
};

export type UnitOwnerInput = OwnerCreateInput & {
  id?: string;
  isPrimary?: boolean;
  ownershipPercentage?: number;
};

export type UnitOwnerSummary = OwnerSummary & {
  isPrimary: boolean;
  ownershipPercentage?: number;
};

export type PendingProxyRequestSummary = {
  ownerId: string;
  propertyId: string;
  unitId: string;
  unitLabel: string;
  ownerName: string;
  proxyApprovalStatus: "not_required" | "awaiting_upload" | "pending_review" | "approved" | "rejected";
  proxyDocumentName?: string;
  proxyDocumentMimeType?: string;
  proxyDocumentData?: string;
  proxyLastSubmittedAt?: string;
  proxySubmittedByName?: string;
  proxySubmittedByEmail?: string;
  proxySubmittedByRole?: "propietario" | "copropietario" | "apoderado" | "otro";
  proxyRejectionReasons?: string[];
  proxyRejectionNote?: string;
};

export type ProxyRequestPublicSummary = {
  token: string;
  propertyName: string;
  unitLabel: string;
  ownerName: string;
  proxyApprovalStatus: "not_required" | "awaiting_upload" | "pending_review" | "approved" | "rejected";
  proxyDocumentName?: string;
  proxyLastSubmittedAt?: string;
  proxyRejectionReasons?: string[];
  proxyRejectionNote?: string;
};

export type AssemblyUnitRepresentativeSummary = {
  ownerId: string;
  fullName: string;
  participationRole: "propietario" | "copropietario" | "apoderado";
  canVote: boolean;
  receivesInvitations: boolean;
  proxyApprovalStatus?: "not_required" | "awaiting_upload" | "pending_review" | "approved" | "rejected";
};

export type AssemblyConfigInput = {
  title: string;
  type: AssemblyType;
  modality: AssemblyModality;
  status: AssemblyStatus;
  scheduledAt: string;
  conferenceService: AssemblyConferenceService;
  location?: string;
  virtualAccessUrl?: string;
  notes?: string;
  votingBasis: AssemblyVotingBasis;
  allowsSecondCall: boolean;
  secondCallScheduledAt?: string;
};

export type AssemblySummary = AssemblyConfigInput & {
  id: string;
  propertyId: string;
  createdAt: string;
  updatedAt: string;
};

export type AgendaItemType = "informativo" | "deliberativo" | "votacion" | "eleccion";
export type AgendaVotingRule = "ninguna" | "simple" | "calificada_70" | "unanimidad";

export type AgendaItemInput = {
  title: string;
  description?: string;
  slideTitle?: string;
  slideContent?: string;
  speakerNotes?: string;
  votePrompt?: string;
  type: AgendaItemType;
  votingRule: AgendaVotingRule;
  requiresAttachment: boolean;
};

export type AgendaItemSummary = AgendaItemInput & {
  id: string;
  assemblyId: string;
  order: number;
  status: AgendaStatus;
};

export type AssemblyDocumentInput = {
  title: string;
  documentName: string;
  documentMimeType?: string;
  documentData: string;
  category: "convocatoria" | "informe" | "soporte" | "presupuesto" | "reglamento" | "otro";
  agendaItemId?: string;
};

export type AssemblyDocumentSummary = AssemblyDocumentInput & {
  id: string;
  assemblyId: string;
  createdAt: string;
};

export type AssemblyInvitationRecipientSummary = {
  unitId: string;
  unitLabel: string;
  unitType: PrivateUnitType;
  groupingKind: UnitGroupingKind;
  groupingLabelText: string;
  unitNumber: string;
  recipientName: string;
  recipientEmail?: string;
  recipientRole: "propietario" | "copropietario" | "apoderado";
  canVote: boolean;
  receivesInvitations: boolean;
  status: "ready" | "missing_contact" | "pending_proxy" | "no_recipient";
};

export type AssemblyInvitationDeliverySummary = {
  unitId: string;
  sentAt: string;
  channel: "email" | "manual" | "whatsapp" | "otro";
  status: "sent" | "pending" | "failed";
  note?: string;
};

export type AssemblyAccessConfigInput = {
  sessionAccessMode: "enlace_unico" | "codigo_y_documento" | "pre_registro_asistido";
  identityValidationMethod: "otp_email" | "otp_sms" | "validacion_manual" | "sin_otp";
  otpChannel: "email" | "sms" | "no_aplica";
  requireDocumentMatch: boolean;
  enableLobby: boolean;
  allowCompanions: boolean;
  oneActiveVoterPerUnit: boolean;
  fallbackManualValidation: boolean;
};

export type AssemblyAccessConfigSummary = AssemblyAccessConfigInput & {
  id: string;
  assemblyId: string;
  createdAt: string;
  updatedAt: string;
};

export type AssemblyAccessGrantInput = {
  unitId: string;
  deliveryChannel: "email" | "whatsapp" | "manual" | "pendiente";
  validationMethod: "otp_email" | "otp_sms" | "validacion_manual" | "sin_otp";
  preRegistrationStatus: "pending" | "confirmed" | "manual_review";
  dispatchStatus: "draft" | "ready_to_send" | "sent";
  note?: string;
};

export type AssemblyAccessGrantSummary = AssemblyAccessGrantInput & {
  unitLabel: string;
  unitType: PrivateUnitType;
  groupingKind: UnitGroupingKind;
  groupingLabelText: string;
  unitNumber: string;
  representativeName: string;
  representativeEmail?: string;
  representativePhone?: string;
  representativeRole?: "propietario" | "copropietario" | "apoderado";
  hasDocumentOnRecord: boolean;
  canVote: boolean;
  accessStatus: "ready" | "missing_contact" | "missing_document" | "pending_proxy" | "no_representative";
};

export type AssemblyUnitReadinessSummary = {
  unitId: string;
  unitLabel: string;
  unitType: PrivateUnitType;
  groupingKind: UnitGroupingKind;
  groupingLabelText: string;
  unitNumber: string;
  status: "owner_ready" | "proxy_approved" | "proxy_pending" | "no_voter";
  representatives: AssemblyUnitRepresentativeSummary[];
};

export type AssemblyReadinessSummary = {
  propertyId: string;
  propertyName: string;
  totalUnits: number;
  representedUnits: number;
  eligibleVoters: number;
  invitationRecipients: number;
  pendingProxyUnits: number;
  units: AssemblyUnitReadinessSummary[];
};

export type AssemblyOverview = {
  id: string;
  propertyId: string;
  propertyName: string;
  status: AssemblyStatus;
  quorum: number;
  attendees: number;
  totalUnitsRepresented: number;
  eligibleVoters: number;
  invitationRecipients: number;
  pendingProxyUnits: number;
  units: AssemblyUnitReadinessSummary[];
  agenda: Array<{
    id: string;
    title: string;
    description?: string;
    slideTitle?: string;
    slideContent?: string;
    speakerNotes?: string;
    votePrompt?: string;
    type: AgendaItemType;
    votingRule: AgendaVotingRule;
    requiresAttachment: boolean;
    order: number;
    status: AgendaStatus;
  }>;
  currentVote: LiveVoteResult[];
};

export type UnitCreateInput = {
  unitType: PrivateUnitType;
  groupingKind: UnitGroupingKind;
  groupingLabel: string;
  unitNumber: string;
  floor?: string;
  destination: string;
  privateArea?: number;
  coefficient?: number;
  contributionModule?: number;
  owners: UnitOwnerInput[];
};

export type UnitSummary = Omit<UnitCreateInput, "owners"> & {
  id: string;
  propertyId: string;
  owners: UnitOwnerSummary[];
  primaryOwner: UnitOwnerSummary | null;
};

export type AssemblyDashboardSummary = {
  propertyName: string;
  status: AssemblyStatus;
  attendees: number;
  totalUnitsRepresented: number;
  quorumPercentage: number;
  activePoint: string;
};

export type LiveVoteResult = {
  option: string;
  count: number;
  percentage: number;
};

export type AssemblyVotingRule = "simple" | "dos_tercios" | "unanimidad" | "ninguna";

export type AssemblyVoteResultInput = {
  agendaItemId?: string;
  question: string;
  votingRule: AssemblyVotingRule;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  blankVotes: number;
  totalCoefficient: number;
};

export type AssemblyVoteResultSummary = AssemblyVoteResultInput & {
  id: string;
  assemblyId: string;
  approved: boolean;
  closedAt: string;
  createdAt: string;
};

export type AuthResponse = {
  token: string;
  admin: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    emailVerified: boolean;
    createdAt: Date | string;
  };
};

// ─── LiveKit / Conference types ───────────────────────────────────────────────

/** Rol de conferencia para generar el token JWT de LiveKit. */
export type ConferenceRole = "admin" | "attendee" | "speaker";

/** Modalidad de intervención: solo audio o audio + vídeo. */
export type SpeakModalidad = "mic" | "mic_camera";

/** Duración permitida de una intervención en minutos. */
export type SpeakDuration = 1 | 3 | 5;

/** Estado de un participante en la cola de palabra. */
export type SpeakerQueueStatus =
  | "waiting"    // en espera de aprobación
  | "approved"   // aprobado, puede activar mic
  | "speaking"   // actualmente con la palabra (cronómetro activo)
  | "done"       // turno finalizado manualmente por el admin
  | "rejected"   // rechazado por el admin
  | "cancelled"  // cancelado por el propio participante
  | "expired";   // cronómetro agotado automáticamente

/** Conjunto de estados "activos" (el participante aún tiene acceso elevado). */
export const SPEAKER_ACTIVE_STATUSES: SpeakerQueueStatus[] = ["approved", "speaking"];

/** Conjunto de estados "terminales" (turno finalizado). */
export const SPEAKER_TERMINAL_STATUSES: SpeakerQueueStatus[] = ["done", "rejected", "cancelled", "expired"];

/** Entrada en la cola de palabra. */
export type SpeakerQueueEntry = {
  id: string;
  assemblyId: string;
  propertyId: string;
  roomName: string;
  participantIdentity: string;
  displayName: string;
  status: SpeakerQueueStatus;
  modalidad?: SpeakModalidad;
  /** Duración en segundos (no minutos) para mayor precisión. */
  durationSeconds?: number;
  requestedAt: string;
  approvedAt?: string;
  speakingStartedAt?: string;
  speakingEndsAt?: string;
  finishedAt?: string;
  rejectedAt?: string;
  cancelledAt?: string;
  expiredAt?: string;
};

/** Payload para solicitar la palabra (frontend → backend). */
export type SpeakerRequestInput = {
  participantIdentity: string;
  displayName: string;
};

/** Payload para aprobar un turno (admin → backend). */
export type SpeakerApproveInput = {
  modalidad: SpeakModalidad;
  durationMinutes: SpeakDuration;
};

/** Respuesta del endpoint de token de LiveKit. */
export type ConferenceTokenResponse = {
  token: string;
  roomName: string;
  participantIdentity: string;
};

/** Estado de la conferencia que el frontend mantiene en tiempo real. */
export type ConferenceRoomState = {
  roomName: string;
  isLive: boolean;
  currentSpeaker: SpeakerQueueEntry | null;
  queue: SpeakerQueueEntry[];
};

// ─── Votación digital en tiempo real ─────────────────────────────────────────

/** Opción de voto emitido por un participante. */
export type VoteValue = "yes" | "no" | "abstain" | "blank";

/** Estado del ciclo de vida de una sesión de votación. */
export type VotingSessionStatus = "open" | "closed" | "cancelled";

/** Regla de aprobación (compatible con AssemblyVotingRule existente). */
export type VotingRule = "simple" | "dos_tercios" | "unanimidad";

/** Base de cómputo del peso del voto. */
export type VotingBasis = "coeficientes" | "modulos" | "unidad";

/**
 * Payload para abrir una sesión de votación (admin → backend).
 */
export type OpenVotingSessionInput = {
  question: string;
  votingRule: VotingRule;
  votingBasis: VotingBasis;
  agendaItemId?: string;
};

/**
 * Payload para emitir un voto (asistente → backend).
 * El accessToken identifica al representante (o, en modo legacy, al grant de unidad).
 * unitId es requerido cuando el token cubre múltiples unidades representadas.
 */
export type CastVoteInput = {
  accessToken: string;
  voteValue: VoteValue;
  /** Requerido cuando el token cubre múltiples unidades (modo representación). */
  unitId?: string;
  /** Identidad del participante en la conferencia (para auditoría). */
  participantIdentity?: string;
};

/**
 * Conteos parciales visibles durante una sesión abierta.
 * Devuelve conteos sin revelar quién votó qué.
 */
export type VotingLiveCounts = {
  totalVoted:   number;
  totalEligible: number;
  yesCount:     number;
  noCount:      number;
  abstainCount: number;
  blankCount:   number;
  yesWeight:    number;
  noWeight:     number;
  abstainWeight: number;
  totalWeight:  number;
};

/**
 * Resumen de una sesión de votación para la vista del administrador.
 */
export type VotingSessionSummary = {
  id:              string;
  assemblyId:      string;
  propertyId:      string;
  agendaItemId?:   string;
  question:        string;
  votingRule:      VotingRule;
  votingBasis:     VotingBasis;
  status:          VotingSessionStatus;
  openedAt:        string;
  closedAt?:       string;
  openedByAdminId: string;
  counts:          VotingLiveCounts;
  approved?:       boolean;
};

/**
 * Vista de la sesión para el asistente.
 * Incluye la pregunta, el estado de su propio voto y su elegibilidad.
 */
export type VotingSessionAttendeeView = {
  id:          string;
  assemblyId:  string;
  question:    string;
  votingRule:  VotingRule;
  status:      VotingSessionStatus;
  openedAt:    string;
  closedAt?:   string;
  /** Si la sesión ya cerró, se expone el resultado. */
  approved?:   boolean;
  counts?:     VotingLiveCounts;
  /** Estado del voto del asistente. */
  myVote?:     VoteValue;
  isEligible:  boolean;
  /** Razón por la que el asistente no es elegible (si aplica). */
  ineligibleReason?: "no_access_grant" | "no_can_vote" | "session_closed" | "already_voted";
};

/**
 * Resultado de un voto individual registrado.
 */
export type CastVoteResponse = {
  success:   boolean;
  voteValue: VoteValue;
  sessionId: string;
  unitId:    string;
};

/**
 * Resumen de voto individual (para auditoría, sin exponer identidad del votante).
 */
export type VoteSummary = {
  id:                 string;
  unitId:             string;
  voteValue:          VoteValue;
  weight:             number;
  castAt:             string;
  representationType?: string;
};

// ─── Representación de voto ────────────────────────────────────────────────────

/** Calidad en que actúa el representante. */
export type RepresentationType = "owner" | "proxy" | "authorized_representative";

/** Estado de ciclo de vida de una representación. */
export type RepresentationStatus = "active" | "revoked" | "pending_validation";

/**
 * Resumen de una representación para la vista del administrador.
 * Incluye el accessToken solo cuando lo solicita el admin.
 */
export type AssemblyRepresentationSummary = {
  id:                    string;
  assemblyId:            string;
  representedUnitId:     string;
  representedUnitLabel:  string;          // "Torre A - Apto 101"
  representativeFullName: string;
  representativeEmail?:  string;
  representativeOwnerId?: string;
  representationType:    RepresentationType;
  status:                RepresentationStatus;
  canVote:               boolean;
  weight:                number;
  votingBasis:           VotingBasis;
  proofDocumentRef?:     string;
  notes?:                string;
  accessToken:           string;          // credential token for this representative
};

/**
 * Estado de voto de una unidad representada dentro de una sesión activa.
 */
export type RepresentedUnitVoteStatus = {
  representationId:      string;
  representedUnitId:     string;
  representedUnitLabel:  string;
  representationType:    RepresentationType;
  canVote:               boolean;
  weight:                number;
  myVote?:               VoteValue;
  alreadyVoted:          boolean;
};

/**
 * Elegibilidad completa del representante en una sesión de votación.
 * Devuelve todas las unidades que representa con su estado de voto.
 */
export type VotingEligibilitySummary = {
  sessionId:      string;
  sessionStatus:  VotingSessionStatus;
  question:       string;
  votingRule:     VotingRule;
  units:          RepresentedUnitVoteStatus[];
};

/**
 * Payload para crear una representación de apoderado (admin → backend).
 */
export type CreateProxyRepresentationInput = {
  representedUnitId:       string;
  representativeFullName:  string;
  representativeEmail?:    string;
  representativeOwnerId?:  string;
  principalOwnerId?:       string;
  proofDocumentRef?:       string;
  notes?:                  string;
  /**
   * Si el representante ya fue creado con otro unitId, reutilizar su token
   * para que todas sus unidades queden bajo el mismo accessToken.
   */
  sharedAccessToken?:      string;
};

/**
 * Resultado de una operación de seed de representaciones.
 */
export type SeedRepresentationsResult = {
  created: number;
  skipped: number;
  errors:  { unitId: string; reason: string }[];
};

export * from "./communications";
