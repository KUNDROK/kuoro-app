import type {
  PrivateUnitType,
  PropertyStructureMode,
  UnitCreateInput,
  UnitGroupingKind
} from "@kuoro/contracts";

export type UnitTemplate = {
  key: string;
  label: string;
  unitType: PrivateUnitType;
  groupingKind: UnitGroupingKind;
  groupingLabelText: string;
  unitLabelText: string;
  floorLabel?: string;
  defaultDestination: string;
};

export function getUnitTemplates(structureModes: PropertyStructureMode[]): UnitTemplate[] {
  const templates: UnitTemplate[] = [];

  for (const mode of structureModes) {
    if (mode === "torres_apartamentos") {
      templates.push({
        key: "apartamento-torre",
        label: "Apartamento en torre",
        unitType: "apartamento",
        groupingKind: "torre",
        groupingLabelText: "Numero o nombre de torre",
        unitLabelText: "Numero de apartamento",
        floorLabel: "Piso",
        defaultDestination: "Residencial"
      });
    }

    if (mode === "bloques_apartamentos") {
      templates.push({
        key: "apartamento-bloque",
        label: "Apartamento en bloque",
        unitType: "apartamento",
        groupingKind: "bloque",
        groupingLabelText: "Numero o nombre de bloque",
        unitLabelText: "Numero de apartamento",
        floorLabel: "Piso",
        defaultDestination: "Residencial"
      });
    }

    if (mode === "manzanas_casas") {
      templates.push({
        key: "casa-manzana",
        label: "Casa en manzana",
        unitType: "casa",
        groupingKind: "manzana",
        groupingLabelText: "Numero o nombre de manzana",
        unitLabelText: "Numero de casa",
        defaultDestination: "Residencial"
      });
    }

    if (mode === "casas_y_torres") {
      templates.push({
        key: "apartamento-torre-mixto",
        label: "Apartamento en torre",
        unitType: "apartamento",
        groupingKind: "torre",
        groupingLabelText: "Numero o nombre de torre",
        unitLabelText: "Numero de apartamento",
        floorLabel: "Piso",
        defaultDestination: "Residencial"
      });
      templates.push({
        key: "casa-manzana-mixto",
        label: "Casa en manzana",
        unitType: "casa",
        groupingKind: "manzana",
        groupingLabelText: "Numero o nombre de manzana",
        unitLabelText: "Numero de casa",
        defaultDestination: "Residencial"
      });
    }

    if (mode === "locales") {
      templates.push({
        key: "local-sector",
        label: "Local comercial",
        unitType: "local",
        groupingKind: "sector",
        groupingLabelText: "Sector o bloque",
        unitLabelText: "Numero de local",
        defaultDestination: "Comercial"
      });
    }

    if (mode === "oficinas") {
      templates.push({
        key: "oficina-torre",
        label: "Oficina",
        unitType: "oficina",
        groupingKind: "torre",
        groupingLabelText: "Torre o edificio",
        unitLabelText: "Numero de oficina",
        floorLabel: "Piso",
        defaultDestination: "Oficina"
      });
    }

    if (mode === "consultorios") {
      templates.push({
        key: "consultorio-torre",
        label: "Consultorio",
        unitType: "consultorio",
        groupingKind: "torre",
        groupingLabelText: "Torre o edificio",
        unitLabelText: "Numero de consultorio",
        floorLabel: "Piso",
        defaultDestination: "Consultorio"
      });
    }

    if (mode === "bodegas") {
      templates.push({
        key: "bodega-sector",
        label: "Bodega",
        unitType: "bodega",
        groupingKind: "sector",
        groupingLabelText: "Sector o modulo",
        unitLabelText: "Numero de bodega",
        defaultDestination: "Comercial"
      });
    }
  }

  return templates.filter(
    (template, index, array) => array.findIndex((item) => item.key === template.key) === index
  );
}

export function createUnitFromTemplate(template: UnitTemplate): UnitCreateInput {
  return {
    unitType: template.unitType,
    groupingKind: template.groupingKind,
    groupingLabel: "",
    unitNumber: "",
    floor: "",
    destination: template.defaultDestination,
    privateArea: undefined,
    coefficient: undefined,
    contributionModule: undefined,
    owners: [
      {
        fullName: "",
        documentType: undefined,
        email: "",
        phone: "",
        document: "",
        participationRole: "propietario",
        canVote: true,
        receivesInvitations: true,
        proxyApprovalStatus: "not_required",
        isPrimary: true,
        ownershipPercentage: 100
      }
    ]
  };
}
