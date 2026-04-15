/**
 * Servicio de votación digital en tiempo real.
 *
 * Principios:
 * 1. La fuente de verdad son los votos individuales (modelo Vote).
 * 2. El resultado agregado se calcula al cerrar la sesión.
 * 3. Un solo voto por unidad por sesión — garantizado a nivel DB con @@unique.
 * 4. La elegibilidad se verifica en backend antes de aceptar cada voto.
 * 5. Resolución de elegibilidad por prioridad:
 *    a) AssemblyRepresentation (nuevo) — incluye multi-unidad y apoderados.
 *    b) AssemblyAccessGrant (legacy) — flujo anterior, una unidad por token.
 * 6. El admin nunca puede votar — solo abrir/cerrar sesiones.
 *
 * Máquina de estados de VotingSession:
 *   open → closed | cancelled
 */

import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { resolveRepresentation } from "./representation";
import type {
  VoteValue,
  VotingSessionStatus,
  VotingRule,
  VotingBasis,
  VotingSessionSummary,
  VotingSessionAttendeeView,
  VotingLiveCounts,
  CastVoteResponse,
  VoteSummary,
} from "@kuoro/contracts";

// ─── Helpers internos ─────────────────────────────────────────────────────────

/** Convierte la fila de BD al tipo de contrato VotingLiveCounts. */
async function computeLiveCounts(sessionId: string): Promise<VotingLiveCounts & { totalEligible: number }> {
  const votes = await prisma.vote.findMany({ where: { votingSessionId: sessionId } });

  const yesVotes     = votes.filter(v => v.voteValue === "yes");
  const noVotes      = votes.filter(v => v.voteValue === "no");
  const abstainVotes = votes.filter(v => v.voteValue === "abstain");

  const sum = (arr: typeof votes) => arr.reduce((acc, v) => acc + v.weight, 0);

  // Conteo de unidades elegibles en la sesión
  const session = await prisma.votingSession.findUnique({
    where: { id: sessionId },
    select: { assemblyId: true, propertyId: true },
  });

  const eligibleCount = session
    ? await countEligibleUnits(session.assemblyId)
    : 0;

  return {
    totalVoted:    votes.length,
    totalEligible: eligibleCount,
    yesCount:      yesVotes.length,
    noCount:       noVotes.length,
    abstainCount:  abstainVotes.length,
    blankCount:    votes.filter(v => v.voteValue === "blank").length,
    yesWeight:     sum(yesVotes),
    noWeight:      sum(noVotes),
    abstainWeight: sum(abstainVotes),
    totalWeight:   sum(votes),
  };
}

/** Cuenta cuántas unidades son elegibles para votar en una asamblea. */
async function countEligibleUnits(assemblyId: string): Promise<number> {
  // Una unidad es elegible si tiene AssemblyAccessGrant y al menos un Owner con canVote=true
  const grants = await prisma.assemblyAccessGrant.findMany({
    where: { assemblyId },
    select: { unitId: true },
  });

  let eligible = 0;
  for (const g of grants) {
    const voter = await findVoterForUnit(assemblyId, g.unitId);
    if (voter) eligible++;
  }
  return eligible;
}

/**
 * Dado un assemblyId y unitId, devuelve el Owner elegible (canVote=true)
 * que puede votar en nombre de la unidad, o null si no hay ninguno.
 */
async function findVoterForUnit(assemblyId: string, unitId: string) {
  // Verificar que la unidad pertenece a la propiedad de la asamblea
  const assembly = await prisma.assembly.findUnique({
    where: { id: assemblyId },
    select: { propertyId: true },
  });
  if (!assembly) return null;

  // Obtener propietarios de la unidad con canVote=true
  const unitOwners = await prisma.unitOwner.findMany({
    where: { unitId },
    include: { owner: true },
    orderBy: { isPrimary: "desc" },
  });

  return unitOwners.find(uo => uo.owner.canVote === true)?.owner ?? null;
}

