import "./bootstrap-env";
import { randomUUID } from "node:crypto";
import { syncProxyDocumentRequestFromOwner } from "./domain/documentRequests/proxySync";
import { prisma } from "./lib/prisma";

// ─── Legacy types (kept for routes.ts compatibility) ─────────────────────────

export type StoredAdmin = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  emailVerified: boolean;
  createdAt: string;
};

export type StoredSession = {
  id: string;
  adminId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
};

export type StoredProperty = {
  id: string;
  adminId: string;
  name: string;
  city: string;
  address: string;
  nit: string | null;
  legalType: "residencial" | "comercial" | "mixto";
  developmentShape: "edificio" | "conjunto" | "conjunto_por_etapas";
  buildingSubtype?:
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
  structureModes: Array<
    | "torres_apartamentos"
    | "bloques_apartamentos"
    | "manzanas_casas"
    | "casas_y_torres"
    | "locales"
    | "oficinas"
    | "consultorios"
    | "bodegas"
    | "mixto_sectorizado"
    | "personalizado"
  >;
  privateUnitTypes: string[];
  usesCoefficients: boolean;
  usesContributionModules: boolean;
  supportsProxies: boolean;
  operationalStatus?: "active" | "inactive_payment" | "suspended" | "pending_setup";
  totalUnits: number;
  createdAt: string;
};

export type StoredUnit = {
  id: string;
  propertyId: string;
  unitType: string;
  groupingKind: string;
  groupingLabel: string;
  unitNumber: string;
  floor?: string;
  destination: string;
  privateArea?: number;
  coefficient?: number;
  contributionModule?: number;
  createdAt: string;
};

export type StoredOwner = {
  id: string;
  propertyId: string;
  fullName: string;
  documentType?: string;
  email?: string;
  phone?: string;
  document?: string;
  participationRole: "propietario" | "copropietario" | "apoderado";
  canVote: boolean;
  receivesInvitations: boolean;
  proxyDocumentName?: string;
  proxyDocumentMimeType?: string;
  proxyDocumentData?: string;
  proxyApprovalStatus: "not_required" | "awaiting_upload" | "pending_review" | "approved" | "rejected";
  proxyRequestToken?: string;
  proxyRequestedAt?: string;
  proxyLastSubmittedAt?: string;
  proxySubmittedByName?: string;
  proxySubmittedByEmail?: string;
  proxySubmittedByRole?: "propietario" | "copropietario" | "apoderado" | "otro";
  proxyRejectionReasons?: string[];
  proxyRejectionNote?: string;
  createdAt: string;
};

export type StoredUnitOwner = {
  id: string;
  unitId: string;
  ownerId: string;
  isPrimary: boolean;
  ownershipPercentage?: number;
  createdAt: string;
};

