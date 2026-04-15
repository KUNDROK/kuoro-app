/**
 * Servicio de representación de voto.
 *
 * Modela quién vota por qué unidad, en qué calidad y con qué peso.
 *
 * Principios:
 * 1. Una sola representación activa por unidad por asamblea (@@unique).
 * 2. Un representante puede cubrir múltiples unidades con el mismo accessToken.
 * 3. El auto-seed deriva representaciones de UnitOwner + datos de proxy en Owner.
 * 4. Los apoderados externos se crean manualmente por el admin.
 * 5. Toda elegibilidad se resuelve en backend — el cliente nunca declara
 *    su propio derecho a votar.
 *
 * Flujo típico:
 *   1. Admin hace POST /representations/seed → se crean representaciones
 *      para propietarios directos y apoderados aprobados.
 *   2. Admin crea apoderados manuales si hace falta.
 *   3. Representante usa su accessToken para votar (castVote en voting.ts).
 *
 * Estados de representación:
 *   active             — válida y vigente
 *   revoked            — revocada por admin
 *   pending_validation — creada, pendiente de validación documental
 */

import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import type {
  RepresentationType,
  RepresentationStatus,
  AssemblyRepresentationSummary,
  RepresentedUnitVoteStatus,
  VotingEligibilitySummary,
  VotingSessionStatus,
  VotingRule,
  CreateProxyRepresentationInput,
  SeedRepresentationsResult,
  VotingBasis,
  VoteValue,
} from "@kuoro/contracts";

// ─── Helpers internos ─────────────────────────────────────────────────────────

/** Construye la etiqueta legible de una unidad: "Torre A - Apto 101" */
function unitLabel(unit: {
  groupingLabel: string;
  unitNumber: string;
  groupingKind: string;
}): string {
  return `${unit.groupingKind} ${unit.groupingLabel} - ${unit.unitNumber}`;
}

/** Convierte una fila de AssemblyRepresentation al tipo de contrato. */
function toSummary(
  row: {
    id: string;
    assemblyId: string;
    representedUnitId: string;
    representativeFullName: string;
    representativeEmail: string | null;
    representativeOwnerId: string | null;
    representationType: string;
    status: string;
    canVote: boolean;
    weight: number;
    votingBasis: string;
    proofDocumentRef: string | null;
    notes: string | null;
    accessToken: string;
  },
  unit: { groupingLabel: string; unitNumber: string; groupingKind: string },
): AssemblyRepresentationSummary {
  return {
    id:                    row.id,
    assemblyId:            row.assemblyId,
    representedUnitId:     row.representedUnitId,
    representedUnitLabel:  unitLabel(unit),
    representativeFullName: row.representativeFullName,
    representativeEmail:   row.representativeEmail ?? undefined,
    representativeOwnerId: row.representativeOwnerId ?? undefined,
    representationType:    row.representationType as RepresentationType,
    status:                row.status as RepresentationStatus,
    canVote:               row.canVote,
    weight:                row.weight,
    votingBasis:           row.votingBasis as VotingBasis,
    proofDocumentRef:      row.proofDocumentRef ?? undefined,
    notes:                 row.notes ?? undefined,
    accessToken:           row.accessToken,
  };
}

