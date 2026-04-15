import type {
  PrivateUnitType,
  PropertyBuildingSubtype,
  PropertyCreateInput,
  PropertyDevelopmentShape,
  PropertyLegalType,
  PropertyStructureMode,
  PropertySummary
} from "@kuoro/contracts";

export const legalTypeOptions: Array<{ value: PropertyLegalType; label: string; description: string }> = [
  {
    value: "residencial",
    label: "Residencial",
    description: "Conjuntos o edificios destinados principalmente a vivienda."
  },
  {
    value: "comercial",
    label: "Comercial",
    description: "Copropiedades orientadas a actividad comercial, oficinas o bodegas."
  },
  {
    value: "mixto",
    label: "Mixto",
    description: "Copropiedades que combinan vivienda con comercio, oficinas u otros usos."
  }
];

export function getDevelopmentShapeOptions(
  legalType: PropertyLegalType
): Array<{ value: PropertyDevelopmentShape; label: string }> {
  if (legalType === "residencial") {
    return [
      { value: "edificio", label: "Edificio residencial" },
      { value: "conjunto", label: "Conjunto residencial" },
      { value: "conjunto_por_etapas", label: "Conjunto residencial por etapas" }
    ];
  }

  if (legalType === "comercial") {
    return [
      { value: "edificio", label: "Edificio comercial" },
      { value: "conjunto", label: "Centro comercial o conjunto comercial" },
      { value: "conjunto_por_etapas", label: "Parque o proyecto comercial por etapas" }
    ];
  }

  return [
    { value: "edificio", label: "Edificio mixto" },
    { value: "conjunto", label: "Conjunto mixto" },
    { value: "conjunto_por_etapas", label: "Proyecto mixto por etapas" }
  ];
}

export function getBuildingSubtypeOptions(
  legalType: PropertyLegalType,
  developmentShape?: PropertyDevelopmentShape
): Array<{ value: PropertyBuildingSubtype; label: string }> {
  if (legalType === "residencial") {
    return [
      { value: "edificio_apartamentos", label: "Edificio de apartamentos" }
    ];
  }

  if (legalType === "comercial") {
    if (developmentShape === "conjunto") {
      return [
        { value: "centro_comercial", label: "Centro comercial" },
        { value: "plazoleta_comercial", label: "Plazoleta comercial" },
        { value: "parque_empresarial", label: "Parque empresarial" },
        { value: "parque_industrial", label: "Parque industrial o logistico" },
        { value: "centro_medico", label: "Centro medico o de consultorios" }
      ];
    }

    if (developmentShape === "conjunto_por_etapas") {
      return [
        { value: "parque_empresarial", label: "Parque empresarial por etapas" },
        { value: "parque_industrial", label: "Parque industrial o logistico por etapas" },
        { value: "centro_comercial", label: "Centro comercial por etapas" }
      ];
    }

    return [
      { value: "edificio_oficinas", label: "Edificio de oficinas" },
      { value: "torre_empresarial", label: "Torre empresarial" },
      { value: "edificio_consultorios", label: "Edificio de consultorios" },
      { value: "centro_medico", label: "Centro medico o de consultorios" },
      { value: "edificio_locales", label: "Edificio de locales" },
      { value: "centro_comercial", label: "Centro comercial" },
      { value: "plazoleta_comercial", label: "Plazoleta comercial" },
      { value: "edificio_bodegas", label: "Edificio de bodegas" }
    ];
  }

  return [
    { value: "edificio_apartamentos_con_locales", label: "Edificio de apartamentos con locales comerciales" },
    { value: "edificio_apartamentos_con_oficinas", label: "Edificio de apartamentos con oficinas o consultorios" },
    { value: "edificio_mixto_comercial", label: "Edificio mixto comercial" },
    { value: "edificio_mixto_integrado", label: "Edificio mixto integrado" }
  ];
}

