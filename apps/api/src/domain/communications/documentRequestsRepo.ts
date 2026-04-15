import { prisma } from "../../lib/prisma";

export async function listDocumentRequestsForProperty(propertyId: string) {
  const rows = await prisma.documentRequest.findMany({
    where: { propertyId },
    orderBy: { updatedAt: "desc" },
    include: {
      owner: { select: { id: true, fullName: true, email: true, participationRole: true } },
      unit: { select: { id: true, groupingLabel: true, unitNumber: true } },
      _count: { select: { submissions: true, reviews: true } }
    }
  });

  return rows.map((r) => ({
    id: r.id,
    propertyId: r.propertyId,
    ownerId: r.ownerId,
    unitId: r.unitId,
    kind: r.kind,
    status: r.status,
    publicToken: r.publicToken,
    title: r.title,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    ownerName: r.owner.fullName,
    ownerEmail: r.owner.email,
    ownerRole: r.owner.participationRole,
    unitLabel: r.unit ? [r.unit.groupingLabel, r.unit.unitNumber].filter(Boolean).join(" ") : null,
    submissionsCount: r._count.submissions,
    reviewsCount: r._count.reviews
  }));
}

export async function findPublicDocumentRequestByToken(token: string) {
  const dr = await prisma.documentRequest.findUnique({
    where: { publicToken: token },
    include: {
      owner: true,
      property: true,
      submissions: { orderBy: { submittedAt: "desc" }, take: 20 },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20
      }
    }
  });

  if (!dr) return null;

  const unitLink = dr.unitId
    ? await prisma.unit.findUnique({ where: { id: dr.unitId } })
    : null;

  return {
    documentRequest: {
      id: dr.id,
      kind: dr.kind,
      status: dr.status,
      title: dr.title,
      instructions: dr.instructions,
      publicToken: dr.publicToken,
      createdAt: dr.createdAt.toISOString(),
      updatedAt: dr.updatedAt.toISOString()
    },
    property: {
      id: dr.property.id,
      name: dr.property.name,
      city: dr.property.city
    },
    owner: {
      fullName: dr.owner.fullName,
      participationRole: dr.owner.participationRole
    },
    unitLabel: unitLink ? [unitLink.groupingLabel, unitLink.unitNumber].filter(Boolean).join(" ") : null,
    submissions: dr.submissions.map((s) => ({
      id: s.id,
      fileName: s.fileName,
      mimeType: s.mimeType,
      submittedAt: s.submittedAt.toISOString(),
      submittedByName: s.submittedByName
    })),
    reviews: dr.reviews.map((v) => ({
      id: v.id,
      action: v.action,
      reasons: v.reasons,
      note: v.note,
      createdAt: v.createdAt.toISOString()
    })),
    /** Compat: estado de poder en Owner cuando kind = proxy_power */
    legacyProxyStatus:
      dr.kind === "proxy_power"
        ? {
            proxyApprovalStatus: dr.owner.proxyApprovalStatus,
            proxyRejectionReasons: dr.owner.proxyRejectionReasons,
            proxyRejectionNote: dr.owner.proxyRejectionNote
          }
        : null
  };
}
