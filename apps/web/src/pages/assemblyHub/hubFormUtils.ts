import type {
  AgendaItemInput,
  AssemblyAccessConfigInput,
  AssemblyConferenceService,
  AssemblyConfigInput,
  AssemblyDocumentInput,
  AssemblyInvitationRecipientSummary,
  AssemblySummary
} from "@kuoro/contracts";
import { MODALITY_OPTIONS } from "./hubConstants";

export function formatDate(value: string | undefined) {
  if (!value) return "Pendiente";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "Fecha inválida";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

/** Plataformas donde el moderador debe pegar el enlace real de la reunión. */
export function conferenceServiceRequiresMeetingLink(service: AssemblyConferenceService): boolean {
  return (
    service === "enlace_externo" ||
    service === "zoom" ||
    service === "google_meet" ||
    service === "microsoft_teams" ||
    service === "jitsi" ||
    service === "servicio_propio"
  );
}

export function meetingLinkPlaceholder(service: AssemblyConferenceService): string {
  switch (service) {
    case "zoom":
      return "https://zoom.us/j/… o https://…zoom.us/j/…";
    case "google_meet":
      return "https://meet.google.com/xxx-xxxx-xxx";
    case "microsoft_teams":
      return "https://teams.microsoft.com/l/meetup-join/…";
    case "jitsi":
      return "https://meet.jit.si/nombre-de-sala";
    case "enlace_externo":
    default:
      return "https://…";
  }
}

export function meetingLinkHelperText(service: AssemblyConferenceService): string {
  switch (service) {
    case "zoom":
      return "Pega el enlace de invitación de la reunión Zoom. Los propietarios lo verán al unirse a la asamblea en Kuoro.";
    case "google_meet":
      return "Pega el enlace de Google Meet. Abre la misma reunión en otra pestaña para compartir audio y video con los asistentes.";
    case "microsoft_teams":
      return "Pega el enlace de reunión de Teams o canal de Teams.";
    case "jitsi":
      return "Pega la URL completa de la sala Jitsi.";
    case "enlace_externo":
      return "Cualquier URL de videoconferencia (Webex, Whereby, etc.).";
    case "servicio_propio":
      return "Enlace al visor o sala de tu proveedor audiovisual.";
    case "por_definir":
      return "Si ya tienes el enlace, pégalo aquí; si no, puedes dejarlo vacío y completarlo antes de convocar.";
    default:
      return "";
  }
}

export function isVirtualConferenceConfigOk(form: AssemblyConfigInput): boolean {
  const rv = form.modality === "virtual" || form.modality === "mixta";
  if (!rv) return true;
  const { conferenceService: s } = form;
  if (s === "kuoro_live" || s === "ninguno") return true;
  if (s === "por_definir") return true;
  if (conferenceServiceRequiresMeetingLink(s)) return Boolean(form.virtualAccessUrl?.trim());
  return true;
}

export function getAllowedModalities(type: AssemblyConfigInput["type"]) {
  if (type === "no_presencial" || type === "comunicacion_escrita") {
    return MODALITY_OPTIONS.filter((o) => o.value === "virtual");
  }
  if (type === "derecho_propio") {
    return MODALITY_OPTIONS.filter((o) => o.value === "presencial");
  }
  return MODALITY_OPTIONS;
}

export function normalizeAssemblyForm(input: AssemblyConfigInput): AssemblyConfigInput {
  const nextType = input.type === "mixta" ? "ordinaria" : input.type;
  const allowedModalities = getAllowedModalities(nextType);
  const nextModality = allowedModalities.some((o) => o.value === input.modality)
    ? input.modality
    : allowedModalities[0]?.value ?? "presencial";
  const requiresVirtual = nextModality === "virtual" || nextModality === "mixta";
  const requiresPhysical = nextModality === "presencial" || nextModality === "mixta";
  return {
    ...input,
    type: nextType,
    modality: nextModality,
    conferenceService: requiresVirtual
      ? input.conferenceService === "ninguno"
        ? "kuoro_live"
        : input.conferenceService
      : "ninguno",
    location: requiresPhysical ? input.location : "",
    virtualAccessUrl: requiresVirtual ? input.virtualAccessUrl : "",
    allowsSecondCall: false,
    secondCallScheduledAt: ""
  };
}

export function updateLocalDateTime(value: string, part: "date" | "time", nextValue: string) {
  const [currentDate = "", currentTime = ""] = value.split("T");
  const date = part === "date" ? nextValue : currentDate || new Date().toISOString().slice(0, 10);
  const time = part === "time" ? nextValue : currentTime.slice(0, 5) || "08:00";
  return date && time ? `${date}T${time}` : "";
}

export function createDefaultForm(): AssemblyConfigInput {
  return {
    title: "Asamblea general ordinaria",
    type: "ordinaria",
    modality: "mixta",
    status: "draft",
    scheduledAt: "",
    conferenceService: "kuoro_live",
    location: "",
    virtualAccessUrl: "",
    notes: "",
    votingBasis: "coeficientes",
    allowsSecondCall: false,
    secondCallScheduledAt: ""
  };
}

export function createEmptyAgendaItem(): AgendaItemInput {
  return {
    // El API exige título ≥ 5 caracteres; un borrador vacío haría fallar "Guardar agenda".
    title: "Nuevo punto de agenda",
    description: "",
    slideTitle: "",
    slideContent: "",
    speakerNotes: "",
    votePrompt: "",
    type: "informativo",
    votingRule: "ninguna",
    requiresAttachment: false
  };
}

/** Coincide con la validación del API (`isValidAssemblyDocument`): solo anexos completos se persisten. */
export function isPersistableAssemblyDocument(doc: AssemblyDocumentInput): boolean {
  return (
    doc.title.trim().length >= 3 &&
    doc.documentName.trim().length >= 1 &&
    doc.documentData.trim().startsWith("data:") &&
    ["convocatoria", "informe", "soporte", "presupuesto", "reglamento", "otro"].includes(doc.category)
  );
}

export function createEmptyDocument(): AssemblyDocumentInput {
  return {
    title: "",
    documentName: "",
    documentMimeType: "text/plain",
    documentData: "data:text/plain;base64,",
    category: "otro",
    agendaItemId: ""
  };
}

export function createDefaultAccessConfig(): AssemblyAccessConfigInput {
  return {
    sessionAccessMode: "codigo_y_documento",
    identityValidationMethod: "otp_email",
    otpChannel: "email",
    requireDocumentMatch: true,
    enableLobby: true,
    allowCompanions: false,
    oneActiveVoterPerUnit: true,
    fallbackManualValidation: true
  };
}

export function buildSlideFromPoint(item: AgendaItemInput): AgendaItemInput {
  const baseText = item.description?.trim() || item.title.trim();
  const votePrompt =
    item.type === "votacion" || item.type === "eleccion"
      ? item.votePrompt?.trim() || `¿Aprueba el punto "${item.title || "presentado"}"?`
      : "";
  return {
    ...item,
    slideTitle: item.slideTitle?.trim() || item.title,
    slideContent:
      item.slideContent?.trim() ||
      (baseText
        ? `${baseText}\n\n${item.votingRule !== "ninguna" ? "Al finalizar este punto se abrirá el momento de votación." : "Este punto se presenta para conocimiento y registro de los asistentes."}`
        : ""),
    speakerNotes:
      item.speakerNotes?.trim() ||
      "Guía la conversación con lenguaje claro, confirma si hay preguntas y avanza cuando el punto quede entendido.",
    votePrompt
  };
}

export function createSuggestedPresentation(assemblyTitle: string): AgendaItemInput[] {
  return [
    {
      title: "Apertura y verificación de quórum",
      description: `Da la bienvenida, presenta ${assemblyTitle || "la asamblea"} y confirma que existe quórum suficiente para continuar.`,
      slideTitle: "Apertura de la asamblea",
      slideContent: `Bienvenidos a ${assemblyTitle || "la asamblea"}. Iniciamos con la verificación de quórum y las reglas de participación.`,
      speakerNotes: "Saluda, confirma fecha/hora, explica la dinámica y deja constancia del quórum.",
      votePrompt: "",
      type: "informativo",
      votingRule: "ninguna",
      requiresAttachment: false
    },
    {
      title: "Aprobación de la ruta de la reunión",
      description: "Muestra las etapas de la presentación y somete a votación la aprobación de la ruta.",
      slideTitle: "Ruta de la asamblea",
      slideContent: "Presentamos la ruta de la reunión y sometemos a consideración la secuencia propuesta para avanzar.",
      speakerNotes: "Lee los puntos principales y pregunta si hay observaciones antes de abrir votación.",
      votePrompt: "¿Aprueba la ruta propuesta para la asamblea?",
      type: "votacion",
      votingRule: "simple",
      requiresAttachment: false
    },
    {
      title: "Presentación de informes",
      description: "Resume los informes de administración y financieros.",
      slideTitle: "Presentación de informes",
      slideContent: "Revisamos los informes preparados para la asamblea, con énfasis en datos clave y soportes anexos.",
      speakerNotes: "Menciona los anexos disponibles y resume las cifras o mensajes principales.",
      votePrompt: "",
      type: "informativo",
      votingRule: "ninguna",
      requiresAttachment: true
    },
    {
      title: "Decisiones sometidas a votación",
      description: "Formula con claridad la decisión que se votará.",
      slideTitle: "Decisión sometida a votación",
      slideContent: "Presentamos la decisión, sus opciones y las condiciones de aprobación antes de abrir la votación.",
      speakerNotes: "Lee la pregunta de votación exactamente como debe quedar registrada.",
      votePrompt: "¿Aprueba la decisión presentada?",
      type: "votacion",
      votingRule: "simple",
      requiresAttachment: true
    },
    {
      title: "Cierre y constancias",
      description: "Resume decisiones, constancias y siguientes pasos antes de cerrar la transmisión.",
      slideTitle: "Cierre de la asamblea",
      slideContent: "Cerramos la sesión dejando constancia de decisiones, resultados y siguientes pasos.",
      speakerNotes: "Resume acuerdos, agradece asistencia e informa dónde quedará el acta o soporte.",
      votePrompt: "",
      type: "informativo",
      votingRule: "ninguna",
      requiresAttachment: false
    }
  ];
}

export function getStatusStyle(status: AssemblySummary["status"]) {
  const map: Record<AssemblySummary["status"], { color: string; bg: string; label: string }> = {
    draft: { color: "var(--text-secondary)", bg: "var(--muted)", label: "Borrador" },
    scheduled: { color: "var(--warning)", bg: "var(--warning-surface)", label: "Programada" },
    invitation_sent: { color: "var(--primary)", bg: "var(--accent)", label: "Convocada" },
    in_progress: { color: "#FFFFFF", bg: "var(--success)", label: "En curso" },
    closed: { color: "var(--text-secondary)", bg: "var(--muted)", label: "Cerrada" },
    archived: { color: "var(--text-tertiary)", bg: "var(--muted)", label: "Archivada" }
  };
  return map[status] ?? map.draft;
}

export function getInvitationStatusConfig(status: AssemblyInvitationRecipientSummary["status"]) {
  const map: Record<
    AssemblyInvitationRecipientSummary["status"],
    { label: string; color: string; bg: string }
  > = {
    ready: { label: "Listo", color: "var(--success)", bg: "var(--success-surface)" },
    missing_contact: { label: "Sin contacto", color: "var(--danger)", bg: "var(--danger-surface)" },
    pending_proxy: { label: "Poder pendiente", color: "var(--warning)", bg: "var(--warning-surface)" },
    no_recipient: { label: "Sin destinatario", color: "var(--text-secondary)", bg: "var(--muted)" }
  };
  return map[status] ?? map.no_recipient;
}

export function formatInvitationSentAt(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "";
  }
}