/** Audita un evento de representación en ConferenceAuditLog. */
async function auditRepresentation(
  assemblyId: string,
  propertyId: string,
  eventType: string,
  opts: {
    representationId?: string;
    unitId?: string;
    actorAdminId?: string;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<void> {
  try {
    await prisma.conferenceAuditLog.create({
      data: {
        assemblyId,
        propertyId,
        eventType,
        participantIdentity: null,
        participantName:     null,
        actorAdminId:        opts.actorAdminId ?? null,
        queueEntryId:        opts.representationId ?? null,
        metadata:            opts.metadata ? JSON.stringify({ unitId: opts.unitId, ...opts.metadata }) : null,
      },
    });
  } catch (err) {
    logger.error("representation", "Audit write failed", { eventType, error: String(err) });
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Auto-genera representaciones para una asamblea a partir de los datos
 * existentes de UnitOwner y proxy en Owner.
 *
 * Para cada AssemblyAccessGrant de la asamblea:
 * - Propietarios directos (participationRole != "apoderado", canVote=true) → type=owner
 * - Apoderados aprobados (participationRole="apoderado", proxyApprovalStatus="approved", canVote=true) → type=proxy
 *
 * Si ya existe una representación activa para la unidad, la omite (idempotente).
 * Si la unidad tiene varios elegibles, el propietario primario (isPrimary=true) tiene prioridad.
 */
export async function seedRepresentationsForAssembly(
  assemblyId: string,
  propertyId: string,
  adminId:    string,
): Promise<SeedRepresentationsResult> {
  const result: SeedRepresentationsResult = { created: 0, skipped: 0, errors: [] };

  // Cargar la asamblea para conocer votingBasis
  const assembly = await prisma.assembly.findUnique({
    where: { id: assemblyId },
    select: { votingBasis: true, propertyId: true },
  });

  if (!assembly || assembly.propertyId !== propertyId) {
    throw Object.assign(new Error("Asamblea no encontrada."), { statusCode: 404 });
  }

  const basis = assembly.votingBasis as VotingBasis;

  // Obtener todos los grants de la asamblea (una por unidad)
  const grants = await prisma.assemblyAccessGrant.findMany({
    where: { assemblyId },
    select: { unitId: true },
  });

  for (const grant of grants) {
    const { unitId } = grant;

    try {
      // ¿Ya existe representación activa?
      const existing = await prisma.assemblyRepresentation.findFirst({
        where: { assemblyId, representedUnitId: unitId, status: "active" },
      });

      if (existing) {
        result.skipped++;
        continue;
      }

      // Cargar la unidad para calcular peso
      const unit = await prisma.unit.findUnique({ where: { id: unitId } });
      if (!unit) {
        result.errors.push({ unitId, reason: "Unidad no encontrada" });
        continue;
      }

      let weight = 1;
      if (basis === "coeficientes") weight = unit.coefficient ?? 1;
      else if (basis === "modulos")  weight = unit.contributionModule ?? 1;

      // Cargar propietarios de la unidad
      const unitOwners = await prisma.unitOwner.findMany({
        where: { unitId },
        include: { owner: true },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      });

      // Seleccionar el representante más adecuado
      // Prioridad: propietario directo primario con canVote=true
      const directOwner = unitOwners.find(
        uo => uo.owner.participationRole !== "apoderado" && uo.owner.canVote,
      );

      // Apoderado aprobado
      const proxyOwner = unitOwners.find(
        uo =>
          uo.owner.participationRole === "apoderado" &&
          uo.owner.proxyApprovalStatus === "approved" &&
          uo.owner.canVote,
      );

      // Si hay apoderado aprobado, ese vota (proxy sobre owner)
      const chosenOwner = proxyOwner ?? directOwner;

      if (!chosenOwner) {
        result.skipped++;
        continue; // unidad sin votante elegible
      }

      const type: RepresentationType = proxyOwner
        ? "proxy"
        : "owner";

      const principalOwnerId = proxyOwner
        ? (directOwner?.owner.id ?? null)
        : null;

      await prisma.assemblyRepresentation.create({
        data: {
          propertyId,
          assemblyId,
          representedUnitId:     unitId,
          representativeOwnerId: chosenOwner.owner.id,
          representativeFullName: chosenOwner.owner.fullName,
          representativeEmail:   chosenOwner.owner.email ?? null,
          representationType:    type,
          principalOwnerId,
          canVote:               true,
          weight,
          votingBasis:           basis,
          proofDocumentRef:      proxyOwner ? (proxyOwner.owner.proxyDocumentName ?? null) : null,
          status:                "active",
        },
      });

      result.created++;
    } catch (err) {
      result.errors.push({ unitId, reason: String(err) });
    }
  }

  await auditRepresentation(assemblyId, propertyId, "representation_seed", {
    actorAdminId: adminId,
    metadata: { created: result.created, skipped: result.skipped, errors: result.errors.length },
  });

  logger.info("representation", "Seed de representaciones completado", {
    assemblyId, ...result,
  });

  return result;
}

/**
 * Crea una representación de apoderado manualmente.
 *
 * Si se proporciona `sharedAccessToken`, reutiliza ese token para que
 * el representante pueda votar por varias unidades con un solo token.
 */
export async function createProxyRepresentation(
  assemblyId:  string,
  propertyId:  string,
  input:       CreateProxyRepresentationInput,
  adminId:     string,
): Promise<AssemblyRepresentationSummary> {
  // Validar que la unidad pertenece a la propiedad
  const unit = await prisma.unit.findFirst({
    where: { id: input.representedUnitId, propertyId },
  });
  if (!unit) {
    throw Object.assign(new Error("Unidad no encontrada en esta propiedad."), { statusCode: 404 });
  }

  // No debe existir representación activa para esta unidad
  const existing = await prisma.assemblyRepresentation.findFirst({
    where: { assemblyId, representedUnitId: input.representedUnitId, status: "active" },
  });
  if (existing) {
    throw Object.assign(
      new Error("Ya existe una representación activa para esta unidad. Revócala primero."),
      { statusCode: 409 },
    );
  }

  // Validar sharedAccessToken si se proporciona
  if (input.sharedAccessToken) {
    const existingRep = await prisma.assemblyRepresentation.findFirst({
      where: { assemblyId, accessToken: input.sharedAccessToken, status: "active" },
    });
    if (!existingRep) {
      throw Object.assign(
        new Error("El sharedAccessToken no corresponde a ninguna representación activa en esta asamblea."),
        { statusCode: 400 },
      );
    }
  }

  const assembly = await prisma.assembly.findUnique({
    where: { id: assemblyId },
    select: { votingBasis: true },
  });

  const basis = (assembly?.votingBasis ?? "unidad") as VotingBasis;

  let weight = 1;
  if (basis === "coeficientes") weight = unit.coefficient ?? 1;
  else if (basis === "modulos")  weight = unit.contributionModule ?? 1;

  const accessToken = input.sharedAccessToken ?? randomUUID();

  const rep = await prisma.assemblyRepresentation.create({
    data: {
      propertyId,
      assemblyId,
      representedUnitId:     input.representedUnitId,
      representativeOwnerId: input.representativeOwnerId ?? null,
      representativeFullName: input.representativeFullName,
      representativeEmail:   input.representativeEmail ?? null,
      representationType:    "proxy",
      principalOwnerId:      input.principalOwnerId ?? null,
      canVote:               true,
      weight,
      votingBasis:           basis,
      proofDocumentRef:      input.proofDocumentRef ?? null,
      notes:                 input.notes ?? null,
      status:                "active",
      accessToken,
    },
  });

  await auditRepresentation(assemblyId, propertyId, "representation_created", {
    representationId: rep.id,
    unitId: input.representedUnitId,
    actorAdminId: adminId,
    metadata: { representationType: "proxy", representativeFullName: input.representativeFullName },
  });

  logger.info("representation", "Representación de apoderado creada", {
    representationId: rep.id, assemblyId, unitId: input.representedUnitId,
  });

  return toSummary(rep, unit);
}

/**
 * Devuelve todas las representaciones activas para un token en esta asamblea.
 */
export async function getRepresentationsByToken(
  accessToken: string,
  assemblyId:  string,
): Promise<AssemblyRepresentationSummary[]> {
  const reps = await prisma.assemblyRepresentation.findMany({
    where: { assemblyId, accessToken, status: "active" },
    include: { representedUnit: true },
    orderBy: { createdAt: "asc" },
  });

  return reps.map(r => toSummary(r, r.representedUnit));
}

/**
 * Devuelve la vista de elegibilidad del representante en una sesión activa.
 * Para cada unidad representada, indica si ya votó y cuál fue su voto.
 */
export async function getRepresentedUnitsWithVoteStatus(
  accessToken: string,
  assemblyId:  string,
  sessionId:   string,
): Promise<VotingEligibilitySummary> {
  const session = await prisma.votingSession.findFirst({
    where: { id: sessionId, assemblyId },
    select: {
      id: true, status: true, question: true, votingRule: true,
    },
  });

  if (!session) {
    throw Object.assign(new Error("Sesión no encontrada."), { statusCode: 404 });
  }

  const reps = await prisma.assemblyRepresentation.findMany({
    where: { assemblyId, accessToken, status: "active" },
    include: { representedUnit: true },
    orderBy: { createdAt: "asc" },
  });

  const units: RepresentedUnitVoteStatus[] = await Promise.all(
    reps.map(async rep => {
      const vote = await prisma.vote.findFirst({
        where: { votingSessionId: sessionId, unitId: rep.representedUnitId },
        select: { voteValue: true },
      });

      return {
        representationId:     rep.id,
        representedUnitId:    rep.representedUnitId,
        representedUnitLabel: unitLabel(rep.representedUnit),
        representationType:   rep.representationType as RepresentationType,
        canVote:              rep.canVote,
        weight:               rep.weight,
        myVote:               (vote?.voteValue as VoteValue | undefined),
        alreadyVoted:         vote !== null,
      };
    }),
  );

  return {
    sessionId:     session.id,
    sessionStatus: session.status as VotingSessionStatus,
    question:      session.question,
    votingRule:    session.votingRule as VotingRule,
    units,
  };
}

/**
 * Lista todas las representaciones de una asamblea (para el admin).
 */
export async function listAssemblyRepresentations(
  assemblyId: string,
  propertyId: string,
): Promise<AssemblyRepresentationSummary[]> {
  const reps = await prisma.assemblyRepresentation.findMany({
    where: { assemblyId, propertyId },
    include: { representedUnit: true },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  return reps.map(r => toSummary(r, r.representedUnit));
}

/**
 * Revoca una representación activa.
 */
export async function revokeRepresentation(
  representationId: string,
  assemblyId:       string,
  propertyId:       string,
  adminId:          string,
): Promise<void> {
  const rep = await prisma.assemblyRepresentation.findFirst({
    where: { id: representationId, assemblyId, propertyId },
  });

  if (!rep) {
    throw Object.assign(new Error("Representación no encontrada."), { statusCode: 404 });
  }

  if (rep.status !== "active") {
    throw Object.assign(
      new Error(`La representación ya está en estado "${rep.status}".`),
      { statusCode: 409 },
    );
  }

  await prisma.assemblyRepresentation.update({
    where: { id: representationId },
    data: { status: "revoked" },
  });

  await auditRepresentation(assemblyId, propertyId, "representation_revoked", {
    representationId,
    unitId: rep.representedUnitId,
    actorAdminId: adminId,
  });

  logger.info("representation", "Representación revocada", { representationId, assemblyId });
}

/**
 * Reactiva una representación revocada.
 */
export async function reactivateRepresentation(
  representationId: string,
  assemblyId:       string,
  propertyId:       string,
  adminId:          string,
): Promise<void> {
  const rep = await prisma.assemblyRepresentation.findFirst({
    where: { id: representationId, assemblyId, propertyId },
  });

  if (!rep) {
    throw Object.assign(new Error("Representación no encontrada."), { statusCode: 404 });
  }

  // Verificar que no hay otra activa para la misma unidad
  const activeOther = await prisma.assemblyRepresentation.findFirst({
    where: {
      assemblyId,
      representedUnitId: rep.representedUnitId,
      status: "active",
      id: { not: representationId },
    },
  });

  if (activeOther) {
    throw Object.assign(
      new Error("Ya existe otra representación activa para esta unidad."),
      { statusCode: 409 },
    );
  }

  await prisma.assemblyRepresentation.update({
    where: { id: representationId },
    data: { status: "active" },
  });

  await auditRepresentation(assemblyId, propertyId, "representation_reactivated", {
    representationId,
    unitId: rep.representedUnitId,
    actorAdminId: adminId,
  });

  logger.info("representation", "Representación reactivada", { representationId, assemblyId });
}

/**
 * Resuelve la representación para una unidad específica dado un accessToken.
 * Devuelve null si no hay representación activa válida.
 * Usado por el servicio de votación para validar el derecho a votar.
 */
export async function resolveRepresentation(
  accessToken: string,
  assemblyId:  string,
  unitId:      string,
): Promise<{
  id: string;
  representativeOwnerId: string | null;
  representativeFullName: string;
  representationType: string;
  weight: number;
  canVote: boolean;
} | null> {
  const rep = await prisma.assemblyRepresentation.findFirst({
    where: {
      assemblyId,
      accessToken,
      representedUnitId: unitId,
      status: "active",
      canVote: true,
    },
  });

  if (!rep) return null;

  return {
    id:                    rep.id,
    representativeOwnerId: rep.representativeOwnerId,
    representativeFullName: rep.representativeFullName,
    representationType:    rep.representationType,
    weight:                rep.weight,
    canVote:               rep.canVote,
  };
}

/**
 * Dado un accessToken, devuelve si tiene alguna representación activa en esta asamblea.
 * Usado para decidir si mostrar flujo multi-unidad o flujo legacy.
 */
export async function hasRepresentations(
  accessToken: string,
  assemblyId:  string,
): Promise<boolean> {
  const count = await prisma.assemblyRepresentation.count({
    where: { assemblyId, accessToken, status: "active" },
  });
  return count > 0;
}