export type StoredAssembly = {
  id: string;
  propertyId: string;
  title: string;
  type:
    | "ordinaria"
    | "extraordinaria"
    | "segunda_convocatoria"
    | "derecho_propio"
    | "no_presencial"
    | "mixta"
    | "comunicacion_escrita";
  modality: "presencial" | "virtual" | "mixta";
  status: "draft" | "scheduled" | "invitation_sent" | "in_progress" | "closed" | "archived";
  scheduledAt: string;
  conferenceService:
    | "ninguno"
    | "kuoro_live"
    | "enlace_externo"
    | "zoom"
    | "google_meet"
    | "microsoft_teams"
    | "jitsi"
    | "servicio_propio"
    | "por_definir";
  location?: string;
  virtualAccessUrl?: string;
  notes?: string;
  votingBasis: "coeficientes" | "modulos" | "unidad";
  allowsSecondCall: boolean;
  secondCallScheduledAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredAgendaItem = {
  id: string;
  assemblyId: string;
  title: string;
  description?: string;
  slideTitle?: string;
  slideContent?: string;
  speakerNotes?: string;
  votePrompt?: string;
  type: "informativo" | "deliberativo" | "votacion" | "eleccion";
  votingRule: "ninguna" | "simple" | "calificada_70" | "unanimidad";
  requiresAttachment: boolean;
  order: number;
  status: "pending" | "active" | "completed";
  createdAt: string;
  updatedAt: string;
};

export type StoredAssemblyDocument = {
  id: string;
  assemblyId: string;
  title: string;
  documentName: string;
  documentMimeType?: string;
  documentData: string;
  category: "convocatoria" | "informe" | "soporte" | "presupuesto" | "reglamento" | "otro";
  agendaItemId?: string;
  createdAt: string;
};

export type StoredAssemblyInvitation = {
  id: string;
  assemblyId: string;
  unitId: string;
  sentAt: string;
  channel: "email" | "manual" | "whatsapp" | "otro";
  status: "sent" | "pending" | "failed";
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredAssemblyAccessConfig = {
  id: string;
  assemblyId: string;
  sessionAccessMode: "enlace_unico" | "codigo_y_documento" | "pre_registro_asistido";
  identityValidationMethod: "otp_email" | "otp_sms" | "validacion_manual" | "sin_otp";
  otpChannel: "email" | "sms" | "no_aplica";
  requireDocumentMatch: boolean;
  enableLobby: boolean;
  allowCompanions: boolean;
  oneActiveVoterPerUnit: boolean;
  fallbackManualValidation: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StoredAssemblyAccessGrant = {
  id: string;
  assemblyId: string;
  unitId: string;
  deliveryChannel: "email" | "whatsapp" | "manual" | "pendiente";
  validationMethod: "otp_email" | "otp_sms" | "validacion_manual" | "sin_otp";
  preRegistrationStatus: "pending" | "confirmed" | "manual_review";
  dispatchStatus: "draft" | "ready_to_send" | "sent";
  note?: string;
  createdAt: string;
  updatedAt: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toISOString(date: Date): string {
  return date.toISOString();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function createAdmin(data: Omit<StoredAdmin, "id" | "createdAt">): Promise<StoredAdmin> {
  const row = await prisma.adminUser.create({
    data: {
      id: randomUUID(),
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      passwordHash: data.passwordHash,
      emailVerified: data.emailVerified
    }
  });

  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    passwordHash: row.passwordHash,
    emailVerified: row.emailVerified,
    createdAt: toISOString(row.createdAt)
  };
}

export async function findAdminByEmail(email: string): Promise<StoredAdmin | null> {
  const row = await prisma.adminUser.findUnique({ where: { email } });

  if (!row) return null;

  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    passwordHash: row.passwordHash,
    emailVerified: row.emailVerified,
    createdAt: toISOString(row.createdAt)
  };
}

export async function findAdminBySessionTokenHash(
  tokenHash: string
): Promise<{ admin: StoredAdmin; session: StoredSession } | null> {
  const row = await prisma.adminSession.findUnique({
    where: { tokenHash },
    include: { admin: true }
  });

  if (!row) return null;

  return {
    admin: {
      id: row.admin.id,
      fullName: row.admin.fullName,
      email: row.admin.email,
      phone: row.admin.phone,
      passwordHash: row.admin.passwordHash,
      emailVerified: row.admin.emailVerified,
      createdAt: toISOString(row.admin.createdAt)
    },
    session: {
      id: row.id,
      adminId: row.adminId,
      tokenHash: row.tokenHash,
      expiresAt: toISOString(row.expiresAt),
      createdAt: toISOString(row.createdAt)
    }
  };
}

export async function createSession(
  data: Omit<StoredSession, "id" | "createdAt">
): Promise<StoredSession> {
  const row = await prisma.adminSession.create({
    data: {
      id: randomUUID(),
      adminId: data.adminId,
      tokenHash: data.tokenHash,
      expiresAt: new Date(data.expiresAt)
    }
  });

  return {
    id: row.id,
    adminId: row.adminId,
    tokenHash: row.tokenHash,
    expiresAt: toISOString(row.expiresAt),
    createdAt: toISOString(row.createdAt)
  };
}

// ─── Property ─────────────────────────────────────────────────────────────────

function toStoredProperty(row: {
  id: string;
  adminId: string;
  name: string;
  city: string;
  address: string;
  nit: string | null;
  legalType: string;
  developmentShape: string;
  buildingSubtype: string | null;
  structureModes: string[];
  privateUnitTypes: string[];
  usesCoefficients: boolean;
  usesContributionModules: boolean;
  supportsProxies: boolean;
  operationalStatus: string | null;
  totalUnits: number;
  createdAt: Date;
}): StoredProperty {
  return {
    id: row.id,
    adminId: row.adminId,
    name: row.name,
    city: row.city,
    address: row.address,
    nit: row.nit,
    legalType: row.legalType as StoredProperty["legalType"],
    developmentShape: row.developmentShape as StoredProperty["developmentShape"],
    buildingSubtype: (row.buildingSubtype ?? undefined) as StoredProperty["buildingSubtype"],
    structureModes: row.structureModes as StoredProperty["structureModes"],
    privateUnitTypes: row.privateUnitTypes,
    usesCoefficients: row.usesCoefficients,
    usesContributionModules: row.usesContributionModules,
    supportsProxies: row.supportsProxies,
    operationalStatus: (row.operationalStatus ?? undefined) as StoredProperty["operationalStatus"],
    totalUnits: row.totalUnits,
    createdAt: toISOString(row.createdAt)
  };
}

export async function listPropertiesByAdmin(adminId: string): Promise<StoredProperty[]> {
  const rows = await prisma.property.findMany({
    where: { adminId },
    orderBy: { createdAt: "desc" }
  });

  return rows.map(toStoredProperty);
}

export async function createProperty(
  data: Omit<StoredProperty, "id" | "createdAt">
): Promise<StoredProperty> {
  const row = await prisma.property.create({
    data: {
      id: randomUUID(),
      adminId: data.adminId,
      name: data.name,
      city: data.city,
      address: data.address,
      nit: data.nit ?? null,
      legalType: data.legalType,
      developmentShape: data.developmentShape,
      buildingSubtype: data.buildingSubtype ?? null,
      structureModes: data.structureModes,
      privateUnitTypes: data.privateUnitTypes,
      usesCoefficients: data.usesCoefficients,
      usesContributionModules: data.usesContributionModules,
      supportsProxies: data.supportsProxies,
      operationalStatus: data.operationalStatus ?? null,
      totalUnits: data.totalUnits
    }
  });

  return toStoredProperty(row);
}

export async function findPropertyById(propertyId: string): Promise<StoredProperty | null> {
  const row = await prisma.property.findUnique({ where: { id: propertyId } });

  if (!row) return null;

  return toStoredProperty(row);
}

export async function updateProperty(
  propertyId: string,
  data: Pick<
    StoredProperty,
    | "name" | "city" | "address" | "nit" | "legalType" | "developmentShape"
    | "buildingSubtype" | "structureModes" | "privateUnitTypes" | "usesCoefficients"
    | "usesContributionModules" | "supportsProxies" | "totalUnits"
  >
): Promise<StoredProperty | null> {
  const row = await prisma.property.update({
    where: { id: propertyId },
    data: {
      name: data.name,
      city: data.city,
      address: data.address,
      nit: data.nit ?? null,
      legalType: data.legalType,
      developmentShape: data.developmentShape,
      buildingSubtype: data.buildingSubtype ?? null,
      structureModes: data.structureModes,
      privateUnitTypes: data.privateUnitTypes,
      usesCoefficients: data.usesCoefficients,
      usesContributionModules: data.usesContributionModules,
      supportsProxies: data.supportsProxies,
      totalUnits: data.totalUnits
    }
  }).catch(() => null);

  if (!row) return null;

  return toStoredProperty(row);
}

// ─── Units ────────────────────────────────────────────────────────────────────

function toStoredUnit(row: {
  id: string;
  propertyId: string;
  unitType: string;
  groupingKind: string;
  groupingLabel: string;
  unitNumber: string;
  floor: string | null;
  destination: string;
  privateArea: number | null;
  coefficient: number | null;
  contributionModule: number | null;
  createdAt: Date;
}): StoredUnit {
  return {
    id: row.id,
    propertyId: row.propertyId,
    unitType: row.unitType,
    groupingKind: row.groupingKind,
    groupingLabel: row.groupingLabel,
    unitNumber: row.unitNumber,
    floor: row.floor ?? undefined,
    destination: row.destination,
    privateArea: row.privateArea ?? undefined,
    coefficient: row.coefficient ?? undefined,
    contributionModule: row.contributionModule ?? undefined,
    createdAt: toISOString(row.createdAt)
  };
}

export async function listUnitsByProperty(propertyId: string): Promise<StoredUnit[]> {
  const rows = await prisma.unit.findMany({ where: { propertyId } });

  return rows
    .map(toStoredUnit)
    .sort((a, b) => {
      const grouping = a.groupingLabel.localeCompare(b.groupingLabel, undefined, {
        numeric: true,
        sensitivity: "base"
      });

      if (grouping !== 0) return grouping;

      return a.unitNumber.localeCompare(b.unitNumber, undefined, {
        numeric: true,
        sensitivity: "base"
      });
    });
}

export async function createUnits(
  units: Array<Omit<StoredUnit, "id" | "createdAt">>
): Promise<StoredUnit[]> {
  const rows = await prisma.$transaction(
    units.map((unit) =>
      prisma.unit.create({
        data: {
          id: randomUUID(),
          propertyId: unit.propertyId,
          unitType: unit.unitType,
          groupingKind: unit.groupingKind,
          groupingLabel: unit.groupingLabel,
          unitNumber: unit.unitNumber,
          floor: unit.floor ?? null,
          destination: unit.destination,
          privateArea: unit.privateArea ?? null,
          coefficient: unit.coefficient ?? null,
          contributionModule: unit.contributionModule ?? null
        }
      })
    )
  );

  return rows.map(toStoredUnit);
}

export async function findUnitById(unitId: string): Promise<StoredUnit | null> {
  const row = await prisma.unit.findUnique({ where: { id: unitId } });

  if (!row) return null;

  return toStoredUnit(row);
}

export async function updateUnit(
  unitId: string,
  data: Pick<
    StoredUnit,
    "groupingLabel" | "unitNumber" | "floor" | "destination" | "privateArea" | "coefficient" | "contributionModule"
  >
): Promise<StoredUnit | null> {
  const row = await prisma.unit.update({
    where: { id: unitId },
    data: {
      groupingLabel: data.groupingLabel,
      unitNumber: data.unitNumber,
      floor: data.floor ?? null,
      destination: data.destination,
      privateArea: data.privateArea ?? null,
      coefficient: data.coefficient ?? null,
      contributionModule: data.contributionModule ?? null
    }
  }).catch(() => null);

  if (!row) return null;

  return toStoredUnit(row);
}

// ─── Owners ───────────────────────────────────────────────────────────────────

function toStoredOwner(row: {
  id: string;
  propertyId: string;
  fullName: string;
  documentType: string | null;
  email: string | null;
  phone: string | null;
  document: string | null;
  participationRole: string;
  canVote: boolean;
  receivesInvitations: boolean;
  proxyDocumentName: string | null;
  proxyDocumentMimeType: string | null;
  proxyDocumentData: string | null;
  proxyApprovalStatus: string;
  proxyRequestToken: string | null;
  proxyRequestedAt: Date | null;
  proxyLastSubmittedAt: Date | null;
  proxySubmittedByName: string | null;
  proxySubmittedByEmail: string | null;
  proxySubmittedByRole: string | null;
  proxyRejectionReasons: string[];
  proxyRejectionNote: string | null;
  createdAt: Date;
}): StoredOwner {
  return {
    id: row.id,
    propertyId: row.propertyId,
    fullName: row.fullName,
    documentType: row.documentType ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    document: row.document ?? undefined,
    participationRole: row.participationRole as StoredOwner["participationRole"],
    canVote: row.canVote,
    receivesInvitations: row.receivesInvitations,
    proxyDocumentName: row.proxyDocumentName ?? undefined,
    proxyDocumentMimeType: row.proxyDocumentMimeType ?? undefined,
    proxyDocumentData: row.proxyDocumentData ?? undefined,
    proxyApprovalStatus: row.proxyApprovalStatus as StoredOwner["proxyApprovalStatus"],
    proxyRequestToken: row.proxyRequestToken ?? undefined,
    proxyRequestedAt: row.proxyRequestedAt ? toISOString(row.proxyRequestedAt) : undefined,
    proxyLastSubmittedAt: row.proxyLastSubmittedAt ? toISOString(row.proxyLastSubmittedAt) : undefined,
    proxySubmittedByName: row.proxySubmittedByName ?? undefined,
    proxySubmittedByEmail: row.proxySubmittedByEmail ?? undefined,
    proxySubmittedByRole: (row.proxySubmittedByRole ?? undefined) as StoredOwner["proxySubmittedByRole"],
    proxyRejectionReasons: row.proxyRejectionReasons,
    proxyRejectionNote: row.proxyRejectionNote ?? undefined,
    createdAt: toISOString(row.createdAt)
  };
}

export async function createOwner(
  data: Omit<StoredOwner, "id" | "createdAt">
): Promise<StoredOwner> {
  const row = await prisma.owner.create({
    data: {
      id: randomUUID(),
      propertyId: data.propertyId,
      fullName: data.fullName,
      documentType: data.documentType ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      document: data.document ?? null,
      participationRole: data.participationRole,
      canVote: data.canVote,
      receivesInvitations: data.receivesInvitations,
      proxyDocumentName: data.proxyDocumentName ?? null,
      proxyDocumentMimeType: data.proxyDocumentMimeType ?? null,
      proxyDocumentData: data.proxyDocumentData ?? null,
      proxyApprovalStatus: data.proxyApprovalStatus,
      proxyRequestToken: data.proxyRequestToken ?? null,
      proxyRequestedAt: data.proxyRequestedAt ? new Date(data.proxyRequestedAt) : null,
      proxyLastSubmittedAt: data.proxyLastSubmittedAt ? new Date(data.proxyLastSubmittedAt) : null,
      proxySubmittedByName: data.proxySubmittedByName ?? null,
      proxySubmittedByEmail: data.proxySubmittedByEmail ?? null,
      proxySubmittedByRole: data.proxySubmittedByRole ?? null,
      proxyRejectionReasons: data.proxyRejectionReasons ?? [],
      proxyRejectionNote: data.proxyRejectionNote ?? null
    }
  });

  await syncProxyDocumentRequestFromOwner(row).catch((err) =>
    console.error("[db/createOwner] syncProxyDocumentRequestFromOwner", err)
  );

  return toStoredOwner(row);
}

export async function findOwnerById(ownerId: string): Promise<StoredOwner | null> {
  const row = await prisma.owner.findUnique({ where: { id: ownerId } });

  if (!row) return null;

  return toStoredOwner(row);
}

export async function updateOwner(
  ownerId: string,
  data: Pick<
    StoredOwner,
    | "fullName" | "documentType" | "email" | "phone" | "document" | "participationRole"
    | "canVote" | "receivesInvitations" | "proxyDocumentName" | "proxyDocumentMimeType"
    | "proxyDocumentData" | "proxyApprovalStatus" | "proxyRequestToken" | "proxyRequestedAt"
    | "proxyLastSubmittedAt" | "proxySubmittedByName" | "proxySubmittedByEmail"
    | "proxySubmittedByRole" | "proxyRejectionReasons" | "proxyRejectionNote"
  >
): Promise<StoredOwner | null> {
  const row = await prisma.owner.update({
    where: { id: ownerId },
    data: {
      fullName: data.fullName,
      documentType: data.documentType ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      document: data.document ?? null,
      participationRole: data.participationRole,
      canVote: data.canVote,
      receivesInvitations: data.receivesInvitations,
      proxyDocumentName: data.proxyDocumentName ?? null,
      proxyDocumentMimeType: data.proxyDocumentMimeType ?? null,
      proxyDocumentData: data.proxyDocumentData ?? null,
      proxyApprovalStatus: data.proxyApprovalStatus,
      proxyRequestToken: data.proxyRequestToken ?? null,
      proxyRequestedAt: data.proxyRequestedAt ? new Date(data.proxyRequestedAt) : null,
      proxyLastSubmittedAt: data.proxyLastSubmittedAt ? new Date(data.proxyLastSubmittedAt) : null,
      proxySubmittedByName: data.proxySubmittedByName ?? null,
      proxySubmittedByEmail: data.proxySubmittedByEmail ?? null,
      proxySubmittedByRole: data.proxySubmittedByRole ?? null,
      proxyRejectionReasons: data.proxyRejectionReasons ?? [],
      proxyRejectionNote: data.proxyRejectionNote ?? null
    }
  }).catch(() => null);

  if (!row) return null;

  await syncProxyDocumentRequestFromOwner(row).catch((err) =>
    console.error("[db/updateOwner] syncProxyDocumentRequestFromOwner", err)
  );

  return toStoredOwner(row);
}

export async function findOwnersForUnit(
  unitId: string
): Promise<Array<StoredOwner & { isPrimary: boolean; ownershipPercentage?: number }>> {
  const relations = await prisma.unitOwner.findMany({
    where: { unitId },
    include: { owner: true },
    orderBy: { isPrimary: "desc" }
  });

  return relations.map((relation) => ({
    ...toStoredOwner(relation.owner),
    isPrimary: relation.isPrimary,
    ownershipPercentage: relation.ownershipPercentage ?? undefined
  }));
}

export async function findPrimaryOwnerForUnit(unitId: string): Promise<StoredOwner | null> {
  const relation = await prisma.unitOwner.findFirst({
    where: { unitId, isPrimary: true },
    include: { owner: true }
  });

  if (!relation) return null;

  return toStoredOwner(relation.owner);
}

export async function createUnitOwner(
  data: Omit<StoredUnitOwner, "id" | "createdAt">
): Promise<StoredUnitOwner> {
  const row = await prisma.unitOwner.create({
    data: {
      id: randomUUID(),
      unitId: data.unitId,
      ownerId: data.ownerId,
      isPrimary: data.isPrimary,
      ownershipPercentage: data.ownershipPercentage ?? null
    }
  });

  return {
    id: row.id,
    unitId: row.unitId,
    ownerId: row.ownerId,
    isPrimary: row.isPrimary,
    ownershipPercentage: row.ownershipPercentage ?? undefined,
    createdAt: toISOString(row.createdAt)
  };
}

export async function findUnitOwnerRelations(unitId: string): Promise<StoredUnitOwner[]> {
  const rows = await prisma.unitOwner.findMany({ where: { unitId } });

  return rows.map((row) => ({
    id: row.id,
    unitId: row.unitId,
    ownerId: row.ownerId,
    isPrimary: row.isPrimary,
    ownershipPercentage: row.ownershipPercentage ?? undefined,
    createdAt: toISOString(row.createdAt)
  }));
}

// Removes all UnitOwner relations for a unit and deletes orphaned owners.
// Used by syncUnitOwners in routes.ts before re-creating owner records.
export async function clearUnitOwners(unitId: string): Promise<void> {
  const relations = await prisma.unitOwner.findMany({
    where: { unitId },
    select: { ownerId: true }
  });

  const ownerIds = relations.map((r) => r.ownerId);

  await prisma.$transaction(async (tx) => {
    await tx.unitOwner.deleteMany({ where: { unitId } });

    for (const ownerId of ownerIds) {
      const remaining = await tx.unitOwner.count({ where: { ownerId } });

      if (remaining === 0) {
        await tx.owner.delete({ where: { id: ownerId } });
      }
    }
  });
}

// Deletes a unit, its UnitOwner relations and any orphaned Owner records.
// Used by the DELETE /units/:id handler in routes.ts.
export async function deleteUnitWithOwners(unitId: string): Promise<void> {
  const relations = await prisma.unitOwner.findMany({
    where: { unitId },
    select: { ownerId: true }
  });

  const ownerIds = relations.map((r) => r.ownerId);

  await prisma.$transaction(async (tx) => {
    await tx.unitOwner.deleteMany({ where: { unitId } });

    for (const ownerId of ownerIds) {
      const remaining = await tx.unitOwner.count({ where: { ownerId } });

      if (remaining === 0) {
        await tx.owner.delete({ where: { id: ownerId } });
      }
    }

    await tx.unit.delete({ where: { id: unitId } });
  });
}

// ─── Assemblies ───────────────────────────────────────────────────────────────

function toStoredAssembly(row: {
  id: string;
  propertyId: string;
  title: string;
  type: string;
  modality: string;
  status: string;
  scheduledAt: Date;
  conferenceService: string;
  location: string | null;
  virtualAccessUrl: string | null;
  notes: string | null;
  votingBasis: string;
  allowsSecondCall: boolean;
  secondCallScheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): StoredAssembly {
  return {
    id: row.id,
    propertyId: row.propertyId,
    title: row.title,
    type: row.type as StoredAssembly["type"],
    modality: row.modality as StoredAssembly["modality"],
    status: row.status as StoredAssembly["status"],
    scheduledAt: toISOString(row.scheduledAt),
    conferenceService: row.conferenceService as StoredAssembly["conferenceService"],
    location: row.location ?? undefined,
    virtualAccessUrl: row.virtualAccessUrl ?? undefined,
    notes: row.notes ?? undefined,
    votingBasis: row.votingBasis as StoredAssembly["votingBasis"],
    allowsSecondCall: row.allowsSecondCall,
    secondCallScheduledAt: row.secondCallScheduledAt ? toISOString(row.secondCallScheduledAt) : undefined,
    createdAt: toISOString(row.createdAt),
    updatedAt: toISOString(row.updatedAt)
  };
}

export async function listAssembliesByProperty(propertyId: string): Promise<StoredAssembly[]> {
  const rows = await prisma.assembly.findMany({
    where: { propertyId },
    orderBy: { scheduledAt: "desc" }
  });
  return rows.map(toStoredAssembly);
}

export async function findAssemblyById(assemblyId: string): Promise<StoredAssembly | null> {
  const row = await prisma.assembly.findUnique({ where: { id: assemblyId } });

  if (!row) return null;

  return toStoredAssembly(row);
}

export async function findLatestAssemblyByProperty(propertyId: string): Promise<StoredAssembly | null> {
  // Returns only the latest ACTIVE assembly (not closed/archived)
  const row = await prisma.assembly.findFirst({
    where: { propertyId, status: { notIn: ["closed", "archived"] } },
    orderBy: { updatedAt: "desc" }
  });

  if (!row) return null;

  return toStoredAssembly(row);
}

export async function findAnyAssemblyByProperty(propertyId: string): Promise<StoredAssembly | null> {
  // Returns the latest assembly regardless of status (for historical views)
  const row = await prisma.assembly.findFirst({
    where: { propertyId },
    orderBy: { updatedAt: "desc" }
  });

  if (!row) return null;

  return toStoredAssembly(row);
}

export async function createAssembly(
  data: Omit<StoredAssembly, "id" | "createdAt" | "updatedAt">
): Promise<StoredAssembly> {
  const row = await prisma.assembly.create({
    data: {
      id: randomUUID(),
      propertyId: data.propertyId,
      title: data.title,
      type: data.type,
      modality: data.modality,
      status: data.status,
      scheduledAt: new Date(data.scheduledAt),
      conferenceService: data.conferenceService,
      location: data.location ?? null,
      virtualAccessUrl: data.virtualAccessUrl ?? null,
      notes: data.notes ?? null,
      votingBasis: data.votingBasis,
      allowsSecondCall: data.allowsSecondCall,
      secondCallScheduledAt: data.secondCallScheduledAt ? new Date(data.secondCallScheduledAt) : null
    }
  });

  return toStoredAssembly(row);
}

export async function updateAssembly(
  assemblyId: string,
  data: Pick<
    StoredAssembly,
    | "title" | "type" | "modality" | "status" | "scheduledAt" | "conferenceService"
    | "location" | "virtualAccessUrl" | "notes" | "votingBasis" | "allowsSecondCall"
    | "secondCallScheduledAt"
  >
): Promise<StoredAssembly | null> {
  const row = await prisma.assembly.update({
    where: { id: assemblyId },
    data: {
      title: data.title,
      type: data.type,
      modality: data.modality,
      status: data.status,
      scheduledAt: new Date(data.scheduledAt),
      conferenceService: data.conferenceService,
      location: data.location ?? null,
      virtualAccessUrl: data.virtualAccessUrl ?? null,
      notes: data.notes ?? null,
      votingBasis: data.votingBasis,
      allowsSecondCall: data.allowsSecondCall,
      secondCallScheduledAt: data.secondCallScheduledAt ? new Date(data.secondCallScheduledAt) : null
    }
  }).catch(() => null);

  if (!row) return null;

  return toStoredAssembly(row);
}

// ─── Agenda ───────────────────────────────────────────────────────────────────

function toStoredAgendaItem(row: {
  id: string;
  assemblyId: string;
  title: string;
  description: string | null;
  slideTitle: string | null;
  slideContent: string | null;
  speakerNotes: string | null;
  votePrompt: string | null;
  type: string;
  votingRule: string;
  requiresAttachment: boolean;
  order: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): StoredAgendaItem {
  return {
    id: row.id,
    assemblyId: row.assemblyId,
    title: row.title,
    description: row.description ?? undefined,
    slideTitle: row.slideTitle ?? undefined,
    slideContent: row.slideContent ?? undefined,
    speakerNotes: row.speakerNotes ?? undefined,
    votePrompt: row.votePrompt ?? undefined,
    type: row.type as StoredAgendaItem["type"],
    votingRule: row.votingRule as StoredAgendaItem["votingRule"],
    requiresAttachment: row.requiresAttachment,
    order: row.order,
    status: row.status as StoredAgendaItem["status"],
    createdAt: toISOString(row.createdAt),
    updatedAt: toISOString(row.updatedAt)
  };
}

export async function listAgendaItemsByAssembly(assemblyId: string): Promise<StoredAgendaItem[]> {
  const rows = await prisma.agendaItem.findMany({
    where: { assemblyId },
    orderBy: { order: "asc" }
  });

  return rows.map(toStoredAgendaItem);
}

export async function replaceAgendaItems(
  assemblyId: string,
  items: Array<Omit<StoredAgendaItem, "id" | "assemblyId" | "createdAt" | "updatedAt">>
): Promise<StoredAgendaItem[]> {
  const rows = await prisma.$transaction(async (tx) => {
    await tx.agendaItem.deleteMany({ where: { assemblyId } });

    return tx.$transaction(
      items.map((item) =>
        tx.agendaItem.create({
          data: {
            id: randomUUID(),
            assemblyId,
            title: item.title,
            description: item.description ?? null,
            slideTitle: item.slideTitle ?? null,
            slideContent: item.slideContent ?? null,
            speakerNotes: item.speakerNotes ?? null,
            votePrompt: item.votePrompt ?? null,
            type: item.type,
            votingRule: item.votingRule,
            requiresAttachment: item.requiresAttachment,
            order: item.order,
            status: item.status
          }
        })
      )
    );
  });

  return rows.map(toStoredAgendaItem);
}

// ─── Assembly Documents ───────────────────────────────────────────────────────

function toStoredAssemblyDocument(row: {
  id: string;
  assemblyId: string;
  agendaItemId: string | null;
  title: string;
  documentName: string;
  documentMimeType: string | null;
  documentData: string;
  category: string;
  createdAt: Date;
}): StoredAssemblyDocument {
  return {
    id: row.id,
    assemblyId: row.assemblyId,
    agendaItemId: row.agendaItemId ?? undefined,
    title: row.title,
    documentName: row.documentName,
    documentMimeType: row.documentMimeType ?? undefined,
    documentData: row.documentData,
    category: row.category as StoredAssemblyDocument["category"],
    createdAt: toISOString(row.createdAt)
  };
}

export async function listAssemblyDocumentsByAssembly(assemblyId: string): Promise<StoredAssemblyDocument[]> {
  const rows = await prisma.assemblyDocument.findMany({
    where: { assemblyId },
    orderBy: { createdAt: "desc" }
  });

  return rows.map(toStoredAssemblyDocument);
}

export async function replaceAssemblyDocuments(
  assemblyId: string,
  documents: Array<Omit<StoredAssemblyDocument, "id" | "assemblyId" | "createdAt">>
): Promise<StoredAssemblyDocument[]> {
  const rows = await prisma.$transaction(async (tx) => {
    await tx.assemblyDocument.deleteMany({ where: { assemblyId } });

    return tx.$transaction(
      documents.map((doc) =>
        tx.assemblyDocument.create({
          data: {
            id: randomUUID(),
            assemblyId,
            agendaItemId: doc.agendaItemId ?? null,
            title: doc.title,
            documentName: doc.documentName,
            documentMimeType: doc.documentMimeType ?? null,
            documentData: doc.documentData,
            category: doc.category
          }
        })
      )
    );
  });

  return rows.map(toStoredAssemblyDocument);
}

// ─── Assembly Invitations ─────────────────────────────────────────────────────

function toStoredAssemblyInvitation(row: {
  id: string;
  assemblyId: string;
  unitId: string;
  sentAt: Date;
  channel: string;
  status: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}): StoredAssemblyInvitation {
  return {
    id: row.id,
    assemblyId: row.assemblyId,
    unitId: row.unitId,
    sentAt: toISOString(row.sentAt),
    channel: row.channel as StoredAssemblyInvitation["channel"],
    status: row.status as StoredAssemblyInvitation["status"],
    note: row.note ?? undefined,
    createdAt: toISOString(row.createdAt),
    updatedAt: toISOString(row.updatedAt)
  };
}

export async function listAssemblyInvitationsByAssembly(assemblyId: string): Promise<StoredAssemblyInvitation[]> {
  const rows = await prisma.assemblyInvitation.findMany({ where: { assemblyId } });

  return rows.map(toStoredAssemblyInvitation);
}

export async function replaceAssemblyInvitations(
  assemblyId: string,
  invitations: Array<Omit<StoredAssemblyInvitation, "id" | "assemblyId" | "createdAt" | "updatedAt">>
): Promise<StoredAssemblyInvitation[]> {
  const rows = await prisma.$transaction(async (tx) => {
    await tx.assemblyInvitation.deleteMany({ where: { assemblyId } });

    return tx.$transaction(
      invitations.map((inv) =>
        tx.assemblyInvitation.create({
          data: {
            id: randomUUID(),
            assemblyId,
            unitId: inv.unitId,
            sentAt: new Date(inv.sentAt),
            channel: inv.channel,
            status: inv.status,
            note: inv.note ?? null
          }
        })
      )
    );
  });

  return rows.map(toStoredAssemblyInvitation);
}

// ─── Assembly Access Config ───────────────────────────────────────────────────

function toStoredAccessConfig(row: {
  id: string;
  assemblyId: string;
  sessionAccessMode: string;
  identityValidationMethod: string;
  otpChannel: string;
  requireDocumentMatch: boolean;
  enableLobby: boolean;
  allowCompanions: boolean;
  oneActiveVoterPerUnit: boolean;
  fallbackManualValidation: boolean;
  createdAt: Date;
  updatedAt: Date;
}): StoredAssemblyAccessConfig {
  return {
    id: row.id,
    assemblyId: row.assemblyId,
    sessionAccessMode: row.sessionAccessMode as StoredAssemblyAccessConfig["sessionAccessMode"],
    identityValidationMethod: row.identityValidationMethod as StoredAssemblyAccessConfig["identityValidationMethod"],
    otpChannel: row.otpChannel as StoredAssemblyAccessConfig["otpChannel"],
    requireDocumentMatch: row.requireDocumentMatch,
    enableLobby: row.enableLobby,
    allowCompanions: row.allowCompanions,
    oneActiveVoterPerUnit: row.oneActiveVoterPerUnit,
    fallbackManualValidation: row.fallbackManualValidation,
    createdAt: toISOString(row.createdAt),
    updatedAt: toISOString(row.updatedAt)
  };
}

export async function findAssemblyAccessConfigByAssembly(
  assemblyId: string
): Promise<StoredAssemblyAccessConfig | null> {
  const row = await prisma.assemblyAccessConfig.findUnique({ where: { assemblyId } });

  if (!row) return null;

  return toStoredAccessConfig(row);
}

export async function createAssemblyAccessConfig(
  data: Omit<StoredAssemblyAccessConfig, "id" | "createdAt" | "updatedAt">
): Promise<StoredAssemblyAccessConfig> {
  const row = await prisma.assemblyAccessConfig.create({
    data: {
      id: randomUUID(),
      assemblyId: data.assemblyId,
      sessionAccessMode: data.sessionAccessMode,
      identityValidationMethod: data.identityValidationMethod,
      otpChannel: data.otpChannel,
      requireDocumentMatch: data.requireDocumentMatch,
      enableLobby: data.enableLobby,
      allowCompanions: data.allowCompanions,
      oneActiveVoterPerUnit: data.oneActiveVoterPerUnit,
      fallbackManualValidation: data.fallbackManualValidation
    }
  });

  return toStoredAccessConfig(row);
}

export async function updateAssemblyAccessConfig(
  configId: string,
  data: Pick<
    StoredAssemblyAccessConfig,
    | "sessionAccessMode" | "identityValidationMethod" | "otpChannel" | "requireDocumentMatch"
    | "enableLobby" | "allowCompanions" | "oneActiveVoterPerUnit" | "fallbackManualValidation"
  >
): Promise<StoredAssemblyAccessConfig | null> {
  const row = await prisma.assemblyAccessConfig.update({
    where: { id: configId },
    data: {
      sessionAccessMode: data.sessionAccessMode,
      identityValidationMethod: data.identityValidationMethod,
      otpChannel: data.otpChannel,
      requireDocumentMatch: data.requireDocumentMatch,
      enableLobby: data.enableLobby,
      allowCompanions: data.allowCompanions,
      oneActiveVoterPerUnit: data.oneActiveVoterPerUnit,
      fallbackManualValidation: data.fallbackManualValidation
    }
  }).catch(() => null);

  if (!row) return null;

  return toStoredAccessConfig(row);
}

// ─── Assembly Access Grants ───────────────────────────────────────────────────

function toStoredAccessGrant(row: {
  id: string;
  assemblyId: string;
  unitId: string;
  deliveryChannel: string;
  validationMethod: string;
  preRegistrationStatus: string;
  dispatchStatus: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}): StoredAssemblyAccessGrant {
  return {
    id: row.id,
    assemblyId: row.assemblyId,
    unitId: row.unitId,
    deliveryChannel: row.deliveryChannel as StoredAssemblyAccessGrant["deliveryChannel"],
    validationMethod: row.validationMethod as StoredAssemblyAccessGrant["validationMethod"],
    preRegistrationStatus: row.preRegistrationStatus as StoredAssemblyAccessGrant["preRegistrationStatus"],
    dispatchStatus: row.dispatchStatus as StoredAssemblyAccessGrant["dispatchStatus"],
    note: row.note ?? undefined,
    createdAt: toISOString(row.createdAt),
    updatedAt: toISOString(row.updatedAt)
  };
}

export async function listAssemblyAccessGrantsByAssembly(assemblyId: string): Promise<StoredAssemblyAccessGrant[]> {
  const rows = await prisma.assemblyAccessGrant.findMany({ where: { assemblyId } });

  return rows.map(toStoredAccessGrant);
}

export async function replaceAssemblyAccessGrants(
  assemblyId: string,
  grants: Array<Omit<StoredAssemblyAccessGrant, "id" | "assemblyId" | "createdAt" | "updatedAt">>
): Promise<StoredAssemblyAccessGrant[]> {
  // Una fila por unidad (@@unique([assemblyId, unitId])); si el cliente envía duplicados, conservar la última.
  const byUnit = new Map<string, (typeof grants)[number]>();
  for (const g of grants) {
    byUnit.set(g.unitId, g);
  }
  const uniqueGrants = [...byUnit.values()];

  const rows = await prisma.$transaction(async (tx) => {
    // Vote.accessGrantId referencia AssemblyAccessGrant sin onDelete: sin esto, deleteMany falla si hubo votos.
    await tx.vote.updateMany({
      where: { assemblyId, accessGrantId: { not: null } },
      data: { accessGrantId: null }
    });

    await tx.assemblyAccessGrant.deleteMany({ where: { assemblyId } });

    const created: Awaited<ReturnType<typeof tx.assemblyAccessGrant.create>>[] = [];
    for (const grant of uniqueGrants) {
      const row = await tx.assemblyAccessGrant.create({
        data: {
          id: randomUUID(),
          assemblyId,
          unitId: grant.unitId,
          deliveryChannel: grant.deliveryChannel,
          validationMethod: grant.validationMethod,
          preRegistrationStatus: grant.preRegistrationStatus,
          dispatchStatus: grant.dispatchStatus,
          note: grant.note ?? null
        }
      });
      created.push(row);
    }
    return created;
  });

  return rows.map(toStoredAccessGrant);
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

// Resolves the full context for a public proxy upload link.
export async function findProxyRequestContext(token: string): Promise<{
  owner: StoredOwner;
  unit: StoredUnit;
  property: StoredProperty;
} | null> {
  const ownerRow = await prisma.owner.findUnique({ where: { proxyRequestToken: token } });

  if (!ownerRow) return null;

  const relation = await prisma.unitOwner.findFirst({ where: { ownerId: ownerRow.id } });

  if (!relation) return null;

  const [unitRow, propertyRow] = await Promise.all([
    prisma.unit.findUnique({ where: { id: relation.unitId } }),
    prisma.property.findUnique({ where: { id: ownerRow.propertyId } })
  ]);

  if (!unitRow || !propertyRow) return null;

  return {
    owner: toStoredOwner(ownerRow),
    unit: toStoredUnit(unitRow),
    property: toStoredProperty(propertyRow)
  };
}

// Used by the unauthenticated demo endpoints only.
export async function findFirstProperty(): Promise<StoredProperty | null> {
  const row = await prisma.property.findFirst({ orderBy: { createdAt: "asc" } });

  if (!row) return null;

  return toStoredProperty(row);
}

// ─── Assembly vote results ────────────────────────────────────────────────────

export type StoredVoteResult = {
  id: string;
  assemblyId: string;
  agendaItemId: string | null;
  question: string;
  votingRule: string;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  blankVotes: number;
  totalCoefficient: number;
  approved: boolean;
  closedAt: string;
  createdAt: string;
};

function toStoredVoteResult(row: {
  id: string;
  assemblyId: string;
  agendaItemId: string | null;
  question: string;
  votingRule: string;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  blankVotes: number;
  totalCoefficient: number;
  approved: boolean;
  closedAt: Date;
  createdAt: Date;
}): StoredVoteResult {
  return {
    id: row.id,
    assemblyId: row.assemblyId,
    agendaItemId: row.agendaItemId,
    question: row.question,
    votingRule: row.votingRule,
    yesVotes: row.yesVotes,
    noVotes: row.noVotes,
    abstainVotes: row.abstainVotes,
    blankVotes: row.blankVotes,
    totalCoefficient: row.totalCoefficient,
    approved: row.approved,
    closedAt: row.closedAt.toISOString(),
    createdAt: row.createdAt.toISOString()
  };
}

export async function createVoteResult(data: {
  assemblyId: string;
  agendaItemId?: string;
  question: string;
  votingRule: string;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  blankVotes: number;
  totalCoefficient: number;
  approved: boolean;
}): Promise<StoredVoteResult> {
  const row = await prisma.assemblyVoteResult.create({
    data: {
      id: randomUUID(),
      assemblyId: data.assemblyId,
      agendaItemId: data.agendaItemId ?? null,
      question: data.question,
      votingRule: data.votingRule,
      yesVotes: data.yesVotes,
      noVotes: data.noVotes,
      abstainVotes: data.abstainVotes,
      blankVotes: data.blankVotes,
      totalCoefficient: data.totalCoefficient,
      approved: data.approved
    }
  });
  return toStoredVoteResult(row);
}

export async function listVoteResultsByAssembly(assemblyId: string): Promise<StoredVoteResult[]> {
  const rows = await prisma.assemblyVoteResult.findMany({
    where: { assemblyId },
    orderBy: { createdAt: "asc" }
  });
  return rows.map(toStoredVoteResult);
}

// ─── Legacy JSON DB exports (removed — routes.ts must migrate to Prisma) ──────
// These preserve TypeScript compatibility while routes.ts is being migrated.
// They will throw at runtime; replace each usage with the Prisma functions above.

type LegacyDb = {
  admins: StoredAdmin[];
  sessions: StoredSession[];
  properties: StoredProperty[];
  units: StoredUnit[];
  owners: StoredOwner[];
  unitOwners: StoredUnitOwner[];
  assemblies: StoredAssembly[];
  agendaItems: StoredAgendaItem[];
  assemblyDocuments: StoredAssemblyDocument[];
  assemblyInvitations: StoredAssemblyInvitation[];
  assemblyAccessConfigs: StoredAssemblyAccessConfig[];
  assemblyAccessGrants: StoredAssemblyAccessGrant[];
};

export async function readDb(): Promise<LegacyDb> {
  throw new Error("readDb removed — use Prisma functions directly");
}

export async function writeDb(_db: LegacyDb): Promise<void> {
  throw new Error("writeDb removed — use Prisma functions directly");
}
