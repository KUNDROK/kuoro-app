/**
 * Tests unitarios para el servicio de representación de voto.
 *
 * Casos cubiertos:
 *  1.  Propietario directo con canVote=true → seedRepresentations crea representación owner
 *  2.  Apoderado aprobado → seedRepresentations crea representación proxy
 *  3.  Propietario con canVote=false → no se genera representación
 *  4.  Seed idempotente (ya existe representación activa → skipped++)
 *  5.  createProxyRepresentation crea representación correctamente
 *  6.  createProxyRepresentation: conflicto (unidad ya tiene activa) → 409
 *  7.  createProxyRepresentation con sharedAccessToken reutiliza token
 *  8.  createProxyRepresentation con sharedAccessToken inválido → 400
 *  9.  getRepresentationsByToken devuelve solo representaciones activas del token
 * 10.  getRepresentedUnitsWithVoteStatus marca alreadyVoted correctamente
 * 11.  revokeRepresentation cambia status a "revoked"
 * 12.  revokeRepresentation en representación ya revocada → 409
 * 13.  resolveRepresentation devuelve null si token no cubre unitId
 * 14.  resolveRepresentation devuelve null si representación revocada
 * 15.  Aislamiento multi-tenant: representaciones de otra asamblea no se exponen
 * 16.  castVote con representación: registra representationId + representationType
 * 17.  castVote: representación de unidad equivocada → 403
 * 18.  castVote: doble voto bloqueado incluso con representación diferente
 * 19.  Auditoría: seed genera ConferenceAuditLog
 * 20.  Auditoría: revokeRepresentation genera ConferenceAuditLog
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Factories ────────────────────────────────────────────────────────────────

const makeAssembly = (overrides: Record<string, unknown> = {}) => ({
  id:         "asm-1",
  propertyId: "prop-1",
  votingBasis: "unidad",
  status:      "in_progress",
  ...overrides,
});

const makeUnit = (overrides: Record<string, unknown> = {}) => ({
  id:                 "unit-1",
  propertyId:         "prop-1",
  unitType:           "apartamento",
  groupingKind:       "Torre",
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

const makeOwner = (overrides: Record<string, unknown> = {}) => ({
  id:                   "owner-1",
  propertyId:           "prop-1",
  fullName:             "Carlos Díaz",
  documentType:         "CC",
  email:                "carlos@example.com",
  phone:                null,
  document:             "12345678",
  participationRole:    "propietario",
  canVote:              true,
  receivesInvitations:  true,
  proxyDocumentName:    null,
  proxyDocumentMimeType: null,
  proxyDocumentData:    null,
  proxyApprovalStatus:  "none",
  proxyRequestToken:    null,
  proxyRequestedAt:     null,
  proxyLastSubmittedAt: null,
  proxySubmittedByName: null,
  proxySubmittedByEmail: null,
  proxySubmittedByRole: null,
  proxyRejectionReasons: [],
  proxyRejectionNote:   null,
  createdAt:            new Date(),
  ...overrides,
});

const makeUnitOwner = (overrides: Record<string, unknown> = {}) => ({
  id:                  "uo-1",
  unitId:              "unit-1",
  ownerId:             "owner-1",
  isPrimary:           true,
  ownershipPercentage: 100,
  createdAt:           new Date(),
  owner:               makeOwner(),
  ...overrides,
});

const makeRepresentation = (overrides: Record<string, unknown> = {}) => ({
  id:                    "rep-1",
  propertyId:            "prop-1",
  assemblyId:            "asm-1",
  representedUnitId:     "unit-1",
  representativeOwnerId: "owner-1",
  representativeFullName: "Carlos Díaz",
  representativeEmail:   "carlos@example.com",
  representationType:    "owner",
  principalOwnerId:      null,
  canVote:               true,
  weight:                1,
  votingBasis:           "unidad",
  proofDocumentRef:      null,
  notes:                 null,
  status:                "active",
  accessToken:           "token-rep-1",
  createdAt:             new Date(),
  updatedAt:             new Date(),
  representedUnit: makeUnit(),
  ...overrides,
});

const makeGrant = (overrides: Record<string, unknown> = {}) => ({
  id:          "grant-1",
  assemblyId:  "asm-1",
  unitId:      "unit-1",
  accessToken: "token-grant-1",
  ...overrides,
});

const makeVotingSession = (overrides: Record<string, unknown> = {}) => ({
  id:             "sess-1",
  assemblyId:     "asm-1",
  propertyId:     "prop-1",
  question:       "¿Aprueba el presupuesto?",
  votingRule:     "simple",
  votingBasis:    "unidad",
  status:         "open",
  openedAt:       new Date(),
  closedAt:       null,
  openedByAdminId: "admin-1",
  ...overrides,
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
  accessGrantId:       null,
  representationId:    "rep-1",
  representationType:  "owner",
  ...overrides,
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  assembly:               { findUnique: vi.fn() },
  unit:                   { findUnique: vi.fn(), findFirst: vi.fn() },
  unitOwner:              { findMany: vi.fn() },
  assemblyAccessGrant:    { findMany: vi.fn(), findFirst: vi.fn() },
  assemblyRepresentation: {
    findFirst:  vi.fn(),
    findMany:   vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
    count:      vi.fn(),
  },
  vote: {
    findFirst:  vi.fn(),
    findMany:   vi.fn(),
    create:     vi.fn(),
  },
  votingSession: {
    findFirst:  vi.fn(),
    findUnique: vi.fn(),
    findMany:   vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
  },
  conferenceAuditLog: { create: vi.fn() },
};

vi.mock("../lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const {
  seedRepresentationsForAssembly,
  createProxyRepresentation,
  getRepresentationsByToken,
  getRepresentedUnitsWithVoteStatus,
  revokeRepresentation,
  resolveRepresentation,
  listAssemblyRepresentations,
} = await import("./representation");

const { castVote } = await import("./voting");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetMocks() {
  vi.clearAllMocks();
  mockPrisma.conferenceAuditLog.create.mockResolvedValue({});
  mockPrisma.assembly.findUnique.mockResolvedValue(makeAssembly());
  mockPrisma.unit.findUnique.mockResolvedValue(makeUnit());
  mockPrisma.unit.findFirst.mockResolvedValue(makeUnit());
  mockPrisma.unitOwner.findMany.mockResolvedValue([makeUnitOwner()]);
  mockPrisma.assemblyAccessGrant.findMany.mockResolvedValue([makeGrant()]);
  mockPrisma.assemblyAccessGrant.findFirst.mockResolvedValue(makeGrant());
  mockPrisma.assemblyRepresentation.findFirst.mockResolvedValue(null);
  mockPrisma.assemblyRepresentation.findMany.mockResolvedValue([]);
  mockPrisma.assemblyRepresentation.create.mockResolvedValue(makeRepresentation());
  mockPrisma.assemblyRepresentation.update.mockResolvedValue({ ...makeRepresentation(), status: "revoked" });
  mockPrisma.assemblyRepresentation.count.mockResolvedValue(0);
  mockPrisma.vote.findFirst.mockResolvedValue(null);
  mockPrisma.vote.findMany.mockResolvedValue([]);
  mockPrisma.vote.create.mockResolvedValue(makeVote());
  mockPrisma.votingSession.findFirst.mockResolvedValue(makeVotingSession());
  mockPrisma.votingSession.findUnique.mockResolvedValue(makeVotingSession());
  mockPrisma.votingSession.findMany.mockResolvedValue([]);
  mockPrisma.votingSession.create.mockResolvedValue(makeVotingSession());
  mockPrisma.votingSession.update.mockResolvedValue(makeVotingSession({ status: "closed" }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("seedRepresentationsForAssembly", () => {
  beforeEach(resetMocks);

  it("1. Propietario directo con canVote=true genera representación owner", async () => {
    mockPrisma.assemblyRepresentation.findFirst.mockResolvedValue(null);
    mockPrisma.assemblyRepresentation.create.mockResolvedValue(
      makeRepresentation({ representationType: "owner" }),
    );

    const result = await seedRepresentationsForAssembly("asm-1", "prop-1", "admin-1");

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockPrisma.assemblyRepresentation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ representationType: "owner" }),
      }),
    );
  });

  it("2. Apoderado aprobado genera representación proxy", async () => {
    const proxyOwner = makeOwner({
      id:                "proxy-owner-1",
      participationRole: "apoderado",
      proxyApprovalStatus: "approved",
      canVote:           true,
    });
    const directOwner = makeOwner({ id: "direct-owner-1" });

    mockPrisma.unitOwner.findMany.mockResolvedValue([
      makeUnitOwner({ ownerId: "direct-owner-1", owner: directOwner }),
      makeUnitOwner({ id: "uo-2", ownerId: "proxy-owner-1", isPrimary: false, owner: proxyOwner }),
    ]);

    const result = await seedRepresentationsForAssembly("asm-1", "prop-1", "admin-1");

    expect(result.created).toBe(1);
    expect(mockPrisma.assemblyRepresentation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          representationType: "proxy",
          representativeOwnerId: "proxy-owner-1",
          principalOwnerId: "direct-owner-1",
        }),
      }),
    );
  });

  it("3. Propietario con canVote=false no genera representación", async () => {
    const owner = makeOwner({ canVote: false });
    mockPrisma.unitOwner.findMany.mockResolvedValue([
      makeUnitOwner({ owner }),
    ]);

    const result = await seedRepresentationsForAssembly("asm-1", "prop-1", "admin-1");

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockPrisma.assemblyRepresentation.create).not.toHaveBeenCalled();
  });

  it("4. Seed idempotente: unidad con representación activa es omitida", async () => {
    mockPrisma.assemblyRepresentation.findFirst.mockResolvedValue(makeRepresentation());

    const result = await seedRepresentationsForAssembly("asm-1", "prop-1", "admin-1");

    expect(result.skipped).toBe(1);
    expect(result.created).toBe(0);
    expect(mockPrisma.assemblyRepresentation.create).not.toHaveBeenCalled();
  });

  it("19. Seed genera entrada en ConferenceAuditLog", async () => {
    await seedRepresentationsForAssembly("asm-1", "prop-1", "admin-1");
    expect(mockPrisma.conferenceAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "representation_seed" }),
      }),
    );
  });
});

describe("createProxyRepresentation", () => {
  beforeEach(resetMocks);

  it("5. Crea representación de apoderado correctamente", async () => {
    const created = makeRepresentation({
      representationType: "proxy",
      representativeFullName: "María Apoderada",
    });
    mockPrisma.assemblyRepresentation.create.mockResolvedValue(created);

    const result = await createProxyRepresentation(
      "asm-1",
      "prop-1",
      {
        representedUnitId:      "unit-1",
        representativeFullName: "María Apoderada",
      },
      "admin-1",
    );

    expect(result.representationType).toBe("proxy");
    expect(mockPrisma.assemblyRepresentation.create).toHaveBeenCalled();
  });

  it("6. Conflicto: unidad ya tiene representación activa → 409", async () => {
    mockPrisma.assemblyRepresentation.findFirst.mockResolvedValue(makeRepresentation());

    await expect(
      createProxyRepresentation("asm-1", "prop-1", {
        representedUnitId:      "unit-1",
        representativeFullName: "Otro",
      }, "admin-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("7. sharedAccessToken válido: reutiliza el token existente", async () => {
    // Primero findFirst para "ya existe activa"
    mockPrisma.assemblyRepresentation.findFirst
      .mockResolvedValueOnce(null)        // no existe para la unidad
      .mockResolvedValueOnce(makeRepresentation({ accessToken: "shared-token" })); // existe con ese token

    await createProxyRepresentation("asm-1", "prop-1", {
      representedUnitId:      "unit-1",
      representativeFullName: "Otro",
      sharedAccessToken:      "shared-token",
    }, "admin-1");

    expect(mockPrisma.assemblyRepresentation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accessToken: "shared-token" }),
      }),
    );
  });

  it("8. sharedAccessToken inválido → 400", async () => {
    mockPrisma.assemblyRepresentation.findFirst
      .mockResolvedValueOnce(null)  // no existe para la unidad
      .mockResolvedValueOnce(null); // token no encontrado

    await expect(
      createProxyRepresentation("asm-1", "prop-1", {
        representedUnitId:      "unit-1",
        representativeFullName: "Alguien",
        sharedAccessToken:      "bad-token",
      }, "admin-1"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("getRepresentationsByToken", () => {
  beforeEach(resetMocks);

  it("9. Devuelve solo representaciones activas del token", async () => {
    const reps = [
      makeRepresentation({ id: "rep-1", status: "active" }),
    ];
    mockPrisma.assemblyRepresentation.findMany.mockResolvedValue(reps);

    const result = await getRepresentationsByToken("token-rep-1", "asm-1");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("rep-1");
    expect(mockPrisma.assemblyRepresentation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "active", accessToken: "token-rep-1" }),
      }),
    );
  });
});

describe("getRepresentedUnitsWithVoteStatus", () => {
  beforeEach(resetMocks);

  it("10. Marca alreadyVoted=true cuando existe un Vote para esa unidad", async () => {
    mockPrisma.votingSession.findFirst.mockResolvedValue(makeVotingSession());
    mockPrisma.assemblyRepresentation.findMany.mockResolvedValue([
      makeRepresentation(),
    ]);
    mockPrisma.vote.findFirst.mockResolvedValue(makeVote({ voteValue: "yes" }));

    const result = await getRepresentedUnitsWithVoteStatus("token-rep-1", "asm-1", "sess-1");

    expect(result.units).toHaveLength(1);
    expect(result.units[0].alreadyVoted).toBe(true);
    expect(result.units[0].myVote).toBe("yes");
  });

  it("10b. Marca alreadyVoted=false si no hay voto", async () => {
    mockPrisma.votingSession.findFirst.mockResolvedValue(makeVotingSession());
    mockPrisma.assemblyRepresentation.findMany.mockResolvedValue([makeRepresentation()]);
    mockPrisma.vote.findFirst.mockResolvedValue(null);

    const result = await getRepresentedUnitsWithVoteStatus("token-rep-1", "asm-1", "sess-1");

    expect(result.units[0].alreadyVoted).toBe(false);
    expect(result.units[0].myVote).toBeUndefined();
  });
});

describe("revokeRepresentation", () => {
  beforeEach(resetMocks);

  it("11. Cambia status a revoked", async () => {
    mockPrisma.assemblyRepresentation.findFirst.mockResolvedValue(makeRepresentation());

    await revokeRepresentation("rep-1", "asm-1", "prop-1", "admin-1");

    expect(mockPrisma.assemblyRepresentation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rep-1" },
        data:  { status: "revoked" },
      }),
    );
  });

  it("12. Representación ya revocada → 409", async () => {
    mockPrisma.assemblyRepresentation.findFirst.mockResolvedValue(
      makeRepresentation({ status: "revoked" }),
    );

    await expect(
      revokeRepresentation("rep-1", "asm-1", "prop-1", "admin-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("20. Genera entrada de auditoría al revocar", async () => {
    mockPrisma.assemblyRepresentation.findFirst.mockResolvedValue(makeRepresentation());

    await revokeRepresentation("rep-1", "asm-1", "prop-1", "admin-1");

    expect(mockPrisma.conferenceAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "representation_revoked" }),
      }),
    );
  });
});

describe("resolveRepresentation", () => {
  beforeEach(resetMocks);

  it("13. Devuelve null si token no cubre unitId", async () => {
    mockPrisma.assemblyRepresentation.findFirst.mockResolvedValue(null);

    const result = await resolveRepresentation("token-rep-1", "asm-1", "unit-99");
    expect(result).toBeNull();
  });

  it("14. Devuelve null si representación revocada (findFirst con status=active retorna null)", async () => {
    mockPrisma.assemblyRepresentation.findFirst.mockResolvedValue(null);

    const result = await resolveRepresentation("token-rep-1", "asm-1", "unit-1");
    expect(result).toBeNull();
  });

  it("Devuelve el objeto de representación cuando es activa y válida", async () => {
    mockPrisma.assemblyRepresentation.findFirst.mockResolvedValue(makeRepresentation());

    const result = await resolveRepresentation("token-rep-1", "asm-1", "unit-1");
    expect(result).not.toBeNull();
    expect(result!.representationType).toBe("owner");
    expect(result!.weight).toBe(1);
  });
});

describe("listAssemblyRepresentations", () => {
  beforeEach(resetMocks);

  it("15. Aislamiento multi-tenant: solo representaciones de la asamblea correcta", async () => {
    const reps = [makeRepresentation()];
    mockPrisma.assemblyRepresentation.findMany.mockResolvedValue(reps);

    const result = await listAssemblyRepresentations("asm-1", "prop-1");

    expect(mockPrisma.assemblyRepresentation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assemblyId: "asm-1", propertyId: "prop-1" }),
      }),
    );
    expect(result).toHaveLength(1);
  });
});

describe("castVote — ruta de representación", () => {
  beforeEach(resetMocks);

  it("16. castVote con representación registra representationId y representationType", async () => {
    mockPrisma.assemblyRepresentation.findFirst.mockResolvedValue(makeRepresentation());

    await castVote("sess-1", "token-rep-1", "yes", "prop-1", "user-1", "unit-1");

    expect(mockPrisma.vote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          representationId:    "rep-1",
          representationType:  "owner",
        }),
      }),
    );
  });

  it("17. castVote: token no cubre unitId indicado → 403", async () => {
    mockPrisma.assemblyRepresentation.findFirst.mockResolvedValue(null);
    mockPrisma.assemblyAccessGrant.findFirst.mockResolvedValue(makeGrant({ unitId: "unit-1" }));

    // El token del grant cubre unit-1 pero pedimos votar por unit-99
    await expect(
      castVote("sess-1", "token-grant-1", "yes", "prop-1", "user-1", "unit-99"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("18. Doble voto bloqueado aunque el representante cambie", async () => {
    // La representación es válida
    mockPrisma.assemblyRepresentation.findFirst.mockResolvedValue(makeRepresentation());
    // Pero ya existe un voto para esa unidad
    mockPrisma.vote.findFirst.mockResolvedValue(makeVote());

    await expect(
      castVote("sess-1", "token-rep-1", "yes", "prop-1", "user-1", "unit-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