/**
 * Calcula el peso del voto para una unidad según la base de votación.
 */
async function computeVoteWeight(unitId: string, basis: VotingBasis): Promise<number> {
  if (basis === "unidad") return 1;

  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) return 1;

  if (basis === "coeficientes") return unit.coefficient ?? 1;
  if (basis === "modulos")      return unit.contributionModule ?? 1;
  return 1;
}

/**
 * Calcula si la votación está aprobada según la regla.
 * blankVotes no entran en el denominador de aprobación.
 */
function computeApproval(
  yesWeight:    number,
  noWeight:     number,
  abstainWeight: number,
  rule: VotingRule,
): boolean {
  const valid = yesWeight + noWeight + abstainWeight;
  if (valid === 0) return false;

  switch (rule) {
    case "simple":     return yesWeight > noWeight;
    case "dos_tercios": return yesWeight / valid >= 2 / 3;
    case "unanimidad": return yesWeight === valid && noWeight === 0 && abstainWeight === 0;
    default:           return false;
  }
}

/** Convierte una fila de VotingSession al tipo de contrato. */
async function toSessionSummary(
  row: {
    id: string; assemblyId: string; propertyId: string; agendaItemId: string | null;
    question: string; votingRule: string; votingBasis: string; status: string;
    openedAt: Date; closedAt: Date | null; openedByAdminId: string;
    yesCount: number | null; noCount: number | null; abstainCount: number | null;
    blankCount: number | null; totalWeight: number | null; yesWeight: number | null;
    noWeight: number | null; abstainWeight: number | null; approved: boolean | null;
  },
): Promise<VotingSessionSummary> {
  const counts = await computeLiveCounts(row.id);

  return {
    id:              row.id,
    assemblyId:      row.assemblyId,
    propertyId:      row.propertyId,
    agendaItemId:    row.agendaItemId ?? undefined,
    question:        row.question,
    votingRule:      row.votingRule as VotingRule,
    votingBasis:     row.votingBasis as VotingBasis,
    status:          row.status as VotingSessionStatus,
    openedAt:        row.openedAt.toISOString(),
    closedAt:        row.closedAt?.toISOString(),
    openedByAdminId: row.openedByAdminId,
    counts,
    approved:        row.approved ?? undefined,
  };
}

// ─── Auditoría ────────────────────────────────────────────────────────────────

type VotingAuditEvent =
  | "voting_session_opened"
  | "vote_cast"
  | "vote_duplicate_attempt"
  | "voting_session_closed"
  | "voting_session_cancelled"
  | "vote_ineligible_attempt";