export function getStructureModeOptions(
  legalType: PropertyLegalType,
  developmentShape: PropertyDevelopmentShape,
  buildingSubtype?: PropertyBuildingSubtype
): Array<{ value: PropertyStructureMode; label: string }> {
  if (developmentShape === "edificio") {
    if (legalType === "residencial") {
      return [{ value: "torres_apartamentos", label: "Apartamentos del edificio" }];
    }

    if (legalType === "comercial") {
      if (buildingSubtype === "edificio_oficinas" || buildingSubtype === "torre_empresarial") {
        return [{ value: "oficinas", label: "Unidades por piso o torre" }];
      }

      if (buildingSubtype === "edificio_consultorios" || buildingSubtype === "centro_medico") {
        return [{ value: "consultorios", label: "Consultorios del edificio" }];
      }

      if (
        buildingSubtype === "edificio_locales" ||
        buildingSubtype === "centro_comercial" ||
        buildingSubtype === "plazoleta_comercial"
      ) {
        return [{ value: "locales", label: "Locales del edificio" }];
      }

      if (
        buildingSubtype === "edificio_bodegas" ||
        buildingSubtype === "parque_empresarial" ||
        buildingSubtype === "parque_industrial"
      ) {
        return [{ value: "bodegas", label: "Bodegas del edificio" }];
      }
    }

    if (legalType === "mixto") {
      if (buildingSubtype === "edificio_apartamentos_con_locales") {
        return [
          { value: "torres_apartamentos", label: "Apartamentos del edificio" },
          { value: "locales", label: "Locales del edificio" }
        ];
      }

      if (buildingSubtype === "edificio_apartamentos_con_oficinas") {
        return [
          { value: "torres_apartamentos", label: "Apartamentos del edificio" },
          { value: "oficinas", label: "Oficinas del edificio" },
          { value: "consultorios", label: "Consultorios del edificio" }
        ];
      }

      if (buildingSubtype === "edificio_mixto_comercial") {
        return [
          { value: "locales", label: "Locales del edificio" },
          { value: "oficinas", label: "Oficinas del edificio" }
        ];
      }

      if (buildingSubtype === "edificio_mixto_integrado") {
        return [
          { value: "torres_apartamentos", label: "Apartamentos del edificio" },
          { value: "locales", label: "Locales del edificio" },
          { value: "oficinas", label: "Oficinas del edificio" },
          { value: "consultorios", label: "Consultorios del edificio" }
        ];
      }
    }
  }

  if (legalType === "residencial") {
    return [
      { value: "torres_apartamentos", label: "Torres de apartamentos" },
      { value: "bloques_apartamentos", label: "Bloques de apartamentos" },
      { value: "manzanas_casas", label: "Manzanas de casas" },
      { value: "casas_y_torres", label: "Manzanas con casas y torres de apartamentos" },
      { value: "mixto_sectorizado", label: "Residencial sectorizado" }
    ];
  }

  if (legalType === "comercial") {
    if (
      buildingSubtype === "centro_comercial" ||
      buildingSubtype === "plazoleta_comercial" ||
      buildingSubtype === "edificio_locales"
    ) {
      return [
        { value: "locales", label: "Locales comerciales" },
        { value: "mixto_sectorizado", label: "Pasillos o sectores comerciales" }
      ];
    }

    if (
      buildingSubtype === "parque_empresarial" ||
      buildingSubtype === "edificio_oficinas" ||
      buildingSubtype === "torre_empresarial"
    ) {
      return [
        { value: "oficinas", label: "Oficinas o modulos empresariales" },
        { value: "mixto_sectorizado", label: "Bloques o sectores empresariales" }
      ];
    }

    if (
      buildingSubtype === "centro_medico" ||
      buildingSubtype === "edificio_consultorios"
    ) {
      return [
        { value: "consultorios", label: "Consultorios" },
        { value: "mixto_sectorizado", label: "Torres o sectores medicos" }
      ];
    }

    if (
      buildingSubtype === "parque_industrial" ||
      buildingSubtype === "edificio_bodegas"
    ) {
      return [
        { value: "bodegas", label: "Bodegas o naves" },
        { value: "mixto_sectorizado", label: "Patios o sectores logisticos" }
      ];
    }

    if (developmentShape === "conjunto") {
      return [
        { value: "locales", label: "Locales comerciales" },
        { value: "oficinas", label: "Oficinas" },
        { value: "consultorios", label: "Consultorios" },
        { value: "bodegas", label: "Bodegas o modulos logisticos" },
        { value: "mixto_sectorizado", label: "Sectores comerciales diferenciados" }
      ];
    }

    return [
      { value: "locales", label: "Locales comerciales" },
      { value: "oficinas", label: "Oficinas" },
      { value: "consultorios", label: "Consultorios" },
      { value: "bodegas", label: "Bodegas" },
      { value: "mixto_sectorizado", label: "Sectores comerciales diferenciados" }
    ];
  }

  return [
    { value: "casas_y_torres", label: "Vivienda con casas y torres" },
    { value: "locales", label: "Vivienda con locales comerciales" },
    { value: "oficinas", label: "Vivienda con oficinas" },
    { value: "consultorios", label: "Vivienda con consultorios" },
    { value: "bodegas", label: "Vivienda con bodegas" },
    { value: "mixto_sectorizado", label: "Mixto sectorizado" },
    { value: "personalizado", label: "Composición personalizada" }
  ];
}

