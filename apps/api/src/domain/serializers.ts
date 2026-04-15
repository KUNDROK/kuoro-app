import type { StoredAdmin, StoredProperty } from "../db";

export function toAdminProfile(admin: StoredAdmin) {
  return {
    id: admin.id,
    fullName: admin.fullName,
    email: admin.email,
    phone: admin.phone,
    emailVerified: admin.emailVerified,
    createdAt: admin.createdAt
  };
}

export function toPropertySummary(property: StoredProperty) {
  return {
    id: property.id,
    name: property.name,
    city: property.city,
    address: property.address,
    nit: property.nit,
    totalUnits: property.totalUnits,
    legalType: property.legalType,
    developmentShape: property.developmentShape,
    buildingSubtype: property.buildingSubtype,
    structureModes: property.structureModes,
    privateUnitTypes: property.privateUnitTypes,
    usesCoefficients: property.usesCoefficients,
    usesContributionModules: property.usesContributionModules,
    supportsProxies: property.supportsProxies,
    operationalStatus: property.operationalStatus ?? "active",
    createdAt: property.createdAt
  };
}
