import type { DocumentType, UnitCreateInput } from "@kuoro/contracts";

export const documentTypeOptions: Array<{ value: DocumentType; label: string }> = [
  { value: "rc", label: "Registro civil" },
  { value: "ti", label: "Tarjeta de identidad" },
  { value: "cc", label: "Cedula de ciudadania" },
  { value: "te", label: "Tarjeta de extranjeria" },
  { value: "ce", label: "Cedula de extranjeria" },
  { value: "nit", label: "NIT" },
  { value: "pasaporte", label: "Pasaporte" },
  { value: "documento_extranjero", label: "Documento extranjero" },
  { value: "pep", label: "PEP" },
  { value: "ppt", label: "PPT" }
];

export function validateUnitForm(input: UnitCreateInput) {
  if (!input.owners.length) {
    return "Debes registrar al menos una persona para la unidad";
  }

  if (input.owners.filter((owner) => owner.isPrimary).length !== 1) {
    return "Debes marcar exactamente un titular principal";
  }

  for (const owner of input.owners) {
    if (owner.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner.email.trim())) {
      return `El correo de ${owner.fullName.trim() || "una persona registrada"} no es valido`;
    }

    if (owner.phone?.trim() && !/^\+?\d{7,15}$/.test(owner.phone.replace(/[\s()-]/g, ""))) {
      return `El telefono de ${owner.fullName.trim() || "una persona registrada"} no es valido`;
    }

    if (owner.document?.trim()) {
      if (!owner.documentType) {
        return `Debes seleccionar el tipo de documento para ${owner.fullName.trim() || "una persona registrada"}`;
      }

      if (!validateDocumentByType(owner.documentType, owner.document.trim())) {
        return `El numero de documento de ${owner.fullName.trim() || "una persona registrada"} no es valido`;
      }
    }

    if (!owner.fullName.trim()) {
      return "No puede haber personas sin nombre en la ficha de propietarios";
    }

    if (owner.fullName.trim().length < 3) {
      return `El nombre de ${owner.fullName.trim() || "una persona registrada"} debe tener al menos 3 caracteres`;
    }

  }

  return null;
}

function validateDocumentByType(type: DocumentType, value: string) {
  if (["rc", "ti", "cc", "te", "ce", "pep", "ppt"].includes(type)) {
    return /^\d{5,20}$/.test(value);
  }

  if (type === "nit") {
    return /^\d{5,20}(-\d)?$/.test(value);
  }

  if (type === "pasaporte" || type === "documento_extranjero") {
    return /^[A-Za-z0-9-]{3,20}$/.test(value);
  }

  return false;
}
