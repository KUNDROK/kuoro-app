import {
  findAssemblyById,
  findPropertyById,
  listAgendaItemsByAssembly,
  listAssembliesByProperty,
  listAssemblyAccessGrantsByAssembly,
  listAssemblyInvitationsByAssembly,
  listPropertiesByAdmin,
  listVoteResultsByAssembly,
} from "../../db";
import { getAuditLog } from "../speakerQueue";
import { listAssemblyRepresentations } from "../representation";
import { prisma } from "../../lib/prisma";

type AssistantOwnerRow = {
  id: string;
  fullName: string;
  documentType: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  participationRole: string;
  canVote: boolean;
  receivesInvitations: boolean;
  proxyApprovalStatus: string;
};

type AssistantUnitOwnerRow = {
  isPrimary: boolean;
  ownershipPercentage: number | null;
  owner: AssistantOwnerRow;
};

type AssistantUnitRow = {
  id: string;
  unitType: string;
  groupingLabel: string;
  unitNumber: string;
  floor: string | null;
  destination: string;
  coefficient: number | null;
  contributionModule: number | null;
  unitOwners: AssistantUnitOwnerRow[];
};

async function assertPropertyForAdmin(adminId: string, propertyId: string) {
  const property = await findPropertyById(propertyId);
  if (!property || property.adminId !== adminId) {
    return null;
  }
  return property;
}

async function assertAssemblyForAdmin(adminId: string, assemblyId: string) {
  const assembly = await findAssemblyById(assemblyId);
  if (!assembly) return null;
  const property = await findPropertyById(assembly.propertyId);
  if (!property || property.adminId !== adminId) return null;
  return { assembly, property };
}