async function auditVoting(
  assemblyId: string,
  propertyId: string,
  eventType: VotingAuditEvent,
  opts: {
    sessionId?:          string;
    unitId?:             string;
    participantIdentity?: string;
    actorAdminId?:       string;
    metadata?:           Record<string, unknown>;
  } = {},
): Promise<void> {
  try {
    await prisma.conferenceAuditLog.create({
      data: {
        assemblyId,
        propertyId,
        eventType,
        participantIdentity: opts.participantIdentity ?? null,
        participantName:     null,
        actorAdminId:        opts.actorAdminId ?? null,
        queueEntryId:        opts.sessionId ?? null,
        metadata:            opts.metadata ? JSON.stringify(opts.metadata) : null,
      },
    });
  } catch (err) {
    logger.error("voting", "Audit write failed", { eventType, error: String(err) });
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Abre una nueva sesión de votación.
 * Solo puede haber una sesión `open` por asamblea a la vez.
 */
export async function openSession(
  assemblyId:  string,
  propertyId:  string,
  adminId:     string,
  question:    string,
  votingRule:  VotingRule,
  votingBasis: VotingBasis,
  agendaItemId?: string,
): Promise<VotingSessionSummary> {
  // Verificar que no haya sesión abierta
  const existing = await prisma.votingSession.findFirst({
    where: { assemblyId, status: "open" },
  });

  if (existing) {
    throw Object.assign(
      new Error("Ya hay una sesión de votación abierta en esta asamblea. Ciérrala antes de abrir otra."),
      { statusCode: 409 },
    );
  }

  const session = await prisma.votingSession.create({
    data: {
      assemblyId,
      propertyId,
      agendaItemId:    agendaItemId ?? null,
      question,
      votingRule,
      votingBasis,
      status:          "open",
      openedByAdminId: adminId,
    },
  });

  await auditVoting(assemblyId, propertyId, "voting_session_opened", {
    sessionId:    session.id,
    actorAdminId: adminId,
    metadata:     { question, votingRule, votingBasis },
  });

  logger.info("voting", "Sesión de votación abierta", {
    sessionId:  session.id,
    assemblyId,
    votingRule,
    votingBasis,
    question,
  });

  return toSessionSummary(session);
}

/**
 * Emite un voto.
 *
 * Validaciones:
 * 1. La sesión existe y está abierta.
 * 2. El accessToken corresponde a un AssemblyAccessGrant de la misma asamblea.
 * 3. La unidad tiene un Owner con canVote=true.
 * 4. La unidad no ha votado antes en esta sesión.
 * 5. Se registra el voto con el peso correcto según votingBasis.
 */
export async function castVote(
  sessionId:           string,
  accessToken:         string,
  voteValue:           VoteValue,
  propertyId:          string,
  participantIdentity: string = "unknown",
  unitId?:             string,   // requerido en modo representación multi-unidad
): Promise<CastVoteResponse> {
  // 1. Cargar y validar la sesión
  const session = await prisma.votingSession.findFirst({
    where: { id: sessionId, propertyId },
  });

  if (!session) {
    throw Object.assign(new Error("Sesión de votación no encontrada."), { statusCode: 404 });
  }

  if (session.status !== "open") {
    throw Object.assign(
      new Error("La sesión de votación ya está cerrada. No se aceptan más votos."),
      { statusCode: 403 },
    );
  }

  // Variables que se resolverán por alguna de las dos rutas
  let resolvedUnitId:        string;
  let resolvedWeight:        number;
  let resolvedOwnerId:       string | null = null;
  let resolvedRepresentationId: string | null = null;
  let resolvedRepresentationType: string | null = null;
  let resolvedGrantId:       string | null = null;

  // ─── Ruta A: AssemblyRepresentation (nueva, prioritaria) ──────────────────
  //
  // Si se proporciona un unitId (explícito o resolvible), intentamos primero
  // la ruta de representación formal.

  const targetUnitId = unitId ?? null;

  const representation = targetUnitId
    ? await resolveRepresentation(accessToken, session.assemblyId, targetUnitId)
    : null;

  if (representation) {
    // Representación activa encontrada
    resolvedUnitId            = targetUnitId!;
    resolvedWeight            = representation.weight;
    resolvedOwnerId           = representation.representativeOwnerId;
    resolvedRepresentationId  = representation.id;
    resolvedRepresentationType = representation.representationType;
  } else {
    // ─── Ruta B: AssemblyAccessGrant (legacy, retrocompatible) ───────────────
    //
    // El token puede ser un AssemblyAccessGrant.accessToken que cubre una sola unidad.
    const grant = await prisma.assemblyAccessGrant.findFirst({
      where: { accessToken },
      include: { assembly: { select: { propertyId: true } } },
    });

    if (!grant) {
      // Si había unitId pero no encontramos representación, el token es inválido para esa unidad
      const msg = targetUnitId
        ? "No tienes representación activa para votar por esta unidad."
        : "Token de acceso inválido.";
      throw Object.assign(new Error(msg), { statusCode: 403 });
    }

    if (grant.assemblyId !== session.assemblyId) {
      throw Object.assign(
        new Error("El token de acceso no corresponde a esta asamblea."),
        { statusCode: 403 },
      );
    }

    // Si se pasó un unitId que no coincide con el grant, rechazar
    if (targetUnitId && targetUnitId !== grant.unitId) {
      throw Object.assign(
        new Error("No tienes representación activa para votar por esta unidad."),
        { statusCode: 403 },
      );
    }

    resolvedUnitId  = grant.unitId;
    resolvedGrantId = grant.id;

    // Verificar elegibilidad clásica (Owner con canVote=true)
    const voter = await findVoterForUnit(session.assemblyId, resolvedUnitId);
    if (!voter) {
      await auditVoting(session.assemblyId, session.propertyId, "vote_ineligible_attempt", {
        sessionId,
        unitId: resolvedUnitId,
        participantIdentity,
        metadata: { reason: "no_can_vote", path: "legacy_grant" },
      });
      throw Object.assign(
        new Error("Esta unidad no tiene habilitado el derecho a votar."),
        { statusCode: 403 },
      );
    }

    resolvedOwnerId = voter.id;
    resolvedWeight  = await computeVoteWeight(resolvedUnitId, session.votingBasis as VotingBasis);
  }

  // 4. Verificar que la unidad no haya votado ya (aplica a ambas rutas)
  const existingVote = await prisma.vote.findFirst({
    where: { votingSessionId: sessionId, unitId: resolvedUnitId },
  });

  if (existingVote) {
    await auditVoting(session.assemblyId, session.propertyId, "vote_duplicate_attempt", {
      sessionId,
      unitId: resolvedUnitId,
      participantIdentity,
      metadata: {
        previousVoteValue: existingVote.voteValue,
        representationType: resolvedRepresentationType,
      },
    });
    throw Object.assign(
      new Error("Esta unidad ya emitió su voto en esta sesión."),
      { statusCode: 409 },
    );
  }

  // 5. Registrar voto
  const vote = await prisma.vote.create({
    data: {
      votingSessionId:    sessionId,
      propertyId:         session.propertyId,
      assemblyId:         session.assemblyId,
      unitId:             resolvedUnitId,
      ownerId:            resolvedOwnerId,
      participantIdentity,
      voteValue,
      weight:             resolvedWeight,
      accessGrantId:      resolvedGrantId,
      representationId:   resolvedRepresentationId,
      representationType: resolvedRepresentationType,
    },
  });

  await auditVoting(session.assemblyId, session.propertyId, "vote_cast", {
    sessionId,
    unitId: resolvedUnitId,
    participantIdentity,
    metadata: {
      voteValue,
      weight:             resolvedWeight,
      representationType: resolvedRepresentationType ?? "legacy_grant",
      representationId:   resolvedRepresentationId,
    },
  });

  logger.info("voting", "Voto emitido", {
    sessionId,
    unitId:             resolvedUnitId,
    voteValue,
    weight:             resolvedWeight,
    representationType: resolvedRepresentationType ?? "legacy_grant",
  });

  return {
    success:   true,
    voteValue,
    sessionId,
    unitId:    vote.unitId,
  };
}

/**
 * Cierra una sesión de votación y calcula el resultado final.
 */
export async function closeSession(
  sessionId:  string,
  adminId:    string,
  propertyId: string,
): Promise<VotingSessionSummary> {
  const session = await prisma.votingSession.findFirst({
    where: { id: sessionId, propertyId },
  });

  if (!session) {
    throw Object.assign(new Error("Sesión no encontrada."), { statusCode: 404 });
  }

  if (session.status !== "open") {
    throw Object.assign(
      new Error("La sesión ya está cerrada o cancelada."),
      { statusCode: 409 },
    );
  }

  // Calcular agregados desde votos individuales
  const votes = await prisma.vote.findMany({ where: { votingSessionId: sessionId } });

  const yesVotes     = votes.filter(v => v.voteValue === "yes");
  const noVotes      = votes.filter(v => v.voteValue === "no");
  const abstainVotes = votes.filter(v => v.voteValue === "abstain");
  const blankVotes   = votes.filter(v => v.voteValue === "blank");

  const sumWeight = (arr: typeof votes) => arr.reduce((acc, v) => acc + v.weight, 0);

  const yesWeight     = sumWeight(yesVotes);
  const noWeight      = sumWeight(noVotes);
  const abstainWeight = sumWeight(abstainVotes);
  const blankWeight   = sumWeight(blankVotes);
  const totalWeight   = sumWeight(votes);

  const approved = computeApproval(yesWeight, noWeight, abstainWeight, session.votingRule as VotingRule);

  const updated = await prisma.votingSession.update({
    where: { id: sessionId },
    data: {
      status:       "closed",
      closedAt:     new Date(),
      yesCount:     yesVotes.length,
      noCount:      noVotes.length,
      abstainCount: abstainVotes.length,
      blankCount:   blankVotes.length,
      yesWeight,
      noWeight,
      abstainWeight,
      totalWeight:  totalWeight + blankWeight,
      approved,
    },
  });

  await auditVoting(session.assemblyId, session.propertyId, "voting_session_closed", {
    sessionId,
    actorAdminId: adminId,
    metadata: {
      yesCount:  yesVotes.length,
      noCount:   noVotes.length,
      abstainCount: abstainVotes.length,
      blankCount: blankVotes.length,
      yesWeight, noWeight, abstainWeight, totalWeight, approved,
    },
  });

  logger.info("voting", "Sesión de votación cerrada", {
    sessionId,
    yesCount:  yesVotes.length,
    noCount:   noVotes.length,
    abstainCount: abstainVotes.length,
    blankCount: blankVotes.length,
    approved,
  });

  return toSessionSummary(updated);
}

/**
 * Devuelve la sesión de votación activa (status = "open") de la asamblea.
 * Devuelve null si no hay ninguna.
 */
export async function getActiveSession(
  assemblyId: string,
  propertyId: string,
): Promise<VotingSessionSummary | null> {
  const session = await prisma.votingSession.findFirst({
    where: { assemblyId, propertyId, status: "open" },
    orderBy: { openedAt: "desc" },
  });

  return session ? toSessionSummary(session) : null;
}

/**
 * Devuelve la vista de una sesión para un asistente.
 * Incluye elegibilidad, voto ya emitido y estado.
 */
export async function getAttendeeView(
  sessionId:   string,
  assemblyId:  string,
  propertyId:  string,
  accessToken: string,
): Promise<VotingSessionAttendeeView> {
  const session = await prisma.votingSession.findFirst({
    where: { id: sessionId, assemblyId, propertyId },
  });

  if (!session) {
    throw Object.assign(new Error("Sesión no encontrada."), { statusCode: 404 });
  }

  // Resolver accessToken → unitId
  // Primero: AssemblyAccessGrant (legacy), luego: AssemblyRepresentation (nueva)
  const grant = await prisma.assemblyAccessGrant.findFirst({
    where: { accessToken, assemblyId },
  });

  let resolvedUnitId: string | null = grant?.unitId ?? null;

  if (!resolvedUnitId) {
    // Buscar en representaciones activas
    const rep = await prisma.assemblyRepresentation.findFirst({
      where: { accessToken, assemblyId, status: "active" },
      select: { representedUnitId: true, canVote: true },
    });
    if (rep) {
      resolvedUnitId = rep.representedUnitId;
    }
  }

  if (!resolvedUnitId) {
    return {
      id:         session.id,
      assemblyId: session.assemblyId,
      question:   session.question,
      votingRule: session.votingRule as VotingRule,
      status:     session.status as VotingSessionStatus,
      openedAt:   session.openedAt.toISOString(),
      closedAt:   session.closedAt?.toISOString(),
      approved:   session.approved ?? undefined,
      isEligible: false,
      ineligibleReason: "no_access_grant",
    };
  }

  const voter = grant
    ? await findVoterForUnit(assemblyId, resolvedUnitId)
    : { id: "rep" };  // Representation tokens are pre-validated for canVote=true

  const isEligible = voter !== null;

  const existingVote = await prisma.vote.findFirst({
    where: { votingSessionId: sessionId, unitId: resolvedUnitId },
  });

  // Exponer conteos solo cuando la sesión está cerrada
  const counts = session.status === "closed"
    ? await computeLiveCounts(sessionId)
    : undefined;

  return {
    id:         session.id,
    assemblyId: session.assemblyId,
    question:   session.question,
    votingRule: session.votingRule as VotingRule,
    status:     session.status as VotingSessionStatus,
    openedAt:   session.openedAt.toISOString(),
    closedAt:   session.closedAt?.toISOString(),
    approved:   session.approved ?? undefined,
    counts,
    myVote:     (existingVote?.voteValue as VoteValue | undefined),
    isEligible,
    ineligibleReason: !isEligible ? "no_can_vote" : undefined,
  };
}

/**
 * Devuelve todas las sesiones de votación de una asamblea.
 */
export async function listSessions(
  assemblyId: string,
  propertyId: string,
): Promise<VotingSessionSummary[]> {
  const sessions = await prisma.votingSession.findMany({
    where: { assemblyId, propertyId },
    orderBy: { openedAt: "desc" },
  });

  return Promise.all(sessions.map(s => toSessionSummary(s)));
}

/**
 * Devuelve el voto de una unidad en una sesión (vía accessToken).
 * Devuelve null si no ha votado.
 */
export async function getMyVote(
  sessionId:   string,
  accessToken: string,
  assemblyId:  string,
): Promise<{ voteValue: VoteValue | null; unitId: string | null }> {
  const grant = await prisma.assemblyAccessGrant.findFirst({
    where: { accessToken, assemblyId },
  });

  if (!grant) return { voteValue: null, unitId: null };

  const vote = await prisma.vote.findFirst({
    where: { votingSessionId: sessionId, unitId: grant.unitId },
  });

  return {
    voteValue: (vote?.voteValue as VoteValue | null) ?? null,
    unitId:    grant.unitId,
  };
}

/**
 * Cancela una sesión sin calcular resultado (para sesiones que no deben contar).
 */
export async function cancelSession(
  sessionId:  string,
  adminId:    string,
  propertyId: string,
): Promise<void> {
  const session = await prisma.votingSession.findFirst({
    where: { id: sessionId, propertyId, status: "open" },
  });

  if (!session) {
    throw Object.assign(new Error("Sesión no encontrada o ya cerrada."), { statusCode: 404 });
  }

  await prisma.votingSession.update({
    where: { id: sessionId },
    data: { status: "cancelled", closedAt: new Date() },
  });

  await auditVoting(session.assemblyId, session.propertyId, "voting_session_cancelled", {
    sessionId,
    actorAdminId: adminId,
  });

  logger.info("voting", "Sesión cancelada", { sessionId, adminId });
}

/**
 * Devuelve los votos individuales de una sesión (para admin, sin PII).
 */
export async function getSessionVotes(
  sessionId:  string,
  propertyId: string,
): Promise<VoteSummary[]> {
  const session = await prisma.votingSession.findFirst({
    where: { id: sessionId, propertyId },
  });

  if (!session) {
    throw Object.assign(new Error("Sesión no encontrada."), { statusCode: 404 });
  }

  const votes = await prisma.vote.findMany({
    where: { votingSessionId: sessionId },
    orderBy: { castAt: "asc" },
  });

  return votes.map(v => ({
    id:        v.id,
    unitId:    v.unitId,
    voteValue: v.voteValue as VoteValue,
    weight:    v.weight,
    castAt:    v.castAt.toISOString(),
  }));
}