export const privateUnitTypeOptions: Array<{ value: PrivateUnitType; label: string }> = [
  { value: "apartamento", label: "Apartamento" },
  { value: "casa", label: "Casa" },
  { value: "local", label: "Local comercial" },
  { value: "oficina", label: "Oficina" },
  { value: "consultorio", label: "Consultorio" },
  { value: "bodega", label: "Bodega" },
  { value: "parqueadero", label: "Parqueadero privado" },
  { value: "deposito", label: "Depósito" },
  { value: "otro", label: "Otro" }
];

export function getAllowedUnitTypesForContext(
  legalType: PropertyLegalType,
  developmentShape: PropertyDevelopmentShape,
  buildingSubtype?: PropertyBuildingSubtype
): PrivateUnitType[] {
  if (developmentShape === "edificio") {
    if (legalType === "residencial") {
      return ["apartamento", "parqueadero", "deposito", "otro"];
    }

    if (legalType === "comercial") {
      if (buildingSubtype === "edificio_oficinas" || buildingSubtype === "torre_empresarial") {
        return ["oficina", "parqueadero", "deposito", "otro"];
      }

      if (buildingSubtype === "edificio_consultorios" || buildingSubtype === "centro_medico") {
        return ["consultorio", "parqueadero", "deposito", "otro"];
      }

      if (
        buildingSubtype === "edificio_locales" ||
        buildingSubtype === "centro_comercial" ||
        buildingSubtype === "plazoleta_comercial"
      ) {
        return ["local", "parqueadero", "deposito", "otro"];
      }

      if (
        buildingSubtype === "edificio_bodegas" ||
        buildingSubtype === "parque_empresarial" ||
        buildingSubtype === "parque_industrial"
      ) {
        return ["bodega", "parqueadero", "deposito", "otro"];
      }
    }

    if (legalType === "mixto") {
      if (buildingSubtype === "edificio_apartamentos_con_locales") {
        return ["apartamento", "local", "parqueadero", "deposito", "otro"];
      }

      if (buildingSubtype === "edificio_apartamentos_con_oficinas") {
        return ["apartamento", "oficina", "consultorio", "parqueadero", "deposito", "otro"];
      }

      if (buildingSubtype === "edificio_mixto_comercial") {
        return ["local", "oficina", "consultorio", "parqueadero", "deposito", "otro"];
      }

      if (buildingSubtype === "edificio_mixto_integrado") {
        return ["apartamento", "local", "oficina", "consultorio", "parqueadero", "deposito", "otro"];
      }
    }
  }

  if (legalType === "residencial") {
    return ["apartamento", "casa", "parqueadero", "deposito", "otro"];
  }

  if (legalType === "comercial") {
    if (
      buildingSubtype === "centro_comercial" ||
      buildingSubtype === "plazoleta_comercial" ||
      buildingSubtype === "edificio_locales"
    ) {
      return ["local", "parqueadero", "deposito", "otro"];
    }

    if (
      buildingSubtype === "parque_empresarial" ||
      buildingSubtype === "edificio_oficinas" ||
      buildingSubtype === "torre_empresarial"
    ) {
      return ["oficina", "parqueadero", "deposito", "otro"];
    }

    if (
      buildingSubtype === "centro_medico" ||
      buildingSubtype === "edificio_consultorios"
    ) {
      return ["consultorio", "parqueadero", "deposito", "otro"];
    }

    if (
      buildingSubtype === "parque_industrial" ||
      buildingSubtype === "edificio_bodegas"
    ) {
      return ["bodega", "parqueadero", "deposito", "otro"];
    }

    return ["local", "oficina", "consultorio", "bodega", "parqueadero", "deposito", "otro"];
  }

  return [
    "apartamento",
    "casa",
    "local",
    "oficina",
    "consultorio",
    "bodega",
    "parqueadero",
    "deposito",
    "otro"
  ];
}

export function getVisibleUnitTypeOptions(
  legalType: PropertyLegalType,
  developmentShape: PropertyDevelopmentShape,
  buildingSubtype?: PropertyBuildingSubtype
) {
  const allowed = new Set(getAllowedUnitTypesForContext(legalType, developmentShape, buildingSubtype));
  return privateUnitTypeOptions.filter((option) => allowed.has(option.value));
}