export async function executeAdminAssistantTool(
  adminId: string,
  name: string,
  rawArgs: string,
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    const parsed = rawArgs?.trim() ? JSON.parse(rawArgs) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      args = parsed as Record<string, unknown>;
    }
  } catch {
    return JSON.stringify({ error: "Argumentos JSON inválidos para la herramienta" });
  }

  try {
    switch (name) {
      case "list_my_properties": {
        const rows = await listPropertiesByAdmin(adminId);
        return JSON.stringify({
          properties: rows.map((p) => ({
            id: p.id,
            name: p.name,
            city: p.city,
            address: p.address,
            totalUnits: p.totalUnits,
            operationalStatus: p.operationalStatus,
          })),
        });
      }

      case "get_units_and_owners": {
        const propertyId = typeof args.propertyId === "string" ? args.propertyId : "";
        if (!propertyId) return JSON.stringify({ error: "propertyId requerido" });
        const property = await assertPropertyForAdmin(adminId, propertyId);
        if (!property) return JSON.stringify({ error: "Sin acceso a esta copropiedad" });

        const units = (await prisma.unit.findMany({
          where: { propertyId },
          orderBy: [{ groupingLabel: "asc" }, { unitNumber: "asc" }],
          select: {
            id: true,
            unitType: true,
            groupingLabel: true,
            unitNumber: true,
            floor: true,
            destination: true,
            coefficient: true,
            contributionModule: true,
            unitOwners: {
              select: {
                isPrimary: true,
                ownershipPercentage: true,
                owner: {
                  select: {
                    id: true,
                    fullName: true,
                    documentType: true,
                    document: true,
                    email: true,
                    phone: true,
                    participationRole: true,
                    canVote: true,
                    receivesInvitations: true,
                    proxyApprovalStatus: true,
                  },
                },
              },
            },
          },
        })) as AssistantUnitRow[];

        return JSON.stringify({
          propertyId,
          propertyName: property.name,
          units: units.map((u) => ({
            unitId: u.id,
            label: [u.groupingLabel, u.unitNumber].filter(Boolean).join(" "),
            unitType: u.unitType,
            destination: u.destination,
            floor: u.floor,
            coefficient: u.coefficient,
            contributionModule: u.contributionModule,
            owners: u.unitOwners.map((uo) => ({
              ...uo.owner,
              isPrimary: uo.isPrimary,
              ownershipPercentage: uo.ownershipPercentage,
            })),
          })),
        });
      }

      case "list_assemblies_for_property": {
        const propertyId = typeof args.propertyId === "string" ? args.propertyId : "";
        if (!propertyId) return JSON.stringify({ error: "propertyId requerido" });
        const property = await assertPropertyForAdmin(adminId, propertyId);
        if (!property) return JSON.stringify({ error: "Sin acceso a esta copropiedad" });
        const assemblies = await listAssembliesByProperty(propertyId);
        return JSON.stringify({
          assemblies: assemblies.map((a) => ({
            id: a.id,
            title: a.title,
            type: a.type,
            modality: a.modality,
            status: a.status,
            scheduledAt: a.scheduledAt,
            votingBasis: a.votingBasis,
            conferenceService: a.conferenceService,
          })),
        });
      }

      case "get_assembly_overview": {
        const assemblyId = typeof args.assemblyId === "string" ? args.assemblyId : "";
        if (!assemblyId) return JSON.stringify({ error: "assemblyId requerido" });
        const ctx = await assertAssemblyForAdmin(adminId, assemblyId);
        if (!ctx) return JSON.stringify({ error: "Sin acceso a esta asamblea" });
        const { assembly, property } = ctx;
        const notes =
          assembly.notes && assembly.notes.length > 600
            ? `${assembly.notes.slice(0, 600)}…`
            : assembly.notes;
        return JSON.stringify({
          assemblyId: assembly.id,
          propertyId: property.id,
          propertyName: property.name,
          title: assembly.title,
          type: assembly.type,
          modality: assembly.modality,
          status: assembly.status,
          scheduledAt: assembly.scheduledAt,
          votingBasis: assembly.votingBasis,
          conferenceService: assembly.conferenceService,
          location: assembly.location,
          virtualAccessUrl: assembly.virtualAccessUrl,
          allowsSecondCall: assembly.allowsSecondCall,
          secondCallScheduledAt: assembly.secondCallScheduledAt,
          notes,
        });
      }

      case "get_assembly_agenda": {
        const assemblyId = typeof args.assemblyId === "string" ? args.assemblyId : "";
        if (!assemblyId) return JSON.stringify({ error: "assemblyId requerido" });
        const ctx = await assertAssemblyForAdmin(adminId, assemblyId);
        if (!ctx) return JSON.stringify({ error: "Sin acceso a esta asamblea" });
        const items = await listAgendaItemsByAssembly(assemblyId);
        return JSON.stringify({
          assemblyId,
          agendaItems: items.map((it) => ({
            order: it.order,
            title: it.title,
            description: it.description,
            slideTitle: it.slideTitle,
            slideContent: it.slideContent,
            speakerNotes: it.speakerNotes,
            votePrompt: it.votePrompt,
            type: it.type,
            votingRule: it.votingRule,
            requiresAttachment: it.requiresAttachment,
            status: it.status,
          })),
        });
      }

      case "get_conference_audience_snapshot": {
        const assemblyId = typeof args.assemblyId === "string" ? args.assemblyId : "";
        if (!assemblyId) return JSON.stringify({ error: "assemblyId requerido" });
        const ctx = await assertAssemblyForAdmin(adminId, assemblyId);
        if (!ctx) return JSON.stringify({ error: "Sin acceso a esta asamblea" });

        const logs = await getAuditLog(assemblyId, 200);
        const joinLeave = logs.filter((l) =>
          ["participant_joined", "participant_left", "room_admin_joined"].includes(l.eventType),
        );

        const lastByIdentity = new Map<
          string,
          { eventType: string; participantName: string | null; occurredAt: string }
        >();
        for (const row of joinLeave) {
          const id = row.participantIdentity ?? row.participantName ?? row.id;
          const prev = lastByIdentity.get(id);
          if (!prev || row.occurredAt > prev.occurredAt) {
            lastByIdentity.set(id, {
              eventType: row.eventType,
              participantName: row.participantName,
              occurredAt: row.occurredAt,
            });
          }
        }

        const snapshot = [...lastByIdentity.entries()].map(([identity, v]) => ({
          identity,
          displayName: v.participantName,
          lastRoomEvent: v.eventType,
          lastRoomEventAt: v.occurredAt,
        }));

        return JSON.stringify({
          assemblyId,
          note:
            "Eventos de sala (LiveKit/auditoría). No sustituye lista legal de asistentes ni acta firmada.",
          recentAuditEvents: joinLeave.slice(0, 40),
          latestPerParticipant: snapshot,
        });
      }

      case "get_assembly_invitations_and_access": {
        const assemblyId = typeof args.assemblyId === "string" ? args.assemblyId : "";
        if (!assemblyId) return JSON.stringify({ error: "assemblyId requerido" });
        const ctx = await assertAssemblyForAdmin(adminId, assemblyId);
        if (!ctx) return JSON.stringify({ error: "Sin acceso a esta asamblea" });

        const [invitations, grants] = await Promise.all([
          listAssemblyInvitationsByAssembly(assemblyId),
          listAssemblyAccessGrantsByAssembly(assemblyId),
        ]);

        return JSON.stringify({
          assemblyId,
          invitations: invitations.map((i) => ({
            unitId: i.unitId,
            sentAt: i.sentAt,
            channel: i.channel,
            status: i.status,
            note: i.note,
          })),
          accessGrants: grants,
        });
      }

      case "get_assembly_vote_results": {
        const assemblyId = typeof args.assemblyId === "string" ? args.assemblyId : "";
        if (!assemblyId) return JSON.stringify({ error: "assemblyId requerido" });
        const ctx = await assertAssemblyForAdmin(adminId, assemblyId);
        if (!ctx) return JSON.stringify({ error: "Sin acceso a esta asamblea" });
        const results = await listVoteResultsByAssembly(assemblyId);
        return JSON.stringify({ assemblyId, voteResults: results });
      }

      case "list_assembly_representations": {
        const assemblyId = typeof args.assemblyId === "string" ? args.assemblyId : "";
        if (!assemblyId) return JSON.stringify({ error: "assemblyId requerido" });
        const ctx = await assertAssemblyForAdmin(adminId, assemblyId);
        if (!ctx) return JSON.stringify({ error: "Sin acceso a esta asamblea" });
        const reps = await listAssemblyRepresentations(assemblyId, ctx.property.id);
        const safe = reps.map((r) => {
          const { accessToken: _a, ...rest } = r;
          return rest;
        });
        return JSON.stringify({ assemblyId, representations: safe });
      }

      default:
        return JSON.stringify({ error: `Herramienta desconocida: ${name}` });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error ejecutando herramienta";
    return JSON.stringify({ error: message });
  }
}

