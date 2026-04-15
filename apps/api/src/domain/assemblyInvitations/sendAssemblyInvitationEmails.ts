import { randomUUID } from "node:crypto";
import type { AssemblyInvitationDeliverySummary, AssemblyInvitationRecipientSummary } from "@kuoro/contracts";
import {
  listAssemblyInvitationsByAssembly,
  replaceAssemblyInvitations,
  type StoredAssembly,
  type StoredAssemblyInvitation
} from "../../db";
import { renderCommunicationEmailPlainText, renderCommunicationEmailTemplate } from "../../lib/email/communicationEmailTemplate";
import { resolveAppBaseUrl } from "../../lib/appUrls";
import { prisma } from "../../lib/prisma";
import type { ResendProvider } from "../../lib/resendProvider";

export type SendInvitationScope = "all_ready" | "unit";

export type SendInvitationEmailResult = {
  unitId: string;
  ok: boolean;
  skipped?: string;
  error?: string;
};

function formatAssemblyDateTime(iso: string, locale: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { date: "", time: "" };
  }
  const dateFmt = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
  return { date: dateFmt.format(d), time: timeFmt.format(d) };
}

function invitationRowToPayload(row: StoredAssemblyInvitation): Omit<StoredAssemblyInvitation, "id" | "assemblyId" | "createdAt" | "updatedAt"> {
  return {
    unitId: row.unitId,
    sentAt: row.sentAt,
    channel: row.channel,
    status: row.status,
    note: row.note
  };
}

async function resolveOrCreateAccessToken(assemblyId: string, unitId: string): Promise<string | null> {
  const rep = await prisma.assemblyRepresentation.findFirst({
    where: { assemblyId, representedUnitId: unitId, status: "active" }
  });
  if (rep?.accessToken) {
    return rep.accessToken;
  }

  let grant = await prisma.assemblyAccessGrant.findFirst({
    where: { assemblyId, unitId }
  });

  if (!grant) {
    grant = await prisma.assemblyAccessGrant.create({
      data: {
        id: randomUUID(),
        assemblyId,
        unitId,
        deliveryChannel: "email",
        validationMethod: "otp_email",
        preRegistrationStatus: "pending",
        dispatchStatus: "draft"
      }
    });
  }

  return grant.accessToken ?? null;
}

export async function sendAssemblyInvitationEmails(input: {
  propertyId: string;
  assembly: StoredAssembly;
  propertyName: string;
  recipients: AssemblyInvitationRecipientSummary[];
  scope: SendInvitationScope;
  unitId?: string;
  resend: ResendProvider;
  contactEmail?: string;
  locale?: string;
}): Promise<{ deliveries: AssemblyInvitationDeliverySummary[]; results: SendInvitationEmailResult[] }> {
  const { propertyId, assembly, propertyName, recipients, scope, unitId, resend, contactEmail, locale = "es-CO" } = input;
  const assemblyId = assembly.id;
  const baseUrl = resolveAppBaseUrl();

  const existing = await listAssemblyInvitationsByAssembly(assemblyId);
  const byUnit = new Map<string, StoredAssemblyInvitation>();
  for (const row of existing) {
    byUnit.set(row.unitId, row);
  }

  const { date: eventDate, time: eventTime } = formatAssemblyDateTime(assembly.scheduledAt, locale);

  let targetUnitIds: string[];
  if (scope === "unit") {
    if (!unitId?.trim()) {
      throw new Error("unitId requerido");
    }
    targetUnitIds = [unitId.trim()];
  } else {
    targetUnitIds = recipients.filter((r) => r.status === "ready" && Boolean(r.recipientEmail?.trim())).map((r) => r.unitId);
  }

  const results: SendInvitationEmailResult[] = [];

  for (const uid of targetUnitIds) {
    const recipient = recipients.find((r) => r.unitId === uid);
    const prev = byUnit.get(uid);

    if (!recipient) {
      results.push({ unitId: uid, ok: false, error: "Unidad no encontrada" });
      continue;
    }

    if (recipient.status !== "ready" || !recipient.recipientEmail?.trim()) {
      results.push({ unitId: uid, ok: false, skipped: "sin_email_o_no_listo" });
      continue;
    }

    if (scope === "all_ready" && prev?.status === "sent") {
      results.push({ unitId: uid, ok: true, skipped: "ya_enviada" });
      continue;
    }

    const accessToken = await resolveOrCreateAccessToken(assemblyId, uid);
    if (!accessToken) {
      const failTime = new Date().toISOString();
      byUnit.set(uid, {
        id: randomUUID(),
        assemblyId,
        unitId: uid,
        sentAt: failTime,
        channel: "email",
        status: "failed",
        note: "No se pudo generar token de acceso",
        createdAt: failTime,
        updatedAt: failTime
      });
      results.push({ unitId: uid, ok: false, error: "Token de acceso no disponible" });
      continue;
    }

    const attendeeUrl = `${baseUrl}/asistente/${propertyId}/${assemblyId}?token=${encodeURIComponent(accessToken)}`;
    const to = recipient.recipientEmail!.trim();

    const templatePayload = {
      preheader: `Convocatoria: ${assembly.title}`,
      badgeLabel: "Convocatoria",
      title: "Convocatoria a asamblea de copropietarios",
      introText:
        "Por medio del presente se le informa la convocatoria a la asamblea indicada. Utilice el botón para acceder a la sala con su enlace personal.",
      recipientName: recipient.recipientName,
      unitLabel: recipient.unitLabel,
      assemblyName: assembly.title,
      eventDate: eventDate || undefined,
      eventTime: eventTime || undefined,
      ctaLabel: "Abrir sala de asamblea",
      ctaUrl: attendeeUrl,
      contactEmail,
      propertyName,
      adminLabel: undefined
    };

    const html = renderCommunicationEmailTemplate(templatePayload);
    const text = renderCommunicationEmailPlainText(templatePayload);
    const subject = `Convocatoria — ${assembly.title}`;

    const sendResult = await resend.sendEmail({ to, subject, html, text });

    const now = new Date().toISOString();
    if (!sendResult.success) {
      byUnit.set(uid, {
        id: randomUUID(),
        assemblyId,
        unitId: uid,
        sentAt: now,
        channel: "email",
        status: "failed",
        note: sendResult.error ?? "Error de envío",
        createdAt: now,
        updatedAt: now
      });
      results.push({ unitId: uid, ok: false, error: sendResult.error ?? "Error de envío" });
      continue;
    }

    byUnit.set(uid, {
      id: randomUUID(),
      assemblyId,
      unitId: uid,
      sentAt: now,
      channel: "email",
      status: "sent",
      note: sendResult.messageId ? `resend:${sendResult.messageId}` : undefined,
      createdAt: now,
      updatedAt: now
    });
    results.push({ unitId: uid, ok: true });
  }

  const mergedPayload = Array.from(byUnit.values()).map(invitationRowToPayload);
  const saved = await replaceAssemblyInvitations(assemblyId, mergedPayload);

  const deliveries = saved.map((row) => ({
    unitId: row.unitId,
    sentAt: row.sentAt,
    channel: row.channel,
    status: row.status,
    note: row.note
  }));

  return { deliveries, results };
}
