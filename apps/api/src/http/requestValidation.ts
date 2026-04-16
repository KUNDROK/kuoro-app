import type {
  AgendaItemInput,
  AssemblyAccessConfigInput,
  AssemblyAccessGrantInput,
  AssemblyConfigInput,
  AssemblyDocumentInput,
  AssemblyInvitationDeliverySummary,
  OwnerCreateInput,
  PropertyCreateInput,
  UnitCreateInput,
  UnitOwnerInput
} from "@kuoro/contracts";

export function validateDocumentByType(type: string, value: string) {
  const clean = value.trim();

  if (["rc", "ti", "cc", "te", "ce", "pep", "ppt"].includes(type)) {
    return /^\d{5,20}$/.test(clean);
  }

  if (type === "nit") {
    return /^\d{5,20}(-\d)?$/.test(clean);
  }

  if (type === "pasaporte" || type === "documento_extranjero") {
    return /^[A-Za-z0-9-]{3,20}$/.test(clean);
  }

  return false;
}

export function isValidProperty(input: PropertyCreateInput) {
  return (
    input.name.trim().length >= 3 &&
    input.city.trim().length >= 2 &&
    input.address.trim().length >= 5 &&
    ["residencial", "comercial", "mixto"].includes(input.legalType) &&
    ["edificio", "conjunto", "conjunto_por_etapas"].includes(input.developmentShape) &&
    (input.developmentShape !== "edificio" || Boolean(input.buildingSubtype)) &&
    Array.isArray(input.structureModes) &&
    input.structureModes.length >= 1 &&
    Array.isArray(input.privateUnitTypes) &&
    input.privateUnitTypes.length >= 1
  );
}

export function computeVoteApproval(yes: number, no: number, abstain: number, rule: string): boolean {
  const valid = yes + no + abstain;
  if (valid === 0) return false;
  if (rule === "simple") return yes > no;
  if (rule === "dos_tercios") return yes / valid >= 2 / 3;
  if (rule === "unanimidad") return yes === valid && yes > 0;
  return false;
}

export function isValidAssemblyConfig(input: AssemblyConfigInput) {
  const validBase =
    input.title.trim().length >= 5 &&
    [
      "ordinaria",
      "extraordinaria",
      "segunda_convocatoria",
      "derecho_propio",
      "no_presencial",
      "mixta",
      "comunicacion_escrita"
    ].includes(input.type) &&
    ["presencial", "virtual", "mixta"].includes(input.modality) &&
    ["draft", "scheduled", "invitation_sent", "in_progress", "closed", "archived"].includes(input.status) &&
    input.scheduledAt.trim().length >= 10 &&
    [
      "ninguno",
      "kuoro_live",
      "enlace_externo",
      "zoom",
      "google_meet",
      "microsoft_teams",
      "jitsi",
      "servicio_propio",
      "por_definir"
    ].includes(input.conferenceService) &&
    ["coeficientes", "modulos", "unidad"].includes(input.votingBasis);

  if (!validBase) {
    return false;
  }

  if (input.type === "no_presencial" && input.modality !== "virtual") {
    return false;
  }

  if (input.type === "mixta" && input.modality !== "mixta") {
    return false;
  }

  if (input.type === "derecho_propio" && input.modality !== "presencial") {
    return false;
  }

  if (input.type === "comunicacion_escrita" && input.modality !== "virtual") {
    return false;
  }

  if (["segunda_convocatoria", "derecho_propio", "comunicacion_escrita"].includes(input.type) && input.allowsSecondCall) {
    return false;
  }

  if (input.modality === "presencial" && !input.location?.trim()) {
    return false;
  }

  return true;
}

export function isValidAgendaItem(input: AgendaItemInput) {
  return (
    input.title.trim().length >= 5 &&
    ["informativo", "deliberativo", "votacion", "eleccion"].includes(input.type) &&
    ["ninguna", "simple", "calificada_70", "unanimidad"].includes(input.votingRule)
  );
}

export function isValidAssemblyDocument(input: AssemblyDocumentInput) {
  return (
    input.title.trim().length >= 3 &&
    input.documentName.trim().length >= 1 &&
    input.documentData.trim().startsWith("data:") &&
    ["convocatoria", "informe", "soporte", "presupuesto", "reglamento", "otro"].includes(input.category)
  );
}

export function isValidInvitationDelivery(input: AssemblyInvitationDeliverySummary) {
  return (
    input.unitId.trim().length >= 1 &&
    input.sentAt.trim().length >= 10 &&
    ["email", "manual", "whatsapp", "otro"].includes(input.channel) &&
    ["sent", "pending", "failed"].includes(input.status)
  );
}

export function isValidAssemblyAccessConfig(input: AssemblyAccessConfigInput) {
  const validBase =
    ["enlace_unico", "codigo_y_documento", "pre_registro_asistido"].includes(input.sessionAccessMode) &&
    ["otp_email", "otp_sms", "validacion_manual", "sin_otp"].includes(input.identityValidationMethod) &&
    ["email", "sms", "no_aplica"].includes(input.otpChannel);

  if (!validBase) {
    return false;
  }

  if (input.identityValidationMethod === "otp_email" && input.otpChannel !== "email") {
    return false;
  }

  if (input.identityValidationMethod === "otp_sms" && input.otpChannel !== "sms") {
    return false;
  }

  if (
    ["validacion_manual", "sin_otp"].includes(input.identityValidationMethod) &&
    input.otpChannel !== "no_aplica"
  ) {
    return false;
  }

  return true;
}

