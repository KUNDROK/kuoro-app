import type {
  AdminRegistrationInput,
  AgendaStatus,
  AssemblyStatus,
  LiveVoteResult
} from "@kuoro/contracts";

export const adminRegistrationDraft: AdminRegistrationInput = {
  fullName: "Laura Paola Rojas",
  email: "laura@gestioncopropiedad.co",
  phone: "+57 300 123 4567",
  password: ""
};

export const dashboardSummary = {
  propertyName: "Reserva del Prado PH",
  assemblyStatus: "scheduled" as AssemblyStatus,
  nextAssemblyDate: "2026-05-14 18:30",
  units: 124,
  owners: 167,
  invitationsSent: 153,
  expectedQuorum: "68.4%",
  pendingTasks: [
    "Confirmar 14 correos rebotados",
    "Revisar poderes cargados para torre B",
    "Cerrar el orden del dia antes del viernes"
  ]
};

export const agendaItems: Array<{
  id: string;
  title: string;
  description: string;
  status: AgendaStatus;
}> = [
  {
    id: "1",
    title: "Verificacion de quorum",
    description: "Inicio formal de la asamblea y validacion de asistentes.",
    status: "completed"
  },
  {
    id: "2",
    title: "Aprobacion del orden del dia",
    description: "Ratificacion del temario a tratar.",
    status: "active"
  },
  {
    id: "3",
    title: "Eleccion del consejo",
    description: "Votacion de candidatos postulados para el periodo 2026.",
    status: "pending"
  }
];

export const liveVoteResults: LiveVoteResult[] = [
  { option: "Si", count: 58, percentage: 64 },
  { option: "No", count: 21, percentage: 23 },
  { option: "En blanco", count: 12, percentage: 13 }
];

export const speakerQueue = [
  { name: "Martha Restrepo", unit: "Apto 302", type: "Propietaria" },
  { name: "Carlos Jimenez", unit: "Apto 1104", type: "Apoderado" },
  { name: "Diana Pardo", unit: "Casa 19", type: "Propietaria" }
];

export const liveTimeline = [
  "18:31 Se alcanza quorum deliberatorio con 79 unidades representadas.",
  "18:36 Se aprueba el orden del dia.",
  "18:42 Se abre votacion para designacion de presidente de asamblea.",
  "18:47 Se habilita la cola de intervenciones para el punto 3."
];
