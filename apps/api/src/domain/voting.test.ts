/**
 * Tests unitarios para el servicio de votación digital.
 *
 * Casos críticos cubiertos:
 * 1. Abrir sesión correctamente
 * 2. Prevenir sesión doble (solo una sesión open por asamblea)
 * 3. Emitir voto válido
 * 4. Bloquear doble voto de la misma unidad
 * 5. Bloquear voto en sesión cerrada
 * 6. Bloquear voto de unidad no elegible (canVote=false)
 * 7. Bloquear accessToken inválido o de otra asamblea
 * 8. Cerrar sesión y calcular resultado
 * 9. Peso de voto según votingBasis (coeficientes, modulos, unidad)
 * 10. Reglas de aprobación (simple, dos_tercios, unanimidad)
 * 11. Aislamiento multi-tenant (propertyId incorrecto rechazado)
 * 12. getActiveSession devuelve null cuando no hay sesión abierta
 * 13. getMyVote con accessToken válido e inválido
 * 14. cancelSession funciona en sesión abierta, falla en cerrada
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const makeVotingSession = (overrides: Record<string, unknown> = {}) => ({
  id:              "sess-1",
  assemblyId:      "asm-1",
  propertyId:      "prop-1",
  agendaItemId:    null,
  question:        "¿Aprueba el presupuesto?",
  votingRule:      "simple",
  votingBasis:     "unidad",
  status:          "open",
  openedAt:        new Date("2026-01-01T10:00:00Z"),
  closedAt:        null,
  openedByAdminId: "admin-1",
  yesCount:        null,
  noCount:         null,
  abstainCount:    null,
  blankCount:      null,
  totalWeight:     null,
  yesWeight:       null,
  noWeight:        null,
  abstainWeight:   null,
  approved:        null,
  createdAt:       new Date("2026-01-01T10:00:00Z"),
  updatedAt:       new Date("2026-01-01T10:00:00Z"),
  ...overrides,
});

const makeGrant = (overrides: Record<string, unknown> = {}) => ({
  id:         "grant-1",
  assemblyId: "asm-1",
  unitId:     "unit-1",
  accessToken: "token-abc",
  assembly:   { propertyId: "prop-1" },
  ...overrides,
});

const makeUnit = (overrides: Record<string, unknown> = {}) => ({
  id:                 "unit-1",
  propertyId:         "prop-1",
  unitType:           "apartamento",
  groupingKind:       "torre",
  groupingLabel:      "A",
  unitNumber:         "101",
  floor:              "1",
  destination:        "residencial",
  privateArea:        80,
  coefficient:        0.025,
  contributionModule: 2,
  createdAt:          new Date(),
  ...overrides,
});

const makeUnitOwner = (ownerId: string, canVote = true) => ({
  id:      `uo-${ownerId}`,
  unitId:  "unit-1",
  ownerId,
  isPrimary: true,
  ownershipPercentage: 100,
  createdAt: new Date(),
  owner: {
    id:      ownerId,
    canVote,
    fullName: "Owner Name",
    propertyId: "prop-1",
    documentType: null,
    email: null,
    phone: null,
    document: null,
    participationRole: "propietario",
    receivesInvitations: true,
    proxyDocumentName: null,
    proxyDocumentMimeType: null,
    proxyDocumentData: null,
    proxyApprovalStatus: "none",
    proxyRequestToken: null,
    proxyRequestedAt: null,
    proxyLastSubmittedAt: null,
    proxySubmittedByName: null,
    proxySubmittedByEmail: null,
    proxySubmittedByRole: null,
    proxyRejectionReasons: [],
    proxyRejectionNote: null,
    createdAt: new Date(),
  },
});

const makeVote = (overrides: Record<string, unknown> = {}) => ({
  id:                  "vote-1",
  votingSessionId:     "sess-1",
  propertyId:          "prop-1",
  assemblyId:          "asm-1",
  unitId:              "unit-1",
  ownerId:             "owner-1",
  participantIdentity: "user-1",
  voteValue:           "yes",
  weight:              1,
  castAt:              new Date(),
  createdAt:           new Date(),
  accessGrantId:       "grant-1",
  ...overrides,
});

// Mock de prisma
const mockPrisma = {
  votingSession:          { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  vote:                   { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  assemblyAccessGrant:    { findFirst: vi.fn(), findMany: vi.fn() },
  assemblyAccessConfig:   { findFirst: vi.fn() },
  assembly:               { findUnique: vi.fn() },
  unit:                   { findUnique: vi.fn() },
  unitOwner:              { findMany: vi.fn() },
  conferenceAuditLog:     { create: vi.fn() },
};

vi.mock("../lib/prisma",  () => ({ prisma: mockPrisma }));
vi.mock("../lib/logger",  () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

// Import después del mock
const { openSession, castVote, closeSession, getActiveSession, getMyVote, cancelSession } =
  await import("./voting");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupCommonMocks(overrides: {
  session?: Record<string, unknown> | null;
  grant?: Record<string, unknown> | null;
  unitOwners?: ReturnType<typeof makeUnitOwner>[];
  existingVote?: ReturnType<typeof makeVote> | null;
  unit?: ReturnType<typeof makeUnit>;
} = {}) {
  const session = overrides.session !== undefined
    ? overrides.session
    : makeVotingSession();

  mockPrisma.votingSession.findFirst.mockResolvedValue(session);
  // findUnique se usa en computeLiveCounts para obtener assemblyId/propertyId
  mockPrisma.votingSession.findUnique.mockResolvedValue(session);
  mockPrisma.assemblyAccessGrant.findFirst.mockResolvedValue(
    overrides.grant !== undefined ? overrides.grant : makeGrant()
  );
  mockPrisma.assemblyAccessGrant.findMany.mockResolvedValue(
    overrides.grant !== null ? [makeGrant()] : []
  );
  mockPrisma.unitOwner.findMany.mockResolvedValue(
    overrides.unitOwners ?? [makeUnitOwner("owner-1", true)]
  );
  mockPrisma.vote.findFirst.mockResolvedValue(
    overrides.existingVote !== undefined ? overrides.existingVote : null
  );
  mockPrisma.vote.findMany.mockResolvedValue([]);
  mockPrisma.unit.findUnique.mockResolvedValue(
    overrides.unit ?? makeUnit()
  );
  mockPrisma.assembly.findUnique.mockResolvedValue({ propertyId: "prop-1" });
  mockPrisma.conferenceAuditLog.create.mockResolvedValue({});
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── openSession ──────────────────────────────────────────────────────────────

describe("openSession", () => {
  it("crea una nueva sesión cuando no hay ninguna abierta", async () => {
    const createdSession = makeVotingSession();
    mockPrisma.votingSession.findFirst.mockResolvedValueOnce(null); // check existing
    mockPrisma.votingSession.findFirst.mockResolvedValue(createdSession); // computeLiveCounts via findFirst en toSessionSummary
    mockPrisma.votingSession.findUnique.mockResolvedValue(createdSession);
    mockPrisma.votingSession.create.mockResolvedValue(createdSession);
    mockPrisma.vote.findMany.mockResolvedValue([]);
    mockPrisma.assemblyAccessGrant.findMany.mockResolvedValue([makeGrant()]);
    mockPrisma.unitOwner.findMany.mockResolvedValue([makeUnitOwner("owner-1")]);
    mockPrisma.assembly.findUnique.mockResolvedValue({ propertyId: "prop-1" });
    mockPrisma.conferenceAuditLog.create.mockResolvedValue({});

    const result = await openSession(
      "asm-1", "prop-1", "admin-1",
      "¿Aprueba el presupuesto?", "simple", "unidad",
    );

    expect(mockPrisma.votingSession.create).toHaveBeenCalledOnce();
    expect(result.status).toBe("open");
    expect(result.question).toBe("¿Aprueba el presupuesto?");
  });

  it("lanza error 409 si ya hay una sesión abierta", async () => {
    mockPrisma.votingSession.findFirst.mockResolvedValue(makeVotingSession());

    await expect(
      openSession("asm-1", "prop-1", "admin-1", "Otra pregunta", "simple", "unidad"),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(mockPrisma.votingSession.create).not.toHaveBeenCalled();
  });
});

// ─── castVote ─────────────────────────────────────────────────────────────────

describe("castVote", () => {
  it("registra un voto válido con peso 1 (base: unidad)", async () => {
    setupCommonMocks();
    const newVote = makeVote({ voteValue: "yes" });
    mockPrisma.vote.create.mockResolvedValue(newVote);

    const result = await castVote("sess-1", "token-abc", "yes", "prop-1", "user-1");

    expect(mockPrisma.vote.create).toHaveBeenCalledOnce();
    expect(result.voteValue).toBe("yes");
    expect(result.success).toBe(true);
  });

  it("usa el coeficiente de la unidad cuando votingBasis = coeficientes", async () => {
    setupCommonMocks({ session: makeVotingSession({ votingBasis: "coeficientes" }) });
    const unit = makeUnit({ coefficient: 0.025 });
    mockPrisma.unit.findUnique.mockResolvedValue(unit);
    const newVote = makeVote({ weight: 0.025 });
    mockPrisma.vote.create.mockResolvedValue(newVote);

    await castVote("sess-1", "token-abc", "yes", "prop-1", "user-1");

    const createCall = mockPrisma.vote.create.mock.calls[0][0] as { data: { weight: number } };
    expect(createCall.data.weight).toBeCloseTo(0.025);
  });

  it("usa el módulo de contribución cuando votingBasis = modulos", async () => {
    setupCommonMocks({ session: makeVotingSession({ votingBasis: "modulos" }) });
    const unit = makeUnit({ contributionModule: 3 });
    mockPrisma.unit.findUnique.mockResolvedValue(unit);
    mockPrisma.vote.create.mockResolvedValue(makeVote({ weight: 3 }));

    await castVote("sess-1", "token-abc", "yes", "prop-1", "user-1");

    const createCall = mockPrisma.vote.create.mock.calls[0][0] as { data: { weight: number } };
    expect(createCall.data.weight).toBe(3);
  });

  it("rechaza 409 si la misma unidad intenta votar dos veces", async () => {
    setupCommonMocks({ existingVote: makeVote() });

    await expect(
      castVote("sess-1", "token-abc", "no", "prop-1", "user-1"),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(mockPrisma.vote.create).not.toHaveBeenCalled();
    // Debe registrar intento duplicado en auditoría
    expect(mockPrisma.conferenceAuditLog.create).toHaveBeenCalled();
  });

  it("rechaza 403 cuando la sesión está cerrada", async () => {
    setupCommonMocks({ session: makeVotingSession({ status: "closed" }) });

    await expect(
      castVote("sess-1", "token-abc", "yes", "prop-1", "user-1"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rechaza 403 con accessToken inválido", async () => {
    setupCommonMocks({ grant: null });
    mockPrisma.assemblyAccessGrant.findFirst.mockResolvedValue(null);

    await expect(
      castVote("sess-1", "invalid-token", "yes", "prop-1", "user-1"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rechaza 403 con accessToken de otra asamblea", async () => {
    // El grant tiene assemblyId diferente al de la sesión
    setupCommonMocks({ grant: makeGrant({ assemblyId: "asm-other" }) });

    await expect(
      castVote("sess-1", "token-abc", "yes", "prop-1", "user-1"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rechaza 403 cuando la unidad no tiene Owner con canVote=true", async () => {
    setupCommonMocks({ unitOwners: [makeUnitOwner("owner-1", false)] });

    await expect(
      castVote("sess-1", "token-abc", "yes", "prop-1", "user-1"),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(mockPrisma.conferenceAuditLog.create).toHaveBeenCalled();
  });

  it("rechaza 404 cuando la sesión no existe en la propiedad (multi-tenant)", async () => {
    // propertyId diferente al de la sesión — findFirst devuelve null
    mockPrisma.votingSession.findFirst.mockResolvedValue(null);

    await expect(
      castVote("sess-1", "token-abc", "yes", "prop-wrong", "user-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─── closeSession ─────────────────────────────────────────────────────────────

describe("closeSession", () => {
  it("cierra la sesión y calcula el resultado (mayoría simple)", async () => {
    setupCommonMocks();
    const votes = [
      makeVote({ voteValue: "yes", weight: 1 }),
      makeVote({ id: "v2", voteValue: "yes", weight: 1 }),
      makeVote({ id: "v3", voteValue: "no",  weight: 1 }),
    ];
    mockPrisma.vote.findMany.mockResolvedValue(votes);
    const closed = makeVotingSession({ status: "closed", yesCount: 2, noCount: 1, approved: true });
    mockPrisma.votingSession.update.mockResolvedValue(closed);

    const result = await closeSession("sess-1", "admin-1", "prop-1");

    expect(mockPrisma.votingSession.update).toHaveBeenCalledOnce();
    const updateArg = mockPrisma.votingSession.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateArg.data.status).toBe("closed");
    expect(updateArg.data.approved).toBe(true);
    expect(result.status).toBe("closed");
  });

  it("marca como NO aprobado cuando sí < no (regla simple)", async () => {
    setupCommonMocks();
    const votes = [
      makeVote({ voteValue: "yes", weight: 1 }),
      makeVote({ id: "v2", voteValue: "no",  weight: 1 }),
      makeVote({ id: "v3", voteValue: "no",  weight: 1 }),
    ];
    mockPrisma.vote.findMany.mockResolvedValue(votes);
    const closed = makeVotingSession({ status: "closed", approved: false });
    mockPrisma.votingSession.update.mockResolvedValue(closed);

    const result = await closeSession("sess-1", "admin-1", "prop-1");

    const updateArg = mockPrisma.votingSession.update.mock.calls[0][0] as { data: { approved: boolean } };
    expect(updateArg.data.approved).toBe(false);
    expect(result.approved).toBe(false);
  });

  it("aprueba solo si >= 2/3 (regla dos_tercios)", async () => {
    setupCommonMocks({ session: makeVotingSession({ votingRule: "dos_tercios" }) });
    // 2 sí / 1 no = 66.6%, no alcanza 2/3 exacto
    const votes = [
      makeVote({ voteValue: "yes", weight: 2 }),
      makeVote({ id: "v2", voteValue: "no", weight: 1 }),
    ];
    mockPrisma.vote.findMany.mockResolvedValue(votes);
    const closed = makeVotingSession({ status: "closed", approved: false });
    mockPrisma.votingSession.update.mockResolvedValue(closed);

    await closeSession("sess-1", "admin-1", "prop-1");

    const updateArg = mockPrisma.votingSession.update.mock.calls[0][0] as { data: { approved: boolean } };
    // 2 / (2+1) = 0.666... no es >= 2/3 exacto (0.666...)
    // En realidad 2/3 exacto sí debería pasar — comprobamos la lógica real
    // 2/3 = 0.6666..., >= 2/3 = 0.6666... → true (es exactamente 2/3)
    expect(updateArg.data.approved).toBe(true);
  });

  it("rechaza unanimidad si hay cualquier voto negativo", async () => {
    setupCommonMocks({ session: makeVotingSession({ votingRule: "unanimidad" }) });
    const votes = [
      makeVote({ voteValue: "yes", weight: 1 }),
      makeVote({ id: "v2", voteValue: "yes", weight: 1 }),
      makeVote({ id: "v3", voteValue: "no",  weight: 1 }),
    ];
    mockPrisma.vote.findMany.mockResolvedValue(votes);
    const closed = makeVotingSession({ status: "closed", approved: false });
    mockPrisma.votingSession.update.mockResolvedValue(closed);

    await closeSession("sess-1", "admin-1", "prop-1");

    const updateArg = mockPrisma.votingSession.update.mock.calls[0][0] as { data: { approved: boolean } };
    expect(updateArg.data.approved).toBe(false);
  });

  it("rechaza 409 si la sesión ya está cerrada", async () => {
    setupCommonMocks({ session: makeVotingSession({ status: "closed" }) });

    await expect(
      closeSession("sess-1", "admin-1", "prop-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rechaza 404 si la sesión no pertenece a la propiedad (multi-tenant)", async () => {
    mockPrisma.votingSession.findFirst.mockResolvedValue(null);

    await expect(
      closeSession("sess-1", "admin-1", "prop-wrong"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─── getActiveSession ─────────────────────────────────────────────────────────

describe("getActiveSession", () => {
  it("devuelve la sesión abierta si existe", async () => {
    setupCommonMocks();
    mockPrisma.vote.findMany.mockResolvedValue([]);
    mockPrisma.assemblyAccessGrant.findMany.mockResolvedValue([makeGrant()]);

    const result = await getActiveSession("asm-1", "prop-1");

    expect(result).not.toBeNull();
    expect(result?.status).toBe("open");
  });

  it("devuelve null si no hay sesión abierta", async () => {
    mockPrisma.votingSession.findFirst.mockResolvedValue(null);

    const result = await getActiveSession("asm-1", "prop-1");

    expect(result).toBeNull();
  });
});

// ─── getMyVote ────────────────────────────────────────────────────────────────

describe("getMyVote", () => {
  it("devuelve el voto del asistente si existe", async () => {
    mockPrisma.assemblyAccessGrant.findFirst.mockResolvedValue(makeGrant());
    mockPrisma.vote.findFirst.mockResolvedValue(makeVote({ voteValue: "no" }));

    const result = await getMyVote("sess-1", "token-abc", "asm-1");

    expect(result.voteValue).toBe("no");
    expect(result.unitId).toBe("unit-1");
  });

  it("devuelve null si el asistente no ha votado", async () => {
    mockPrisma.assemblyAccessGrant.findFirst.mockResolvedValue(makeGrant());
    mockPrisma.vote.findFirst.mockResolvedValue(null);

    const result = await getMyVote("sess-1", "token-abc", "asm-1");

    expect(result.voteValue).toBeNull();
  });

  it("devuelve null si el accessToken es inválido", async () => {
    mockPrisma.assemblyAccessGrant.findFirst.mockResolvedValue(null);

    const result = await getMyVote("sess-1", "invalid", "asm-1");

    expect(result.voteValue).toBeNull();
    expect(result.unitId).toBeNull();
  });
});

// ─── cancelSession ────────────────────────────────────────────────────────────

describe("cancelSession", () => {
  it("cancela una sesión abierta", async () => {
    setupCommonMocks();
    mockPrisma.votingSession.update.mockResolvedValue(makeVotingSession({ status: "cancelled" }));

    await cancelSession("sess-1", "admin-1", "prop-1");

    const updateArg = mockPrisma.votingSession.update.mock.calls[0][0] as { data: { status: string } };
    expect(updateArg.data.status).toBe("cancelled");
  });

  it("rechaza 404 si la sesión no está abierta o no pertenece a la propiedad", async () => {
    mockPrisma.votingSession.findFirst.mockResolvedValue(null);

    await expect(
      cancelSession("sess-1", "admin-1", "prop-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─── Invariantes de aislamiento multi-tenant ─────────────────────────────────

describe("Aislamiento multi-tenant", () => {
  it("castVote rechaza si la sesión existe pero en otra propiedad", async () => {
    mockPrisma.votingSession.findFirst.mockResolvedValue(null); // no existe para prop-other

    await expect(
      castVote("sess-1", "token-abc", "yes", "prop-other", "user-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("closeSession rechaza si la sesión existe pero en otra propiedad", async () => {
    mockPrisma.votingSession.findFirst.mockResolvedValue(null);

    await expect(
      closeSession("sess-1", "admin-1", "prop-other"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("cancelSession rechaza si la sesión existe pero en otra propiedad", async () => {
    mockPrisma.votingSession.findFirst.mockResolvedValue(null);

    await expect(
      cancelSession("sess-1", "admin-1", "prop-other"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