export function isValidAssemblyAccessGrant(input: AssemblyAccessGrantInput) {
  return (
    input.unitId.trim().length >= 1 &&
    ["email", "whatsapp", "manual", "pendiente"].includes(input.deliveryChannel) &&
    ["otp_email", "otp_sms", "validacion_manual", "sin_otp"].includes(input.validationMethod) &&
    ["pending", "confirmed", "manual_review"].includes(input.preRegistrationStatus) &&
    ["draft", "ready_to_send", "sent"].includes(input.dispatchStatus)
  );
}

export function isValidOwner(input: OwnerCreateInput) {
  const hasOwnerEmail = Boolean(input.email?.trim());
  const hasOwnerPhone = Boolean(input.phone?.trim());
  const hasOwnerDocument = Boolean(input.document?.trim());

  return (
    input.fullName.trim().length >= 3 &&
    (!hasOwnerEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email!.trim())) &&
    (!hasOwnerPhone || /^\+?\d{7,15}$/.test(input.phone!.replace(/[\s()-]/g, ""))) &&
    (!hasOwnerDocument ||
      (Boolean(input.documentType) &&
        validateDocumentByType(input.documentType!, input.document!.trim())))
  );
}

export function getOwnerValidationError(input: UnitOwnerInput, index: number) {
  const label = input.fullName.trim() || `la persona ${index + 1}`;
  const hasOwnerEmail = Boolean(input.email?.trim());
  const hasOwnerPhone = Boolean(input.phone?.trim());
  const hasOwnerDocument = Boolean(input.document?.trim());

  if (input.fullName.trim().length < 3) {
    return `El nombre de ${label} debe tener al menos 3 caracteres`;
  }

  if (hasOwnerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email!.trim())) {
    return `El correo de ${label} no es valido`;
  }

  if (hasOwnerPhone && !/^\+?\d{7,15}$/.test(input.phone!.replace(/[\s()-]/g, ""))) {
    return `El telefono de ${label} no es valido`;
  }

  if (hasOwnerDocument && !input.documentType) {
    return `Debes seleccionar el tipo de documento para ${label}`;
  }

  if (hasOwnerDocument && input.documentType && !validateDocumentByType(input.documentType, input.document!.trim())) {
    return `El numero de documento de ${label} no es valido`;
  }

  if (
    input.participationRole === "apoderado" &&
    input.proxyApprovalStatus &&
    !["awaiting_upload", "pending_review", "approved", "rejected"].includes(input.proxyApprovalStatus)
  ) {
    return `El estado del poder de ${label} no es valido`;
  }

  if (
    input.ownershipPercentage !== undefined &&
    (!Number.isFinite(input.ownershipPercentage) || input.ownershipPercentage < 0)
  ) {
    return `El porcentaje de participacion de ${label} no es valido`;
  }

  return null;
}

export function isValidUnit(input: UnitCreateInput) {
  return (
    input.unitType.trim().length >= 2 &&
    input.groupingKind.trim().length >= 2 &&
    input.groupingLabel.trim().length >= 1 &&
    input.unitNumber.trim().length >= 1 &&
    input.destination.trim().length >= 2 &&
    Array.isArray(input.owners) &&
    input.owners.length >= 1 &&
    input.owners.every(isValidOwner) &&
    input.owners.filter((owner) => owner.isPrimary).length === 1 &&
    input.owners.every(
      (owner) =>
        owner.participationRole !== "apoderado" ||
        ["awaiting_upload", "pending_review", "approved", "rejected"].includes(
          owner.proxyApprovalStatus ?? "awaiting_upload"
        )
    ) &&
    input.owners.every(
      (owner) =>
        owner.ownershipPercentage === undefined ||
        (Number.isFinite(owner.ownershipPercentage) && owner.ownershipPercentage >= 0)
    )
  );
}

export function getUnitValidationError(input: UnitCreateInput) {
  if (input.unitType.trim().length < 2) {
    return "El tipo de unidad no es valido";
  }

  if (input.groupingKind.trim().length < 2) {
    return "La agrupacion de la unidad no es valida";
  }

  if (input.groupingLabel.trim().length < 1) {
    return "Debes indicar la agrupacion de la unidad";
  }

  if (input.unitNumber.trim().length < 1) {
    return "Debes indicar el numero de la unidad";
  }

  if (input.destination.trim().length < 2) {
    return "Debes indicar el destino de la unidad";
  }

  if (!Array.isArray(input.owners) || input.owners.length < 1) {
    return "Debes registrar al menos una persona para la unidad";
  }

  if (input.owners.filter((owner) => owner.isPrimary).length !== 1) {
    return "Debes marcar exactamente un titular principal";
  }

  for (const [index, owner] of input.owners.entries()) {
    const ownerError = getOwnerValidationError(owner, index);
    if (ownerError) {
      return ownerError;
    }
  }

  return null;
}