export const ADMIN_ASSISTANT_OPENAI_TOOLS: Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> = [
  {
    type: "function",
    function: {
      name: "list_my_properties",
      description: "Lista las copropiedades que administra el usuario autenticado.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_units_and_owners",
      description:
        "Unidades de una copropiedad con sus propietarios/apoderados (sin documentos binarios).",
      parameters: {
        type: "object",
        properties: {
          propertyId: { type: "string", description: "ID de la copropiedad" },
        },
        required: ["propertyId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_assemblies_for_property",
      description: "Lista asambleas de una copropiedad con estado y fecha programada.",
      parameters: {
        type: "object",
        properties: { propertyId: { type: "string" } },
        required: ["propertyId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_assembly_overview",
      description: "Resumen de configuración de una asamblea (tipo, modalidad, estado, horario, servicio de conferencia).",
      parameters: {
        type: "object",
        properties: { assemblyId: { type: "string" } },
        required: ["assemblyId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_assembly_agenda",
      description:
        "Orden del día / presentación: puntos con campos de diapositiva y votación si existen.",
      parameters: {
        type: "object",
        properties: { assemblyId: { type: "string" } },
        required: ["assemblyId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_conference_audience_snapshot",
      description:
        "Eventos recientes de sala (entradas/salidas) desde auditoría de conferencia; ayuda a inferir quién se conectó, sin ser acta legal.",
      parameters: {
        type: "object",
        properties: { assemblyId: { type: "string" } },
        required: ["assemblyId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_assembly_invitations_and_access",
      description: "Invitaciones por unidad y grants de acceso (sin tokens sensibles).",
      parameters: {
        type: "object",
        properties: { assemblyId: { type: "string" } },
        required: ["assemblyId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_assembly_vote_results",
      description: "Resultados de votaciones cerradas registrados para la asamblea.",
      parameters: {
        type: "object",
        properties: { assemblyId: { type: "string" } },
        required: ["assemblyId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_assembly_representations",
      description: "Representaciones y poderes formales por unidad en una asamblea (sin tokens de acceso).",
      parameters: {
        type: "object",
        properties: { assemblyId: { type: "string" } },
        required: ["assemblyId"],
        additionalProperties: false,
      },
    },
  },
];
