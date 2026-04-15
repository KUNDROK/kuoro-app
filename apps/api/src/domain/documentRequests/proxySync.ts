/**
 * Sincroniza el flujo histórico de poderes (campos en Owner) con el modelo
 * DocumentRequest / submissions / reviews para trazabilidad e historial.
 */
import { randomUUID } from "node:crypto";
import type { Owner } from "@prisma/client";
import { prisma } from "../../lib/prisma";

function mapProxyStatusToDocumentRequestStatus(proxy: string): "pending_upload" | "pending_review" | "approved" | "rejected" | "draft" {
  switch (proxy) {
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "pending_review":
      return "pending_review";
    case "awaiting_upload":
    case "not_required":
    default:
      return "pending_upload";
  }
}

/** Mantiene DocumentRequest (kind=proxy_power) alineado con Owner. */
export async function syncProxyDocumentRequestFromOwner(owner: Owner): Promise<void> {
  if (owner.participationRole !== "apoderado" || !owner.proxyRequestToken?.trim()) {
    return;
  }

  const unitLink = await prisma.unitOwner.findFirst({ where: { ownerId: owner.id } });
  const unitId = unitLink?.unitId ?? null;

  const status = mapProxyStatusToDocumentRequestStatus(owner.proxyApprovalStatus);

  await prisma.documentRequest.upsert({
    where: { publicToken: owner.proxyRequestToken },
    create: {
      id: randomUUID(),
      propertyId: owner.propertyId,
      ownerId: owner.id,
      unitId,
      kind: "proxy_power",
      status,
      publicToken: owner.proxyRequestToken,
      title: "Poder / apoderado",
      instructions: "Adjunta el documento de poder otorgado al apoderado.",
      metadataJson: JSON.stringify({ legacy: "owner_proxy_fields", version: 1 })
    },
    update: {
      status,
      unitId: unitId ?? undefined,
      updatedAt: new Date()
    }
  });
}

/** Tras subir archivo en el flujo público de proxy — una fila de historial por envío. */
export async function recordProxySubmissionFromOwnerState(ownerId: string): Promise<void> {
  const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
  if (!owner || owner.participationRole !== "apoderado" || !owner.proxyLastSubmittedAt) return;

  const dr = await prisma.documentRequest.findFirst({
    where: { ownerId, kind: "proxy_power" }
  });
  if (!dr) return;

  await prisma.documentSubmission.create({
    data: {
      id: randomUUID(),
      documentRequestId: dr.id,
      fileName: owner.proxyDocumentName ?? "poder.pdf",
      mimeType: owner.proxyDocumentMimeType,
      fileData: owner.proxyDocumentData ?? "",
      submittedByName: owner.proxySubmittedByName,
      submittedByEmail: owner.proxySubmittedByEmail,
      submittedByRole: owner.proxySubmittedByRole
    }
  });
}

export async function recordProxyReviewAction(
  ownerId: string,
  adminId: string,
  decision: "approved" | "rejected",
  reasons: string[],
  note?: string
): Promise<void> {
  const dr = await prisma.documentRequest.findFirst({
    where: { ownerId, kind: "proxy_power" }
  });
  if (!dr) return;

  const lastSub = await prisma.documentSubmission.findFirst({
    where: { documentRequestId: dr.id },
    orderBy: { submittedAt: "desc" }
  });

  await prisma.documentReviewAction.create({
    data: {
      id: randomUUID(),
      documentRequestId: dr.id,
      submissionId: lastSub?.id ?? null,
      actorAdminId: adminId,
      action: decision === "approved" ? "approve" : "reject",
      reasons,
      note: note ?? null
    }
  });
}
