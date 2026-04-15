import type { UnitSummary } from "@kuoro/contracts";

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatUnitLabel(unit: Pick<UnitSummary, "groupingKind" | "groupingLabel" | "unitType" | "unitNumber">) {
  const groupingName =
    unit.groupingKind === "torre"
      ? "Torre"
      : unit.groupingKind === "bloque"
        ? "Bloque"
        : unit.groupingKind === "manzana"
          ? "Manzana"
          : unit.groupingKind === "sector"
            ? "Sector"
            : unit.groupingKind === "modulo"
              ? "Modulo"
              : "";

  const unitTypeName =
    unit.unitType === "apartamento"
      ? "Apartamento"
      : unit.unitType === "casa"
        ? "Casa"
        : unit.unitType === "local"
          ? "Local"
          : unit.unitType === "oficina"
            ? "Oficina"
            : unit.unitType === "consultorio"
              ? "Consultorio"
              : unit.unitType === "bodega"
                ? "Bodega"
                : unit.unitType === "parqueadero"
                  ? "Parqueadero"
                  : unit.unitType === "deposito"
                    ? "Deposito"
                    : toTitleCase(unit.unitType);

  return [groupingName, unit.groupingLabel, unitTypeName, unit.unitNumber].filter(Boolean).join(" ");
}
