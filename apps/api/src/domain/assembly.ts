import type {
  AgendaStatus,
  AssemblyDashboardSummary,
  AssemblyOverview,
  AssemblyReadinessSummary,
  AssemblyStatus,
  LiveVoteResult
} from "@kuoro/contracts";

type AgendaItem = {
  id: string;
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
  status: AgendaStatus;
};

const defaultAgenda: AgendaItem[] = [
  {
    id: "1",
    title: "Verificacion de quorum",
    description: "Confirma la base de participacion antes de iniciar decisiones.",
    slideTitle: "Verificacion de quorum",
    slideContent: "Confirmamos la base de participacion para iniciar la asamblea.",
    speakerNotes: "Explica rapidamente la base de calculo y deja constancia antes de continuar.",
    type: "informativo",
    votingRule: "ninguna",
    requiresAttachment: false,
    order: 1,
    status: "completed"
  },
  {
    id: "2",
    title: "Aprobacion de la ruta de la reunion",
    description: "Presenta la ruta de la reunion y abre votacion si corresponde.",
    slideTitle: "Ruta de la asamblea",
    slideContent: "Presentamos el recorrido de la reunion y sometemos a aprobacion la secuencia propuesta.",
    speakerNotes: "Lee los puntos principales antes de abrir la votacion.",
    votePrompt: "Aprueba la ruta propuesta para la asamblea?",
    type: "votacion",
    votingRule: "simple",
    requiresAttachment: false,
    order: 2,
    status: "active"
  },
  {
    id: "3",
    title: "Eleccion del consejo",
    description: "Explica candidatos o planchas y prepara el momento de votacion.",
    slideTitle: "Eleccion del consejo",
    slideContent: "Presentamos las opciones disponibles y abrimos el momento de eleccion.",
    speakerNotes: "Aclara reglas, opciones y tiempo de votacion.",
    votePrompt: "Seleccione la opcion de eleccion correspondiente.",
    type: "eleccion",
    votingRule: "simple",
    requiresAttachment: true,
    order: 3,
    status: "pending"
  }
];

const defaultVote: LiveVoteResult[] = [
  { option: "Si", count: 0, percentage: 0 },
  { option: "No", count: 0, percentage: 0 },
  { option: "En blanco", count: 0, percentage: 0 }
];

export function buildAssemblyDashboardFromReadiness(readiness: AssemblyReadinessSummary): AssemblyDashboardSummary {
  const quorumPercentage = readiness.totalUnits
    ? Number(((readiness.representedUnits / readiness.totalUnits) * 100).toFixed(1))
    : 0;

  return {
    propertyName: readiness.propertyName,
    status: "in_progress" satisfies AssemblyStatus,
    attendees: readiness.eligibleVoters,
    totalUnitsRepresented: readiness.representedUnits,
    quorumPercentage,
    activePoint: "Ruta de la asamblea"
  };
}

export function buildAssemblyOverviewFromReadiness(
  readiness: AssemblyReadinessSummary,
  assemblyId: string,
  agenda: AgendaItem[] = defaultAgenda
): AssemblyOverview {
  const quorum = readiness.totalUnits
    ? Number(((readiness.representedUnits / readiness.totalUnits) * 100).toFixed(1))
    : 0;

  return {
    id: assemblyId,
    propertyId: readiness.propertyId,
    propertyName: readiness.propertyName,
    status: "in_progress",
    quorum,
    attendees: readiness.eligibleVoters,
    totalUnitsRepresented: readiness.representedUnits,
    eligibleVoters: readiness.eligibleVoters,
    invitationRecipients: readiness.invitationRecipients,
    pendingProxyUnits: readiness.pendingProxyUnits,
    units: readiness.units,
    agenda: agenda.length ? agenda : defaultAgenda,
    currentVote: defaultVote
  };
}