export function getDefaultUnitTypesForContext(
  legalType: PropertyLegalType,
  developmentShape: PropertyDevelopmentShape,
  buildingSubtype?: PropertyBuildingSubtype
): PrivateUnitType[] {
  if (developmentShape === "edificio") {
    if (legalType === "residencial") {
      return ["apartamento"];
    }

    if (legalType === "comercial") {
      if (buildingSubtype === "edificio_oficinas" || buildingSubtype === "torre_empresarial") {
        return ["oficina"];
      }
      if (buildingSubtype === "edificio_consultorios" || buildingSubtype === "centro_medico") {
        return ["consultorio"];
      }
      if (
        buildingSubtype === "edificio_bodegas" ||
        buildingSubtype === "parque_empresarial" ||
        buildingSubtype === "parque_industrial"
      ) {
        return ["bodega"];
      }
      return ["local"];
    }

    if (buildingSubtype === "edificio_apartamentos_con_locales") {
      return ["apartamento", "local"];
    }
    if (buildingSubtype === "edificio_apartamentos_con_oficinas") {
      return ["apartamento", "oficina", "consultorio"];
    }
    if (buildingSubtype === "edificio_mixto_comercial") {
      return ["local", "oficina", "consultorio"];
    }
    return ["apartamento", "local", "oficina", "consultorio"];
  }

  if (legalType === "residencial") {
    return ["apartamento", "casa"];
  }

  if (legalType === "comercial") {
    if (
      buildingSubtype === "parque_empresarial" ||
      buildingSubtype === "edificio_oficinas" ||
      buildingSubtype === "torre_empresarial"
    ) {
      return ["oficina"];
    }

    if (
      buildingSubtype === "centro_medico" ||
      buildingSubtype === "edificio_consultorios"
    ) {
      return ["consultorio"];
    }

    if (
      buildingSubtype === "parque_industrial" ||
      buildingSubtype === "edificio_bodegas"
    ) {
      return ["bodega"];
    }

    return ["local"];
  }

  return ["apartamento", "local"];
}

export function buildPropertyPayload(
  form: PropertyWizardForm
): PropertyCreateInput {
  return {
    name: form.name.trim(),
    city: form.city.trim(),
    address: form.address.trim(),
    nit: form.nit.trim() || undefined,
    legalType: form.legalType,
    developmentShape: form.developmentShape,
    buildingSubtype: form.buildingSubtype,
    structureModes: form.structureModes,
    privateUnitTypes: form.privateUnitTypes,
    usesCoefficients: form.usesCoefficients,
    usesContributionModules: form.usesContributionModules,
    supportsProxies: form.supportsProxies
  };
}

export type PropertyWizardForm = {
  name: string;
  city: string;
  address: string;
  nit: string;
  legalType: PropertyLegalType;
  developmentShape: PropertyDevelopmentShape;
  buildingSubtype?: PropertyBuildingSubtype;
  structureModes: PropertyStructureMode[];
  privateUnitTypes: PrivateUnitType[];
  usesCoefficients: boolean;
  usesContributionModules: boolean;
  supportsProxies: boolean;
};

export function createInitialPropertyForm(): PropertyWizardForm {
  return {
    name: "",
    city: "Bogota",
    address: "",
    nit: "",
    legalType: "residencial",
    developmentShape: "conjunto",
    buildingSubtype: undefined,
    structureModes: ["torres_apartamentos"],
    privateUnitTypes: getDefaultUnitTypesForContext("residencial", "conjunto"),
    usesCoefficients: true,
    usesContributionModules: false,
    supportsProxies: true
  };
}

export function mapPropertyToForm(property: PropertySummary): PropertyWizardForm {
  const legalType = property.legalType ?? "residencial";
  const structureModes: PropertyStructureMode[] = property.structureModes?.length
    ? property.structureModes
    : ["torres_apartamentos"];

  return {
    name: property.name,
    city: property.city,
    address: property.address ?? "",
    nit: property.nit ?? "",
    legalType,
    developmentShape: property.developmentShape ?? "conjunto",
    buildingSubtype: property.buildingSubtype,
    structureModes,
    privateUnitTypes:
      property.privateUnitTypes?.length
        ? property.privateUnitTypes.filter((item) =>
            getAllowedUnitTypesForContext(
              legalType,
              property.developmentShape ?? "conjunto",
              property.buildingSubtype
            ).includes(item)
          )
        : getDefaultUnitTypesForContext(
            legalType,
            property.developmentShape ?? "conjunto",
            property.buildingSubtype
          ),
    usesCoefficients: property.usesCoefficients ?? true,
    usesContributionModules: property.usesContributionModules ?? false,
    supportsProxies: property.supportsProxies ?? true
  };
}
