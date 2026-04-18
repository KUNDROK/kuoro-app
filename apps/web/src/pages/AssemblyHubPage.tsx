import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Copy,
  ChevronRight,
  ChevronLeft,
  FileText,
  Lock,
  Mail,
  Monitor,
  MonitorOff,
  Play,
  Sparkles,
  Trash2,
  Users,
  Video,
  ExternalLink,
  Vote,
  Wifi,
  X
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "sonner";
import type {
  AgendaItemInput,
  AgendaItemSummary,
  AssemblyAccessConfigInput,
  AssemblyAccessGrantSummary,
  AssemblyConferenceService,
  AssemblyConfigInput,
  AssemblyDocumentInput,
  AssemblyDocumentSummary,
  AssemblyInvitationDeliverySummary,
  AssemblyInvitationRecipientSummary,
  AssemblyReadinessSummary,
  AssemblySummary,
  AssemblyVoteResultSummary,
  AuthResponse,
  PropertySummary,
  VotingSessionSummary
} from "@kuoro/contracts";
import type { HubTab } from "./assemblyHub/types";
import { ASSEMBLY_TYPE_OPTIONS, LIFECYCLE_STAGES, MODALITY_OPTIONS, TABS } from "./assemblyHub/hubConstants";
import {
  buildSlideFromPoint,
  conferenceServiceRequiresMeetingLink,
  createDefaultAccessConfig,
  createDefaultForm,
  createEmptyAgendaItem,
  createEmptyDocument,
  createSuggestedPresentation,
  formatDate,
  formatInvitationSentAt,
  getAllowedModalities,
  getInvitationStatusConfig,
  getStatusStyle,
  isPersistableAssemblyDocument,
  isVirtualConferenceConfigOk,
  meetingLinkHelperText,
  meetingLinkPlaceholder,
  normalizeAssemblyForm,
  updateLocalDateTime
} from "./assemblyHub/hubFormUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlatformShell } from "../components/PlatformShell";
import { LoadingModal } from "../components/ui/loading";
import { ConferenceAdmin, type SlidePayload } from "../components/conference/ConferenceAdmin";
import { VotingAdminPanel } from "../components/voting/VotingAdminPanel";
import { cacheHas } from "../lib/cache";
import {
  fetchAssemblyAccess,
  fetchAssemblyAgenda,
  fetchAssemblyDocuments,
  fetchAssemblyInvitations,
  fetchAssemblyReadiness,
  fetchMe,
  getStoredToken,
  listAssemblies,
  listAssemblyVoteResults,
  listVoteResults,
  putLiveSlide,
  saveAssemblyAccess,
  saveAssemblyAgenda,
  saveAssemblyDocuments,
  saveAssemblyInvitations,
  saveAssemblySettings,
  sendAssemblyInvitationsEmail
} from "../lib/api";

// ─── Shared UI helpers ────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 7,
  border: "0.5px solid var(--border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
  fontSize: 13,
  outline: "none"
};

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: "var(--text-secondary)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 7,
        backgroundColor: "var(--muted)"
      }}
    >
      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{value}</span>
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 7,
        backgroundColor: "var(--muted)",
        cursor: "pointer",
        fontSize: 12,
        color: "var(--foreground)"
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        style={{ accentColor: "var(--primary)", width: 13, height: 13 }}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AssemblyHubPage() {
  const { assemblyId } = useParams<{ assemblyId: string }>();
  const token = getStoredToken();
  if (!token) return <Navigate to="/login-admin" replace />;

  const [admin, setAdmin] = useState<AuthResponse["admin"] | null>(null);
  const [property, setProperty] = useState<PropertySummary | null>(null);
  const [assembly, setAssembly] = useState<AssemblySummary | null>(null);
  const [readiness, setReadiness] = useState<AssemblyReadinessSummary | null>(null);
  const [assemblyForm, setAssemblyForm] = useState<AssemblyConfigInput>(() => createDefaultForm());
  const [agenda, setAgenda] = useState<AgendaItemInput[]>(() => [createEmptyAgendaItem()]);
  const [savedAgenda, setSavedAgenda] = useState<AgendaItemSummary[]>([]);
  const [documents, setDocuments] = useState<AssemblyDocumentInput[]>(() => [createEmptyDocument()]);
  const [savedDocuments, setSavedDocuments] = useState<AssemblyDocumentSummary[]>([]);
  const [invitationRecipients, setInvitationRecipients] = useState<AssemblyInvitationRecipientSummary[]>([]);
  const [invitationDeliveries, setInvitationDeliveries] = useState<AssemblyInvitationDeliverySummary[]>([]);
  const [accessConfig, setAccessConfig] = useState<AssemblyAccessConfigInput>(() => createDefaultAccessConfig());
  const [accessGrants, setAccessGrants] = useState<AssemblyAccessGrantSummary[]>([]);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<HubTab>("config");
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [liveSlide, setLiveSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(() => !cacheHas("/auth/me"));
  const [isSaving, setIsSaving] = useState(false);
  const [inviteBulkBusy, setInviteBulkBusy] = useState(false);
  const [inviteUnitBusy, setInviteUnitBusy] = useState<string | null>(null);

  // ─── Screen share ──────────────────────────────────────────────────────────
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // ─── Voting (solo flujo API en sala; resultados sincronizan con la presentación) ──
  const [savedVoteResults, setSavedVoteResults] = useState<AssemblyVoteResultSummary[]>([]);
  /** Sesión de votación digital abierta vía API — alimenta slide "vote_active" para asistentes. */
  const [digitalLiveSession, setDigitalLiveSession] = useState<VotingSessionSummary | null>(null);

  // Resource viewer (document shown inline in sala)
  const [activeResource, setActiveResource] = useState<{ title: string; mimeType: string; data: string } | null>(null);

  // Canvas: diapositiva | resultados (manual o digital) | overlay mesa de votación admin
  const [canvasMode, setCanvasMode] = useState<"slide" | "vote_results" | "vote_live">("slide");
  const [canvasVoteResult, setCanvasVoteResult] = useState<AssemblyVoteResultSummary | null>(null);

  // ── Slide payload para el canal de datos de LiveKit ─────────────────────────
  // Se retransmite a los asistentes cada vez que cambia la diapositiva o el modo.
  const slidePayload = useMemo<SlidePayload>(() => {
    const liveItems = savedAgenda.length ? savedAgenda : agenda;
    const liveItem  = liveItems[liveSlide] as { title?: string; slideTitle?: string } | undefined;
    const base = {
      slideIndex:       liveSlide,
      totalSlides:      liveItems.length,
      agendaTitle:      liveItem?.title ?? "",
      agendaSlideTitle: (liveItem as { slideTitle?: string } | undefined)?.slideTitle,
      agendaContent:    (liveItem as { slideContent?: string } | undefined)?.slideContent,
      votePrompt:       (liveItem as { votePrompt?: string } | undefined)?.votePrompt,
    };

    if (canvasMode === "vote_results" && canvasVoteResult) {
      return {
        ...base,
        type:         "vote_results",
        voteQuestion: canvasVoteResult.question,
        voteResult: {
          question:    canvasVoteResult.question,
          approved:    canvasVoteResult.approved,
          yesVotes:    canvasVoteResult.yesVotes,
          noVotes:     canvasVoteResult.noVotes,
          abstainVotes: canvasVoteResult.abstainVotes,
          blankVotes:  canvasVoteResult.blankVotes,
        },
      };
    }
    if (digitalLiveSession?.status === "open") {
      return { ...base, type: "vote_active", voteQuestion: digitalLiveSession.question };
    }
    return { ...base, type: "slide" };
  }, [canvasMode, liveSlide, savedAgenda, agenda, canvasVoteResult, digitalLiveSession]);

  useEffect(() => {
    fetchMe()
      .then(async (data) => {
        const prop = data.properties[0] ?? null;
        setAdmin(data.admin);
        setProperty(prop);

        if (!prop) return;

        // Find the specific assembly by URL param
        const assembliesRes = await listAssemblies(prop.id);
        const targetAssembly = assembliesRes.assemblies.find((a) => a.id === assemblyId) ?? null;
        setAssembly(targetAssembly);

        const isClosed =
          !targetAssembly ||
          targetAssembly.status === "closed" ||
          targetAssembly.status === "archived";
        setIsReadOnly(isClosed);

        // Load vote results for closed assemblies too (for historical view)
        if (isClosed && targetAssembly) {
          try {
            const closedVotesRes = await listAssemblyVoteResults(prop.id, targetAssembly.id);
            setSavedVoteResults(closedVotesRes.results);
          } catch {
            // no votes recorded
          }
        }

        if (targetAssembly) {
          setAssemblyForm(
            normalizeAssemblyForm({
              title: targetAssembly.title,
              type: targetAssembly.type,
              modality: targetAssembly.modality,
              status: targetAssembly.status,
              scheduledAt: targetAssembly.scheduledAt,
              conferenceService: targetAssembly.conferenceService,
              location: targetAssembly.location ?? "",
              virtualAccessUrl: targetAssembly.virtualAccessUrl ?? "",
              notes: targetAssembly.notes ?? "",
              votingBasis: targetAssembly.votingBasis,
              allowsSecondCall: targetAssembly.allowsSecondCall,
              secondCallScheduledAt: targetAssembly.secondCallScheduledAt ?? ""
            })
          );
        }

        // Only load prep data for active assemblies
        if (!isClosed) {
          const [
            readinessRes,
            agendaRes,
            documentsRes,
            invitationsRes,
            accessRes,
            voteResultsRes
          ] = await Promise.all([
            fetchAssemblyReadiness(prop.id),
            fetchAssemblyAgenda(prop.id),
            fetchAssemblyDocuments(prop.id),
            fetchAssemblyInvitations(prop.id, assemblyId),
            fetchAssemblyAccess(prop.id),
            listVoteResults(prop.id)
          ]);
          setSavedVoteResults(voteResultsRes.results);

          setReadiness(readinessRes.readiness);
          setSavedAgenda(agendaRes.agenda);
          setSavedDocuments(documentsRes.documents);
          setInvitationRecipients(invitationsRes.recipients);
          setInvitationDeliveries(invitationsRes.deliveries);
          setAccessGrants(accessRes.grants);
          setAccessConfig(
            accessRes.config
              ? {
                  sessionAccessMode: accessRes.config.sessionAccessMode,
                  identityValidationMethod: accessRes.config.identityValidationMethod,
                  otpChannel: accessRes.config.otpChannel,
                  requireDocumentMatch: accessRes.config.requireDocumentMatch,
                  enableLobby: accessRes.config.enableLobby,
                  allowCompanions: accessRes.config.allowCompanions,
                  oneActiveVoterPerUnit: accessRes.config.oneActiveVoterPerUnit,
                  fallbackManualValidation: accessRes.config.fallbackManualValidation
                }
              : createDefaultAccessConfig()
          );

          setAgenda(
            agendaRes.agenda.length
              ? agendaRes.agenda.map((item) => ({
                  title: item.title,
                  description: item.description ?? "",
                  slideTitle: item.slideTitle ?? "",
                  slideContent: item.slideContent ?? "",
                  speakerNotes: item.speakerNotes ?? "",
                  votePrompt: item.votePrompt ?? "",
                  type: item.type,
                  votingRule: item.votingRule,
                  requiresAttachment: item.requiresAttachment
                }))
              : [createEmptyAgendaItem()]
          );

          setDocuments(
            documentsRes.documents.length
              ? documentsRes.documents.map((doc) => ({
                  title: doc.title,
                  documentName: doc.documentName,
                  documentMimeType: doc.documentMimeType ?? "",
                  documentData: doc.documentData,
                  category: doc.category,
                  agendaItemId: doc.agendaItemId ?? ""
                }))
              : [createEmptyDocument()]
          );
        }
      })
      .catch(() => toast.error("No fue posible cargar la asamblea"))
      .finally(() => setIsLoading(false));
  }, [assemblyId]);

  // ─── Screen share effect ──────────────────────────────────────────────────

  useEffect(() => {
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  // ─── Camera preview effect (stream from ConferenceAdmin via callback) ─────

  useEffect(() => {
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // ─── Publish live slide state to API so attendees can poll it ─────────────
  // Primary sync mechanism (guaranteed reliable vs. LiveKit data channel).

  useEffect(() => {
    if (!property || !assembly || assembly.status !== "in_progress") return;
    putLiveSlide(property.id, assembly.id, slidePayload as unknown as Record<string, unknown>).catch(() => {
      // Silent — non-critical, attendees will retry on next poll
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slidePayload, property?.id, assembly?.id]);

  // ─── Screen share handlers ────────────────────────────────────────────────

  async function startScreenShare() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      stream.getVideoTracks()[0]?.addEventListener("ended", () => setScreenStream(null));
      setScreenStream(stream);
    } catch {
      // user cancelled
    }
  }

  function stopScreenShare() {
    screenStream?.getTracks().forEach((t) => t.stop());
    setScreenStream(null);
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function updateAgendaItem(
    index: number,
    field: keyof AgendaItemInput,
    value: string | boolean | AgendaItemInput["type"] | AgendaItemInput["votingRule"]
  ) {
    setAgenda((cur) => cur.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function updateDocumentItem(index: number, field: keyof AssemblyDocumentInput, value: string) {
    setDocuments((cur) => cur.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  async function handleDocumentFileChange(index: number, file: File | null) {
    if (!file) return;
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    setDocuments((cur) =>
      cur.map((item, i) =>
        i === index
          ? { ...item, title: item.title || file.name, documentName: file.name, documentMimeType: file.type || "application/octet-stream", documentData: data }
          : item
      )
    );
  }

  function updateDeliveryStatus(unitId: string, status: AssemblyInvitationDeliverySummary["status"]) {
    setInvitationDeliveries((cur) => {
      const exists = cur.find((d) => d.unitId === unitId);
      if (exists) {
        return cur.map((d) => (d.unitId === unitId ? { ...d, status } : d));
      }
      const newDelivery: AssemblyInvitationDeliverySummary = {
        unitId,
        channel: "email",
        status,
        sentAt: new Date().toISOString()
      };
      return [...cur, newDelivery];
    });
  }

  async function saveConfig() {
    if (!property) return;
    const normalized = normalizeAssemblyForm(assemblyForm);
    const rv = normalized.modality === "virtual" || normalized.modality === "mixta";
    if (rv && conferenceServiceRequiresMeetingLink(normalized.conferenceService)) {
      const url = normalized.virtualAccessUrl?.trim();
      if (!url) {
        toast.error("Indica el enlace de la videoconferencia para la plataforma seleccionada.");
        return;
      }
      try {
        const u = new URL(url);
        if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("invalid protocol");
      } catch {
        toast.error("El enlace debe ser una URL válida (por ejemplo https://…).");
        return;
      }
    }
    setIsSaving(true);
    try {
      const res = await saveAssemblySettings(property.id, {
        ...normalized,
        location: normalized.location?.trim() || undefined,
        virtualAccessUrl: normalized.virtualAccessUrl?.trim() || undefined,
        notes: normalized.notes?.trim() || undefined,
        secondCallScheduledAt: undefined
      });
      setAssembly(res.assembly);
      setAssemblyForm(normalizeAssemblyForm(res.assembly));
      toast.success("Configuración guardada");
    } catch {
      toast.error("No fue posible guardar la configuración");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveAgenda() {
    if (!property) return;
    const agendaPayload = agenda.map((item) => ({
      ...item,
      title: item.title.trim(),
      description: item.description?.trim() || undefined,
      slideTitle: item.slideTitle?.trim() || undefined,
      slideContent: item.slideContent?.trim() || undefined,
      speakerNotes: item.speakerNotes?.trim() || undefined,
      votePrompt: item.votePrompt?.trim() || undefined
    }));
    const invalidAgenda = agendaPayload.some(
      (item) =>
        item.title.length < 5 ||
        !["informativo", "deliberativo", "votacion", "eleccion"].includes(item.type) ||
        !["ninguna", "simple", "calificada_70", "unanimidad"].includes(item.votingRule)
    );
    if (invalidAgenda) {
      toast.error("Cada punto debe tener título de al menos 5 caracteres y tipo/regla de votación válidos.");
      return;
    }
    const documentsPayload = documents.filter(isPersistableAssemblyDocument).map((doc) => ({
      title: doc.title.trim(),
      documentName: doc.documentName.trim(),
      documentMimeType: doc.documentMimeType?.trim() || undefined,
      documentData: doc.documentData.trim(),
      category: doc.category,
      agendaItemId: doc.agendaItemId?.trim() || undefined
    }));
    setIsSaving(true);
    try {
      const [agendaRes, docsRes] = await Promise.all([
        saveAssemblyAgenda(property.id, agendaPayload),
        saveAssemblyDocuments(property.id, documentsPayload)
      ]);
      setSavedAgenda(agendaRes.agenda);
      setSavedDocuments(docsRes.documents);
      toast.success("Agenda guardada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No fue posible guardar la agenda");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveConvocatoria() {
    if (!property || !assemblyId) return;
    setIsSaving(true);
    try {
      const res = await saveAssemblyInvitations(property.id, invitationDeliveries, assemblyId);
      setInvitationDeliveries(res.deliveries);
      toast.success("Estado de convocatoria actualizado");
    } catch {
      toast.error("No fue posible guardar la convocatoria");
    } finally {
      setIsSaving(false);
    }
  }

  async function sendInvitationsEmail(scope: "all_ready" | "unit", unitId?: string) {
    if (!property || !assemblyId) return;
    if (scope === "unit" && !unitId) return;
    if (scope === "all_ready") setInviteBulkBusy(true);
    else setInviteUnitBusy(unitId ?? null);
    try {
      const res = await sendAssemblyInvitationsEmail(property.id, {
        assemblyId: assembly?.id ?? assemblyId,
        scope,
        unitId
      });
      setInvitationDeliveries(res.deliveries);
      const sentOk = res.results.filter((r) => r.ok && !r.skipped);
      const failed = res.results.filter((r) => !r.ok);
      const onlyAlready = res.results.length > 0 && sentOk.length === 0 && failed.length === 0;
      if (failed.length > 0) {
        const msg = failed
          .map((f) => f.error || f.skipped)
          .filter(Boolean)
          .join(" · ");
        toast.error(msg || "Algunos envíos fallaron");
      } else if (sentOk.length > 0) {
        toast.success(scope === "all_ready" ? `Convocatorias enviadas: ${sentOk.length}` : "Convocatoria enviada");
      } else if (onlyAlready) {
        toast.info("Las convocatorias ya constaban como enviadas (no se reenvió a esas unidades).");
      }
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "No fue posible enviar la convocatoria";
      toast.error(msg);
    } finally {
      setInviteBulkBusy(false);
      setInviteUnitBusy(null);
    }
  }

  async function saveAcceso() {
    if (!property) return;
    setIsSaving(true);
    try {
      const res = await saveAssemblyAccess(property.id, {
        config: accessConfig,
        grants: accessGrants.map((g) => ({
          unitId: g.unitId,
          deliveryChannel: g.deliveryChannel,
          validationMethod: g.validationMethod,
          preRegistrationStatus: g.preRegistrationStatus,
          dispatchStatus: g.dispatchStatus,
          note: g.note?.trim() || undefined
        }))
      });
      setAccessConfig({
        sessionAccessMode: res.config.sessionAccessMode,
        identityValidationMethod: res.config.identityValidationMethod,
        otpChannel: res.config.otpChannel,
        requireDocumentMatch: res.config.requireDocumentMatch,
        enableLobby: res.config.enableLobby,
        allowCompanions: res.config.allowCompanions,
        oneActiveVoterPerUnit: res.config.oneActiveVoterPerUnit,
        fallbackManualValidation: res.config.fallbackManualValidation
      });
      setAccessGrants(res.grants);
      toast.success("Configuración de acceso guardada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No fue posible guardar el acceso");
    } finally {
      setIsSaving(false);
    }
  }

  async function advanceStatus(nextStatus: AssemblySummary["status"]) {
    if (!property || !assembly) return;
    if (nextStatus === "in_progress" && !isVirtualConferenceConfigOk(assemblyForm)) {
      toast.error("Completa y guarda el enlace de videoconferencia en General (o elige Kuoro Live) antes de abrir la sala.");
      return;
    }
    setIsSaving(true);
    try {
      const res = await saveAssemblySettings(property.id, {
        title: assemblyForm.title,
        type: assemblyForm.type,
        modality: assemblyForm.modality,
        status: nextStatus,
        scheduledAt: assemblyForm.scheduledAt,
        conferenceService: assemblyForm.conferenceService,
        location: assemblyForm.location?.trim() || undefined,
        virtualAccessUrl: assemblyForm.virtualAccessUrl?.trim() || undefined,
        notes: assemblyForm.notes?.trim() || undefined,
        votingBasis: assemblyForm.votingBasis,
        allowsSecondCall: assemblyForm.allowsSecondCall,
        secondCallScheduledAt: undefined
      });
      setAssembly(res.assembly);
      setAssemblyForm(normalizeAssemblyForm(res.assembly));
      toast.success("Estado actualizado");
    } catch {
      toast.error("No fue posible actualizar el estado");
    } finally {
      setIsSaving(false);
    }
  }

  // ─── Derived state ────────────────────────────────────────────────────────────

  const status = assembly?.status ?? "draft";
  const statusStyle = getStatusStyle(status);
  const currentStageIndex = LIFECYCLE_STAGES.findIndex((s) => s.status === status);
  const requiresPhysical = assemblyForm.modality === "presencial" || assemblyForm.modality === "mixta";
  const requiresVirtual = assemblyForm.modality === "virtual" || assemblyForm.modality === "mixta";
  const allowedModalities = getAllowedModalities(assemblyForm.type);
  const scheduleLabel = assemblyForm.type === "comunicacion_escrita" ? "Fecha límite" : "Fecha de la asamblea";

  const totalUnits = readiness?.totalUnits ?? 0;
  const representedUnits = readiness?.representedUnits ?? 0;
  const pendingProxyUnits = readiness?.pendingProxyUnits ?? 0;
  const noVoterUnits = readiness?.units.filter((u) => u.status === "no_voter").length ?? 0;
  const sentCount = invitationDeliveries.filter((d) => d.status === "sent").length;
  const failedInviteCount = invitationDeliveries.filter((d) => d.status === "failed").length;
  const readyRecipients = invitationRecipients.filter((r) => r.status === "ready").length;

  const canAdvanceToScheduled = Boolean(
    assembly &&
      assemblyForm.scheduledAt.trim().length >= 10 &&
      assemblyForm.title.trim().length >= 5 &&
      isVirtualConferenceConfigOk(assemblyForm)
  );
  const canAdvanceToInvitationSent = status === "scheduled";
  const canOpenSala = status === "invitation_sent" || status === "in_progress";
  const canClose = status === "in_progress";

  const quorumPct = totalUnits > 0 ? ((representedUnits / totalUnits) * 100).toFixed(1) : "0.0";

  // Conference service label
  const conferenceLabels: Record<string, string> = {
    ninguno: "Sin servicio",
    kuoro_live: "Kuoro Live (integrado)",
    enlace_externo: "Enlace externo",
    zoom: "Zoom",
    google_meet: "Google Meet",
    microsoft_teams: "Microsoft Teams",
    jitsi: "Jitsi",
    servicio_propio: "Servicio propio",
    por_definir: "Por definir"
  };

  const meetingUrlLive = (assembly?.virtualAccessUrl ?? assemblyForm.virtualAccessUrl)?.trim() ?? "";
  const conferenceServiceLive = (assembly?.conferenceService ?? assemblyForm.conferenceService) as AssemblyConferenceService;
  const salaUsesExternalConference =
    requiresVirtual && conferenceServiceLive !== "kuoro_live" && conferenceServiceLive !== "ninguno";

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <PlatformShell
      activeSection="assemblies"
      admin={admin}
      assistantScope={
        property && assemblyId ? { propertyId: property.id, assemblyId } : property ? { propertyId: property.id } : undefined
      }
      property={property}
      title={assembly?.title ?? "Asamblea"}
    >
      <LoadingModal visible={isSaving} message="Guardando cambios..." />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Readonly view for closed/archived assemblies */}
        {!isLoading && isReadOnly && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Link
              to="/asambleas"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", textDecoration: "none", marginBottom: 12 }}
            >
              <ArrowLeft size={12} />
              Todas las asambleas
            </Link>
            <div className="card-base" style={{ padding: 28 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
                <div>
                  <span
                    style={{
                      display: "inline-flex",
                      padding: "2px 10px",
                      borderRadius: 20,
                      fontSize: 10,
                      fontWeight: 500,
                      marginBottom: 8,
                      backgroundColor: "var(--muted)",
                      color: "var(--text-secondary)"
                    }}
                  >
                    Asamblea cerrada
                  </span>
                  <h1 style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--foreground)", margin: 0 }}>
                    {assembly?.title ?? "Asamblea sin título"}
                  </h1>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                    {formatDate(assembly?.scheduledAt)}
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  ["Tipo", ASSEMBLY_TYPE_OPTIONS.find((o) => o.value === assembly?.type)?.label ?? assembly?.type ?? "—"],
                  ["Modalidad", assembly?.modality ?? "—"],
                  ["Base de votación", assembly?.votingBasis ?? "—"]
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: "10px 14px", borderRadius: 7, backgroundColor: "var(--muted)" }}>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", textTransform: "capitalize" }}>{value}</div>
                  </div>
                ))}
              </div>
              {assembly?.notes && (
                <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 7, backgroundColor: "var(--muted)", fontSize: 12, color: "var(--text-secondary)" }}>
                  {assembly.notes}
                </div>
              )}
            </div>

            {/* Vote results for closed assembly */}
            {savedVoteResults.length > 0 && (
              <div className="card-base" style={{ padding: 24, marginTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 14 }}>
                  Resultados de votaciones ({savedVoteResults.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {savedVoteResults.map((r, idx) => {
                    const chartData = [
                      { name: "A favor", value: r.yesVotes, fill: "#3D9A6A" },
                      { name: "En contra", value: r.noVotes, fill: "#DC2626" },
                      { name: "Abstención", value: r.abstainVotes, fill: "#D97706" },
                      { name: "En blanco", value: r.blankVotes, fill: "#A8A49E" }
                    ].filter((d) => d.value > 0);
                    return (
                      <div key={r.id} style={{ padding: "14px 16px", borderRadius: 8, backgroundColor: "var(--muted)", border: `0.5px solid ${r.approved ? "var(--success)" : "var(--danger)"}` }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                          <div>
                            <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 3 }}>VOTACIÓN {idx + 1}</div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{r.question}</div>
                          </div>
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600, backgroundColor: r.approved ? "var(--success-surface)" : "var(--danger-surface)", color: r.approved ? "var(--success)" : "var(--danger)", flexShrink: 0 }}>
                            {r.approved ? "Aprobado" : "No aprobado"}
                          </span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, alignItems: "center" }}>
                          <ResponsiveContainer width="100%" height={100}>
                            <PieChart>
                              <Pie data={chartData} dataKey="value" cx="50%" cy="50%" innerRadius={25} outerRadius={45} paddingAngle={2}>
                                {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                              </Pie>
                              <Tooltip formatter={(v) => `${v}%`} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                            {[
                              ["A favor", r.yesVotes, "#3D9A6A"],
                              ["En contra", r.noVotes, "#DC2626"],
                              ["Abstención", r.abstainVotes, "#D97706"],
                              ["En blanco", r.blankVotes, "#A8A49E"]
                            ].map(([label, value, color]) => (
                              <div key={String(label)} style={{ padding: "5px 8px", borderRadius: 6, backgroundColor: "var(--background)" }}>
                                <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginBottom: 1 }}>{label}</div>
                                <div style={{ fontSize: 14, fontWeight: 500, color: String(color) }}>{value}%</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Active assembly hub - only show when not readonly */}
        {(isLoading || !isReadOnly) && (<>

        {/* ── Breadcrumb ───────────────────────────────────────────────── */}
        <Link
          to="/asambleas"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--text-secondary)",
            textDecoration: "none"
          }}
        >
          <ArrowLeft size={12} />
          Todas las asambleas
        </Link>

        {/* ── Header card: title + lifecycle strip ─────────────────────── */}
        <motion.div
          className="card-base"
          style={{ padding: "16px 20px" }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {isLoading ? (
            <LoadingModal variant="section" visible message="Cargando asamblea..." minHeight={280} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Title + status */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1
                    style={{
                      fontSize: 18,
                      fontWeight: 500,
                      letterSpacing: "-0.02em",
                      color: "var(--foreground)",
                      margin: 0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                  >
                    {assembly?.title ?? "Sin título"}
                  </h1>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
                    {formatDate(assembly?.scheduledAt)} · {property?.name ?? ""}
                  </div>
                </div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 500,
                    backgroundColor: statusStyle.bg,
                    color: statusStyle.color,
                    flexShrink: 0
                  }}
                >
                  {statusStyle.label}
                </span>
              </div>

              {/* Lifecycle progress track */}
              <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                {LIFECYCLE_STAGES.map((stage, i) => {
                  const isDone = i < currentStageIndex;
                  const isCurrent = i === currentStageIndex;
                  const isLast = i === LIFECYCLE_STAGES.length - 1;

                  return (
                    <div key={stage.status} style={{ display: "flex", alignItems: "center", flex: isLast ? 0 : 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "4px 8px",
                          borderRadius: 6,
                          backgroundColor: isCurrent ? "var(--primary)" : "transparent"
                        }}
                      >
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            backgroundColor: isDone
                              ? "var(--success)"
                              : isCurrent
                                ? "#FFFFFF"
                                : "var(--border)",
                            flexShrink: 0
                          }}
                        />
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: isCurrent ? 500 : 400,
                            color: isCurrent
                              ? "#FFFFFF"
                              : isDone
                                ? "var(--success)"
                                : "var(--text-tertiary)",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {stage.short}
                        </span>
                      </div>
                      {!isLast && (
                        <div
                          style={{
                            flex: 1,
                            height: "0.5px",
                            backgroundColor: isDone ? "var(--success)" : "var(--border)",
                            margin: "0 4px"
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Lifecycle action buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {status === "draft" && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!canAdvanceToScheduled || isSaving}
                    onClick={() => void advanceStatus("scheduled")}
                    title={!canAdvanceToScheduled ? "Configura título y fecha para programar" : undefined}
                    style={{ backgroundColor: "var(--primary)", color: "#FFFFFF", borderRadius: 7, fontSize: 12 }}
                  >
                    Programar asamblea
                  </Button>
                )}
                {status === "scheduled" && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isSaving}
                    onClick={() => void advanceStatus("invitation_sent")}
                    style={{ backgroundColor: "var(--primary)", color: "#FFFFFF", borderRadius: 7, fontSize: 12 }}
                  >
                    Marcar como convocada
                  </Button>
                )}
                {status === "invitation_sent" && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isSaving}
                    onClick={() => {
                      void advanceStatus("in_progress");
                      setActiveTab("sala");
                    }}
                    style={{ backgroundColor: "var(--success)", color: "#FFFFFF", borderRadius: 7, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <Play size={11} />
                    Iniciar sala
                  </Button>
                )}
                {status === "in_progress" && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isSaving}
                    onClick={() => void advanceStatus("closed")}
                    style={{ backgroundColor: "var(--danger)", color: "#FFFFFF", borderRadius: 7, fontSize: 12 }}
                  >
                    Cerrar asamblea
                  </Button>
                )}
                <div style={{ flex: 1 }} />
                {/* Metrics strip */}
                {[
                  { label: "Representadas", value: `${representedUnits}/${totalUnits}` },
                  { label: "Quórum proyectado", value: `${quorumPct}%` },
                  { label: "Convocatoria enviada", value: `${sentCount}` },
                  { label: "Puntos de agenda", value: String(savedAgenda.length) }
                ].map(({ label, value }) => (
                  <div key={label} style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Tab bar ──────────────────────────────────────────────────── */}
        <div
          className="card-base"
          style={{ padding: "0 4px", display: "flex", alignItems: "center", overflowX: "auto", gap: 2 }}
        >
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            const isLocked =
              (tab.id === "sala" && !canOpenSala) ||
              (tab.id === "post" && status !== "closed" && status !== "archived");
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => !isLocked && setActiveTab(tab.id)}
                title={isLocked ? "Disponible cuando la asamblea esté en ese estado" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "11px 14px",
                  border: "none",
                  borderBottom: isActive ? "2px solid var(--primary)" : "2px solid transparent",
                  backgroundColor: "transparent",
                  cursor: isLocked ? "not-allowed" : "pointer",
                  fontSize: 12,
                  fontWeight: isActive ? 500 : 400,
                  color: isLocked
                    ? "var(--text-tertiary)"
                    : isActive
                      ? "var(--primary)"
                      : "var(--text-secondary)",
                  whiteSpace: "nowrap",
                  opacity: isLocked ? 0.5 : 1,
                  transition: "color 150ms ease, border-color 150ms ease"
                }}
              >
                {tab.icon}
                {tab.label}
                {isLocked && <Lock size={10} style={{ opacity: 0.6 }} />}
              </button>
            );
          })}
        </div>

        {/* ── Tab content ───────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="card-base"
            style={{ padding: 24 }}
          >

            {/* ── Tab: Configuración ─────────────────────────────────── */}
            {activeTab === "config" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 2 }}>
                    Configuración general
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                    Define el tipo, fecha, modalidad y plataforma de la asamblea.
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <FormField label="Título">
                      <Input
                        value={assemblyForm.title}
                        style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                        onChange={(e) => setAssemblyForm((c) => ({ ...c, title: e.target.value }))}
                      />
                    </FormField>
                  </div>

                  <FormField label="Tipo de asamblea">
                    <select
                      value={assemblyForm.type === "mixta" ? "ordinaria" : assemblyForm.type}
                      style={selectStyle}
                      onChange={(e) =>
                        setAssemblyForm((c) =>
                          normalizeAssemblyForm({ ...c, type: e.target.value as AssemblyConfigInput["type"] })
                        )
                      }
                    >
                      {ASSEMBLY_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {ASSEMBLY_TYPE_OPTIONS.find((o) => o.value === assemblyForm.type)?.description}
                    </span>
                  </FormField>

                  <FormField label="Modalidad">
                    <select
                      value={assemblyForm.modality}
                      style={selectStyle}
                      onChange={(e) =>
                        setAssemblyForm((c) =>
                          normalizeAssemblyForm({ ...c, modality: e.target.value as AssemblyConfigInput["modality"] })
                        )
                      }
                    >
                      {allowedModalities.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label={scheduleLabel}>
                    <Input
                      type="date"
                      value={assemblyForm.scheduledAt.split("T")[0] ?? ""}
                      style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                      onChange={(e) =>
                        setAssemblyForm((c) => ({
                          ...c,
                          scheduledAt: updateLocalDateTime(c.scheduledAt, "date", e.target.value)
                        }))
                      }
                    />
                  </FormField>

                  <FormField label="Hora">
                    <Input
                      type="time"
                      value={assemblyForm.scheduledAt.split("T")[1]?.slice(0, 5) ?? ""}
                      style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                      onChange={(e) =>
                        setAssemblyForm((c) => ({
                          ...c,
                          scheduledAt: updateLocalDateTime(c.scheduledAt, "time", e.target.value)
                        }))
                      }
                    />
                  </FormField>

                  <FormField label="Base de votación">
                    <select
                      value={assemblyForm.votingBasis}
                      style={selectStyle}
                      onChange={(e) =>
                        setAssemblyForm((c) => ({
                          ...c,
                          votingBasis: e.target.value as AssemblyConfigInput["votingBasis"]
                        }))
                      }
                    >
                      <option value="coeficientes">Coeficientes de copropiedad</option>
                      <option value="modulos">Módulos</option>
                      <option value="unidad">Una unidad, un voto</option>
                    </select>
                  </FormField>

                  {requiresVirtual && (
                    <FormField label="Plataforma de video">
                      <select
                        value={assemblyForm.conferenceService}
                        style={selectStyle}
                        onChange={(e) => {
                          const next = e.target.value as AssemblyConfigInput["conferenceService"];
                          setAssemblyForm((c) =>
                            normalizeAssemblyForm({
                              ...c,
                              conferenceService: next,
                              virtualAccessUrl: next === "kuoro_live" ? "" : c.virtualAccessUrl
                            })
                          );
                        }}
                      >
                        <option value="kuoro_live">Kuoro Live (integrado)</option>
                        <option value="enlace_externo">Enlace externo</option>
                        <option value="zoom">Zoom</option>
                        <option value="google_meet">Google Meet</option>
                        <option value="microsoft_teams">Microsoft Teams</option>
                        <option value="jitsi">Jitsi</option>
                        <option value="por_definir">Por definir</option>
                      </select>
                      {assemblyForm.conferenceService === "kuoro_live" && (
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                          La sala estará disponible dentro de la plataforma. No se requiere enlace externo.
                        </span>
                      )}
                    </FormField>
                  )}

                  {requiresVirtual && assemblyForm.conferenceService !== "kuoro_live" && (
                    <FormField
                      label={
                        conferenceServiceRequiresMeetingLink(assemblyForm.conferenceService)
                          ? "Enlace de la videoconferencia"
                          : "Enlace de la reunión (opcional)"
                      }
                    >
                      <Input
                        type="url"
                        inputMode="url"
                        autoComplete="url"
                        placeholder={meetingLinkPlaceholder(assemblyForm.conferenceService)}
                        value={assemblyForm.virtualAccessUrl ?? ""}
                        style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                        onChange={(e) => setAssemblyForm((c) => ({ ...c, virtualAccessUrl: e.target.value }))}
                      />
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)", display: "block", marginTop: 6, lineHeight: 1.45 }}>
                        {meetingLinkHelperText(assemblyForm.conferenceService)}
                        {conferenceServiceRequiresMeetingLink(assemblyForm.conferenceService) && (
                          <> Requerido antes de programar la asamblea.</>
                        )}
                      </span>
                    </FormField>
                  )}

                  {requiresPhysical && (
                    <FormField label="Lugar físico">
                      <Input
                        value={assemblyForm.location ?? ""}
                        style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 13 }}
                        placeholder="Ej: Salón comunal, piso 2"
                        onChange={(e) => setAssemblyForm((c) => ({ ...c, location: e.target.value }))}
                      />
                    </FormField>
                  )}

                  <div style={{ gridColumn: "1 / -1" }}>
                    <FormField label="Notas internas (solo visibles para el administrador)">
                      <Textarea
                        value={assemblyForm.notes ?? ""}
                        rows={3}
                        style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 12, resize: "vertical" }}
                        onChange={(e) => setAssemblyForm((c) => ({ ...c, notes: e.target.value }))}
                      />
                    </FormField>
                  </div>
                </div>

                <div style={{ paddingTop: 12, borderTop: "0.5px solid var(--border)" }}>
                  <Button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void saveConfig()}
                    style={{ backgroundColor: "var(--primary)", color: "#FFFFFF", borderRadius: 7, fontSize: 13 }}
                  >
                    {isSaving ? "Guardando..." : "Guardar configuración"}
                  </Button>
                </div>
              </div>
            )}

            {/* ── Tab: Agenda ────────────────────────────────────────── */}
            {activeTab === "agenda" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 2 }}>
                      Agenda y presentación
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                      Construye los puntos que guiarán la asamblea. Cada punto genera una diapositiva para los propietarios.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setAgenda(createSuggestedPresentation(assemblyForm.title));
                      setSelectedSlide(0);
                    }}
                    style={{ fontSize: 12, borderRadius: 7, flexShrink: 0 }}
                  >
                    <Sparkles size={12} style={{ marginRight: 4 }} />
                    Usar estructura base
                  </Button>
                </div>

                {/* Two-column: slide list + editor */}
                <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 260px", gap: 12 }}>
                  {/* Slide list */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {agenda.map((item, index) => (
                      <button
                        key={`slide-${index}`}
                        type="button"
                        onClick={() => setSelectedSlide(index)}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: 2,
                          padding: "8px 10px",
                          borderRadius: 7,
                          border: "none",
                          cursor: "pointer",
                          backgroundColor: selectedSlide === index ? "var(--accent)" : "var(--muted)",
                          textAlign: "left",
                          width: "100%",
                          transition: "background-color 100ms ease"
                        }}
                      >
                        <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600 }}>
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            color: selectedSlide === index ? "var(--accent-foreground)" : "var(--foreground)",
                            lineHeight: 1.3
                          }}
                        >
                          {item.title || "Sin título"}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                          {item.type}{item.votingRule !== "ninguna" ? ` · ${item.votingRule}` : ""}
                        </span>
                      </button>
                    ))}
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        style={{ fontSize: 11, borderRadius: 7, flex: 1 }}
                        onClick={() => {
                          setAgenda((c) => [...c, createEmptyAgendaItem()]);
                          setSelectedSlide(agenda.length);
                        }}
                      >
                        + Agregar
                      </Button>
                      {agenda.length > 1 && (
                        <Button
                          variant="secondary"
                          size="sm"
                          type="button"
                          style={{ fontSize: 11, borderRadius: 7, padding: "0 8px" }}
                          onClick={() => {
                            setAgenda((c) => c.filter((_, i) => i !== selectedSlide));
                            setSelectedSlide((s) => Math.max(0, s - 1));
                          }}
                        >
                          <Trash2 size={11} />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Editor */}
                  {agenda[selectedSlide] && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <FormField label="Punto de agenda">
                        <Input
                          value={agenda[selectedSlide].title}
                          style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 12 }}
                          onChange={(e) => updateAgendaItem(selectedSlide, "title", e.target.value)}
                        />
                      </FormField>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <FormField label="Tipo">
                          <select
                            value={agenda[selectedSlide].type}
                            style={selectStyle}
                            onChange={(e) => updateAgendaItem(selectedSlide, "type", e.target.value as AgendaItemInput["type"])}
                          >
                            <option value="informativo">Informativo</option>
                            <option value="deliberativo">Deliberativo</option>
                            <option value="votacion">Votación</option>
                            <option value="eleccion">Elección</option>
                          </select>
                        </FormField>
                        <FormField label="Regla de votación">
                          <select
                            value={agenda[selectedSlide].votingRule}
                            style={selectStyle}
                            onChange={(e) => updateAgendaItem(selectedSlide, "votingRule", e.target.value as AgendaItemInput["votingRule"])}
                          >
                            <option value="ninguna">Ninguna</option>
                            <option value="simple">Mayoría simple</option>
                            <option value="calificada_70">Calificada 70%</option>
                            <option value="unanimidad">Unanimidad</option>
                          </select>
                        </FormField>
                      </div>

                      <FormField label="Descripción del punto">
                        <Textarea
                          value={agenda[selectedSlide].description ?? ""}
                          rows={3}
                          style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 12, resize: "vertical" }}
                          onChange={(e) => updateAgendaItem(selectedSlide, "description", e.target.value)}
                        />
                      </FormField>

                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        style={{ fontSize: 11, borderRadius: 7, alignSelf: "flex-start" }}
                        onClick={() => setAgenda((cur) => cur.map((item, i) => (i === selectedSlide ? buildSlideFromPoint(item) : item)))}
                      >
                        Generar diapositiva desde descripción
                      </Button>

                      <div style={{ height: "0.5px", backgroundColor: "var(--border)" }} />

                      <FormField label="Título de la diapositiva (visible en pantalla)">
                        <Input
                          value={agenda[selectedSlide].slideTitle ?? ""}
                          style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 12 }}
                          onChange={(e) => updateAgendaItem(selectedSlide, "slideTitle", e.target.value)}
                        />
                      </FormField>

                      <FormField label="Contenido visible para los propietarios">
                        <Textarea
                          value={agenda[selectedSlide].slideContent ?? ""}
                          rows={3}
                          style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 12, resize: "vertical" }}
                          onChange={(e) => updateAgendaItem(selectedSlide, "slideContent", e.target.value)}
                        />
                      </FormField>

                      <FormField label="Notas del moderador (solo tú las ves)">
                        <Textarea
                          value={agenda[selectedSlide].speakerNotes ?? ""}
                          rows={2}
                          style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 12, resize: "vertical" }}
                          onChange={(e) => updateAgendaItem(selectedSlide, "speakerNotes", e.target.value)}
                        />
                      </FormField>

                      {(agenda[selectedSlide].type === "votacion" || agenda[selectedSlide].type === "eleccion") && (
                        <FormField label="Pregunta de votación">
                          <Input
                            value={agenda[selectedSlide].votePrompt ?? ""}
                            style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 12 }}
                            placeholder="¿Aprueba la propuesta presentada?"
                            onChange={(e) => updateAgendaItem(selectedSlide, "votePrompt", e.target.value)}
                          />
                        </FormField>
                      )}

                      <CheckRow
                        label="Este punto requiere anexo de soporte"
                        checked={agenda[selectedSlide].requiresAttachment}
                        onChange={(v) => updateAgendaItem(selectedSlide, "requiresAttachment", v)}
                      />
                    </div>
                  )}

                  {/* Slide preview */}
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 10,
                      background: "linear-gradient(135deg, var(--primary) 0%, #534AB7 100%)",
                      color: "#FFFFFF",
                      alignSelf: "flex-start",
                      position: "sticky",
                      top: 84
                    }}
                  >
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", opacity: 0.7, marginBottom: 10, textTransform: "uppercase" }}>
                      Vista previa
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.3, marginBottom: 8 }}>
                      {agenda[selectedSlide]?.slideTitle || agenda[selectedSlide]?.title || "Título de la diapositiva"}
                    </div>
                    <p style={{ fontSize: 11, opacity: 0.85, lineHeight: 1.6, margin: "0 0 10px", whiteSpace: "pre-line" }}>
                      {agenda[selectedSlide]?.slideContent || "El contenido de la diapositiva aparecerá aquí durante la transmisión."}
                    </p>
                    {agenda[selectedSlide]?.votePrompt && (
                      <div
                        style={{
                          padding: "8px 10px",
                          borderRadius: 7,
                          backgroundColor: "rgba(255,255,255,0.15)",
                          fontSize: 11,
                          fontWeight: 500,
                          lineHeight: 1.4
                        }}
                      >
                        Votación: {agenda[selectedSlide].votePrompt}
                      </div>
                    )}
                    {agenda[selectedSlide]?.speakerNotes && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: "8px 10px",
                          borderRadius: 7,
                          backgroundColor: "rgba(0,0,0,0.2)",
                          fontSize: 10,
                          opacity: 0.8,
                          lineHeight: 1.5
                        }}
                      >
                        {agenda[selectedSlide].speakerNotes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Attachments section */}
                <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 12 }}>
                    Anexos y documentos
                  </div>
                  {documents.map((doc, index) => (
                    <div
                      key={`doc-${index}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr auto",
                        gap: 10,
                        padding: "12px",
                        borderRadius: 7,
                        backgroundColor: "var(--muted)",
                        marginBottom: 8,
                        alignItems: "end"
                      }}
                    >
                      <FormField label={`Título del anexo ${index + 1}`}>
                        <Input
                          value={doc.title}
                          style={{ borderRadius: 7, borderWidth: "0.5px", fontSize: 12 }}
                          onChange={(e) => updateDocumentItem(index, "title", e.target.value)}
                        />
                      </FormField>
                      <FormField label="Categoría">
                        <select
                          value={doc.category}
                          style={selectStyle}
                          onChange={(e) => updateDocumentItem(index, "category", e.target.value)}
                        >
                          <option value="convocatoria">Convocatoria</option>
                          <option value="informe">Informe</option>
                          <option value="soporte">Soporte</option>
                          <option value="presupuesto">Presupuesto</option>
                          <option value="reglamento">Reglamento</option>
                          <option value="otro">Otro</option>
                        </select>
                      </FormField>
                      <FormField label="Archivo">
                        <input
                          type="file"
                          style={{ fontSize: 12, color: "var(--foreground)" }}
                          onChange={(e) => void handleDocumentFileChange(index, e.target.files?.[0] ?? null)}
                        />
                      </FormField>
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        style={{ padding: "0 8px" }}
                        onClick={() => setDocuments((c) => c.filter((_, i) => i !== index))}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    style={{ fontSize: 12, borderRadius: 7 }}
                    onClick={() => setDocuments((c) => [...c, createEmptyDocument()])}
                  >
                    + Agregar anexo
                  </Button>
                </div>

                <div style={{ paddingTop: 12, borderTop: "0.5px solid var(--border)" }}>
                  <Button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void saveAgenda()}
                    style={{ backgroundColor: "var(--primary)", color: "#FFFFFF", borderRadius: 7, fontSize: 13 }}
                  >
                    {isSaving ? "Guardando..." : "Guardar agenda y anexos"}
                  </Button>
                </div>
              </div>
            )}

            {/* ── Tab: Convocatoria ────────────────────────────────────── */}
            {activeTab === "convocatoria" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 2 }}>
                      Convocatoria y notificaciones
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                      Envía la convocatoria por correo (plantilla Kuoro) con el enlace personal de cada unidad, o registra un envío
                      manual si lo hiciste fuera de la plataforma.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 12, flexShrink: 0, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Listos para convocar</div>
                        <div style={{ fontSize: 15, fontWeight: 500, color: "var(--foreground)" }}>{readyRecipients}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Enviadas</div>
                        <div style={{ fontSize: 15, fontWeight: 500, color: "var(--success)" }}>{sentCount}</div>
                      </div>
                      {failedInviteCount > 0 && (
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Fallidas</div>
                          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--danger)" }}>{failedInviteCount}</div>
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={isSaving || inviteBulkBusy || readyRecipients === 0 || isReadOnly}
                      onClick={() => void sendInvitationsEmail("all_ready")}
                      style={{ borderRadius: 7, fontSize: 12 }}
                    >
                      {inviteBulkBusy ? "Enviando…" : "Enviar convocatoria a todos"}
                    </Button>
                  </div>
                </div>

                {/* Recipient table */}
                {invitationRecipients.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", backgroundColor: "var(--muted)", borderRadius: 10 }}>
                    <Users size={24} style={{ color: "var(--text-tertiary)", margin: "0 auto 8px" }} />
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      Sin propietarios registrados. Agrega unidades y propietarios primero.
                    </div>
                  </div>
                ) : (
                  <div style={{ border: "0.5px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 120px minmax(160px, 1fr) minmax(200px, 1fr)",
                        padding: "8px 16px",
                        backgroundColor: "var(--muted)",
                        borderBottom: "0.5px solid var(--border)"
                      }}
                    >
                      {["Unidad / propietario", "Contacto", "Estado convocatoria", "Acciones"].map((h) => (
                        <span key={h} style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                          {h}
                        </span>
                      ))}
                    </div>
                    {invitationRecipients.map((recipient) => {
                      const delivery = invitationDeliveries.find((d) => d.unitId === recipient.unitId);
                      const statusCfg = getInvitationStatusConfig(recipient.status);
                      const convStatus = delivery?.status;
                      const canEmail = recipient.status === "ready" && Boolean(recipient.recipientEmail?.trim());
                      const unitBusy = inviteUnitBusy === recipient.unitId;
                      return (
                        <div
                          key={recipient.unitId}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 120px minmax(160px, 1fr) minmax(200px, 1fr)",
                            padding: "10px 16px",
                            borderBottom: "0.5px solid var(--border)",
                            alignItems: "center",
                            gap: 8
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
                              {recipient.unitLabel}
                            </div>
                            {recipient.recipientName && (
                              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{recipient.recipientName}</div>
                            )}
                            {recipient.recipientEmail && (
                              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{recipient.recipientEmail}</div>
                            )}
                          </div>
                          <span
                            style={{
                              display: "inline-flex",
                              padding: "2px 8px",
                              borderRadius: 20,
                              fontSize: 10,
                              fontWeight: 500,
                              backgroundColor: statusCfg.bg,
                              color: statusCfg.color,
                              width: "fit-content"
                            }}
                          >
                            {statusCfg.label}
                          </span>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10 }}>
                            {!delivery && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  padding: "2px 8px",
                                  borderRadius: 20,
                                  fontWeight: 500,
                                  backgroundColor: "var(--muted)",
                                  color: "var(--text-tertiary)",
                                  width: "fit-content"
                                }}
                              >
                                <Mail size={10} /> Sin registro
                              </span>
                            )}
                            {delivery?.status === "sent" && (
                              <div>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                    padding: "2px 8px",
                                    borderRadius: 20,
                                    fontWeight: 500,
                                    backgroundColor: "var(--success-surface)",
                                    color: "var(--success)",
                                    width: "fit-content"
                                  }}
                                >
                                  <CheckCircle size={10} /> Enviada
                                </span>
                                {delivery.sentAt && (
                                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
                                    {formatInvitationSentAt(delivery.sentAt)}
                                  </div>
                                )}
                              </div>
                            )}
                            {delivery?.status === "pending" && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  padding: "2px 8px",
                                  borderRadius: 20,
                                  fontWeight: 500,
                                  backgroundColor: "var(--muted)",
                                  color: "var(--text-tertiary)",
                                  width: "fit-content"
                                }}
                              >
                                <Mail size={10} /> Pendiente
                              </span>
                            )}
                            {delivery?.status === "failed" && (
                              <div>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                    padding: "2px 8px",
                                    borderRadius: 20,
                                    fontWeight: 500,
                                    backgroundColor: "var(--danger-surface)",
                                    color: "var(--danger)",
                                    width: "fit-content"
                                  }}
                                >
                                  <AlertCircle size={10} /> Error al enviar
                                </span>
                                {delivery.note && (
                                  <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.35 }}>
                                    {delivery.note}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                            <Button
                              variant="secondary"
                              size="sm"
                              type="button"
                              disabled={
                                isReadOnly ||
                                !canEmail ||
                                inviteBulkBusy ||
                                unitBusy ||
                                (recipient.status === "missing_contact" && convStatus !== "sent")
                              }
                              onClick={() => void sendInvitationsEmail("unit", recipient.unitId)}
                              style={{ fontSize: 11, borderRadius: 7 }}
                            >
                              {unitBusy ? "Enviando…" : convStatus === "sent" ? "Reenviar convocatoria" : "Enviar convocatoria"}
                            </Button>
                            <button
                              type="button"
                              disabled={isReadOnly || isSaving}
                              onClick={() =>
                                updateDeliveryStatus(
                                  recipient.unitId,
                                  convStatus === "sent" || convStatus === "failed" ? "pending" : "sent"
                                )
                              }
                              style={{
                                fontSize: 10,
                                color: "var(--text-tertiary)",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                textDecoration: "underline",
                                padding: 0
                              }}
                            >
                              {convStatus === "sent" || convStatus === "failed"
                                ? "Quitar registro manual / marcar pendiente"
                                : "Registrar envío manual (fuera de Kuoro)"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ paddingTop: 12, borderTop: "0.5px solid var(--border)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Button
                    type="button"
                    disabled={isSaving || isReadOnly}
                    onClick={() => void saveConvocatoria()}
                    style={{ backgroundColor: "var(--primary)", color: "#FFFFFF", borderRadius: 7, fontSize: 13 }}
                  >
                    {isSaving ? "Guardando..." : "Guardar cambios manuales"}
                  </Button>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    Usa “Guardar” solo si ajustaste el registro manual. El envío por correo se guarda solo al enviar.
                  </span>
                </div>
              </div>
            )}

            {/* ── Tab: Acceso e Identidad ──────────────────────────────── */}
            {activeTab === "acceso" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 2 }}>
                    Acceso e identidad
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                    Configura cómo los propietarios ingresarán a la sala y cómo se verificará su identidad.
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <FormField label="Modo de acceso">
                    <select
                      value={accessConfig.sessionAccessMode}
                      style={selectStyle}
                      onChange={(e) =>
                        setAccessConfig((c) => ({
                          ...c,
                          sessionAccessMode: e.target.value as AssemblyAccessConfigInput["sessionAccessMode"]
                        }))
                      }
                    >
                      <option value="enlace_unico">Enlace único por unidad</option>
                      <option value="codigo_y_documento">Código + documento</option>
                      <option value="pre_registro_asistido">Pre-registro asistido</option>
                    </select>
                  </FormField>

                  <FormField label="Verificación de identidad">
                    <select
                      value={accessConfig.identityValidationMethod}
                      style={selectStyle}
                      onChange={(e) =>
                        setAccessConfig((c) => ({
                          ...c,
                          identityValidationMethod: e.target.value as AssemblyAccessConfigInput["identityValidationMethod"],
                          otpChannel:
                            e.target.value === "otp_email"
                              ? "email"
                              : e.target.value === "otp_sms"
                                ? "sms"
                                : "no_aplica"
                        }))
                      }
                    >
                      <option value="otp_email">OTP por correo electrónico</option>
                      <option value="otp_sms">OTP por SMS</option>
                      <option value="validacion_manual">Validación manual</option>
                      <option value="sin_otp">Sin verificación adicional</option>
                    </select>
                  </FormField>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <CheckRow
                    label="Sala de espera activa (los propietarios esperan aprobación antes de ingresar)"
                    checked={accessConfig.enableLobby}
                    onChange={(v) => setAccessConfig((c) => ({ ...c, enableLobby: v }))}
                  />
                  <CheckRow
                    label="Documento de identidad obligatorio"
                    checked={accessConfig.requireDocumentMatch}
                    onChange={(v) => setAccessConfig((c) => ({ ...c, requireDocumentMatch: v }))}
                  />
                  <CheckRow
                    label="Permitir acompañantes (sin voto)"
                    checked={accessConfig.allowCompanions}
                    onChange={(v) => setAccessConfig((c) => ({ ...c, allowCompanions: v }))}
                  />
                  <CheckRow
                    label="Un votante activo por unidad"
                    checked={accessConfig.oneActiveVoterPerUnit}
                    onChange={(v) => setAccessConfig((c) => ({ ...c, oneActiveVoterPerUnit: v }))}
                  />
                  <CheckRow
                    label="Validación manual de respaldo disponible"
                    checked={accessConfig.fallbackManualValidation}
                    onChange={(v) => setAccessConfig((c) => ({ ...c, fallbackManualValidation: v }))}
                  />
                </div>

                {/* Access grants table */}
                {accessGrants.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", marginBottom: 8, marginTop: 4 }}>
                      Estado de acceso por unidad ({accessGrants.filter((g) => g.accessStatus === "ready").length}/{accessGrants.length} listos)
                    </div>
                    <div style={{ border: "0.5px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 100px 140px 120px",
                          padding: "8px 16px",
                          backgroundColor: "var(--muted)",
                          borderBottom: "0.5px solid var(--border)"
                        }}
                      >
                        {["Unidad", "Tipo", "Estado", "Canal"].map((h) => (
                          <span key={h} style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                            {h}
                          </span>
                        ))}
                      </div>
                      {accessGrants.slice(0, 20).map((grant) => {
                        const isReady = grant.accessStatus === "ready";
                        return (
                          <div
                            key={grant.unitId}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 100px 140px 120px",
                              padding: "10px 16px",
                              borderBottom: "0.5px solid var(--border)",
                              alignItems: "center"
                            }}
                          >
                            <div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
                              {grant.unitLabel}
                            </div>
                            {grant.representativeName && (
                              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{grant.representativeName}</div>
                            )}
                            </div>
                            <span style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "capitalize" }}>
                              {grant.unitType}
                            </span>
                            <span
                              style={{
                                display: "inline-flex",
                                padding: "2px 8px",
                                borderRadius: 20,
                                fontSize: 10,
                                fontWeight: 500,
                                backgroundColor: isReady ? "var(--success-surface)" : "var(--warning-surface)",
                                color: isReady ? "var(--success)" : "var(--warning)",
                                width: "fit-content"
                              }}
                            >
                              {isReady ? "Listo" : grant.accessStatus.replace(/_/g, " ")}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "capitalize" }}>
                              {grant.deliveryChannel?.replace(/_/g, " ") ?? "—"}
                            </span>
                          </div>
                        );
                      })}
                      {accessGrants.length > 20 && (
                        <div style={{ padding: "8px 16px", fontSize: 11, color: "var(--text-tertiary)", textAlign: "center" }}>
                          + {accessGrants.length - 20} unidades más
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ paddingTop: 12, borderTop: "0.5px solid var(--border)" }}>
                  <Button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void saveAcceso()}
                    style={{ backgroundColor: "var(--primary)", color: "#FFFFFF", borderRadius: 7, fontSize: 13 }}
                  >
                    {isSaving ? "Guardando..." : "Guardar configuración de acceso"}
                  </Button>
                </div>
              </div>
            )}

            {/* ── Tab: Revisión ─────────────────────────────────────────── */}
            {activeTab === "revision" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 2 }}>
                    Revisión y estado final
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                    Verifica que todo esté listo antes de abrir la asamblea.
                  </p>
                </div>

                {/* Summary grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <InfoRow label="Tipo de asamblea" value={ASSEMBLY_TYPE_OPTIONS.find((o) => o.value === assembly?.type)?.label ?? "Sin configurar"} />
                  <InfoRow label="Fecha programada" value={formatDate(assembly?.scheduledAt)} />
                  <InfoRow label="Modalidad" value={assembly?.modality ?? "—"} />
                  <InfoRow
                    label="Plataforma"
                    value={conferenceLabels[assembly?.conferenceService ?? "ninguno"] ?? assembly?.conferenceService ?? "—"}
                  />
                  {(assembly?.modality === "virtual" || assembly?.modality === "mixta") && (
                    <InfoRow
                      label="Videoconferencia"
                      value={(() => {
                        const rs = assembly?.conferenceService as AssemblyConferenceService | undefined;
                        const ru = (assembly?.virtualAccessUrl ?? assemblyForm.virtualAccessUrl)?.trim();
                        if (rs === "kuoro_live" || rs === "ninguno") {
                          return "Sala integrada en Kuoro (sin enlace externo)";
                        }
                        if (ru) {
                          return (
                            <a
                              href={ru}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "var(--primary)", fontSize: 12, wordBreak: "break-all" }}
                            >
                              {ru.length > 72 ? `${ru.slice(0, 72)}…` : ru}
                            </a>
                          );
                        }
                        if (rs && conferenceServiceRequiresMeetingLink(rs)) {
                          return <span style={{ color: "var(--danger)", fontSize: 12 }}>Falta el enlace — complétalo en General y guarda</span>;
                        }
                        return <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>Sin enlace aún (opcional si el proveedor está por definir)</span>;
                      })()}
                    />
                  )}
                  <InfoRow label="Base de votación" value={assembly?.votingBasis ?? "—"} />
                  <InfoRow label="Puntos de agenda" value={`${savedAgenda.length} configurados`} />
                  <InfoRow
                    label="Quórum proyectado"
                    value={
                      <span style={{ color: Number(quorumPct) >= 50 ? "var(--success)" : "var(--danger)" }}>
                        {quorumPct}%
                      </span>
                    }
                  />
                  <InfoRow label="Unidades representadas" value={`${representedUnits} de ${totalUnits}`} />
                  <InfoRow
                    label="Poderes pendientes"
                    value={
                      <span style={{ color: pendingProxyUnits > 0 ? "var(--warning)" : "var(--success)" }}>
                        {pendingProxyUnits}
                      </span>
                    }
                  />
                  <InfoRow
                    label="Sin votante habilitado"
                    value={
                      <span style={{ color: noVoterUnits > 0 ? "var(--danger)" : "var(--success)" }}>
                        {noVoterUnits}
                      </span>
                    }
                  />
                  <InfoRow label="Convocatorias enviadas" value={`${sentCount}`} />
                  <InfoRow
                    label="Accesos listos"
                    value={`${accessGrants.filter((g) => g.accessStatus === "ready").length} de ${accessGrants.length}`}
                  />
                </div>

                {/* Blockers */}
                {(noVoterUnits > 0 || pendingProxyUnits > 0 || savedAgenda.length === 0 || !isVirtualConferenceConfigOk(assemblyForm)) && (
                  <div
                    style={{
                      padding: "12px 16px",
                      borderRadius: 8,
                      backgroundColor: "var(--warning-surface)",
                      border: "0.5px solid var(--warning)"
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--warning)", marginBottom: 8 }}>
                      Puntos pendientes antes de iniciar
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {!isVirtualConferenceConfigOk(assemblyForm) && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                          <ChevronRight size={12} style={{ color: "var(--warning)" }} />
                          Configura y guarda el enlace de videoconferencia (pestaña General) para la plataforma elegida
                        </div>
                      )}
                      {savedAgenda.length === 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                          <ChevronRight size={12} style={{ color: "var(--warning)" }} />
                          Configura al menos un punto de agenda
                        </div>
                      )}
                      {pendingProxyUnits > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                          <ChevronRight size={12} style={{ color: "var(--warning)" }} />
                          {pendingProxyUnits} poder(es) de representación pendiente(s)
                        </div>
                      )}
                      {noVoterUnits > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                          <ChevronRight size={12} style={{ color: "var(--warning)" }} />
                          {noVoterUnits} unidad(es) sin votante habilitado
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {Number(quorumPct) >= 50 && noVoterUnits === 0 && savedAgenda.length > 0 && isVirtualConferenceConfigOk(assemblyForm) && (
                  <div
                    style={{
                      padding: "12px 16px",
                      borderRadius: 8,
                      backgroundColor: "var(--success-surface)",
                      border: "0.5px solid var(--success)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8
                    }}
                  >
                    <CheckCircle size={16} style={{ color: "var(--success)", flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: "var(--success)", fontWeight: 500 }}>
                      Todo está listo para abrir la asamblea. Quórum proyectado: {quorumPct}%
                    </div>
                  </div>
                )}

                <div style={{ paddingTop: 12, borderTop: "0.5px solid var(--border)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {status === "draft" && (
                    <Button
                      type="button"
                      disabled={!canAdvanceToScheduled || isSaving}
                      onClick={() => void advanceStatus("scheduled")}
                      style={{ backgroundColor: "var(--primary)", color: "#FFFFFF", borderRadius: 7, fontSize: 13 }}
                    >
                      Programar asamblea
                    </Button>
                  )}
                  {status === "scheduled" && (
                    <Button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void advanceStatus("invitation_sent")}
                      style={{ backgroundColor: "var(--primary)", color: "#FFFFFF", borderRadius: 7, fontSize: 13 }}
                    >
                      Marcar como convocada
                    </Button>
                  )}
                  {status === "invitation_sent" && (
                    <Button
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        void advanceStatus("in_progress");
                        setActiveTab("sala");
                      }}
                      style={{ backgroundColor: "var(--success)", color: "#FFFFFF", borderRadius: 7, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Play size={13} />
                      Iniciar sala en vivo
                    </Button>
                  )}
                  {status === "in_progress" && (
                    <Button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void advanceStatus("closed")}
                      style={{ backgroundColor: "var(--danger)", color: "#FFFFFF", borderRadius: 7, fontSize: 13 }}
                    >
                      Cerrar asamblea
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* ── Tab: Sala en vivo ─────────────────────────────────────── */}
            {activeTab === "sala" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 2 }}>
                    {salaUsesExternalConference ? "Sala en vivo + videoconferencia externa" : "Sala en vivo — Kuoro Live"}
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.55 }}>
                    {salaUsesExternalConference ? (
                      <>
                        Abre el enlace de Zoom, Meet u otra herramienta en otra ventana para el audio y video grupal. En Kuoro mantienes
                        diapositivas, quórum y votación sincronizados con los propietarios.
                      </>
                    ) : (
                      <>
                        Conferencia embebida. Controla audio, video, cola de participantes y presentación sin salir de la plataforma.
                      </>
                    )}
                  </p>
                </div>

                {/* ── Kuoro Live: sala embebida con LiveKit (solo cuando está en curso) ─── */}
                {!salaUsesExternalConference && status === "in_progress" && property && assembly && (
                  <ConferenceAdmin
                    propertyId={property.id}
                    assemblyId={assembly.id}
                    assemblyTitle={assembly.title}
                    isAssemblyActive={true}
                    slidePayload={slidePayload}
                    onLocalCamera={setCameraStream}
                  />
                )}

                {salaUsesExternalConference && meetingUrlLive && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "0.5px solid var(--border)",
                      backgroundColor: "var(--muted)"
                    }}
                  >
                    <ExternalLink size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
                    <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 4 }}>
                        ENLACE PARA MODERADOR Y COPIA A PROPIETARIOS
                      </div>
                      <a
                        href={meetingUrlLive}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, color: "var(--primary)", wordBreak: "break-all" }}
                      >
                        {meetingUrlLive}
                      </a>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      style={{ fontSize: 12, borderRadius: 7 }}
                      onClick={() => {
                        void navigator.clipboard.writeText(meetingUrlLive).then(
                          () => toast.success("Enlace copiado al portapapeles"),
                          () => toast.error("No se pudo copiar")
                        );
                      }}
                    >
                      <Copy size={12} style={{ marginRight: 4 }} />
                      Copiar
                    </Button>
                    <a
                      href={meetingUrlLive}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        height: 28,
                        padding: "0 12px",
                        borderRadius: 7,
                        fontSize: 12,
                        fontWeight: 600,
                        backgroundColor: "var(--primary)",
                        color: "#fff",
                        textDecoration: "none"
                      }}
                    >
                      Abrir videoconferencia
                    </a>
                  </div>
                )}

                {salaUsesExternalConference && !meetingUrlLive && (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "0.5px solid var(--danger)",
                      backgroundColor: "var(--danger-surface)",
                      fontSize: 12,
                      color: "var(--danger)"
                    }}
                  >
                    Falta el enlace de videoconferencia. Configúralo en la pestaña <strong>General</strong> y guarda antes de iniciar la
                    sala.
                  </div>
                )}

                {!salaUsesExternalConference && status !== "in_progress" ? (
                  <div
                    style={{
                      padding: 40,
                      borderRadius: 12,
                      backgroundColor: "var(--muted)",
                      textAlign: "center",
                      border: "0.5px dashed var(--border)"
                    }}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 12,
                        backgroundColor: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 16px"
                      }}
                    >
                      <Video size={22} style={{ color: "var(--primary)" }} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)", marginBottom: 8 }}>
                      Sala no iniciada
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.6 }}>
                      Cuando inicies la asamblea desde la pestaña Revisión, la sala se abrirá automáticamente aquí.
                      Los propietarios podrán unirse desde su enlace de acceso sin necesidad de plataformas externas.
                    </p>
                    {status === "invitation_sent" && (
                      <Button
                        type="button"
                        disabled={isSaving}
                        onClick={() => {
                          void advanceStatus("in_progress");
                        }}
                        style={{ backgroundColor: "var(--success)", color: "#FFFFFF", borderRadius: 7, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
                      >
                        <Play size={13} />
                        Iniciar sala ahora
                      </Button>
                    )}
                  </div>
                ) : (() => {
                  const liveItems = savedAgenda.length ? savedAgenda : agenda;
                  const liveItem = liveItems[liveSlide] as (AgendaItemInput & { id?: string }) | undefined;
                  const liveItemDocs = savedDocuments.filter(
                    (d) => "id" in (liveItem ?? {}) && d.agendaItemId === (liveItem as AgendaItemSummary).id
                  );

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                      {/* ── Top bar ──────────────────────────────────────────── */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 14px", borderRadius: 8, backgroundColor: "var(--success-surface)", border: "0.5px solid var(--success)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "var(--success)" }} />
                          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--success)" }}>En curso</span>
                          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{assembly?.title}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{quorumPct}% quórum · {representedUnits}/{totalUnits} unidades</span>
                          <Button type="button" disabled={isSaving} onClick={() => void advanceStatus("closed")} style={{ backgroundColor: "var(--danger)", color: "#FFFFFF", borderRadius: 7, fontSize: 11, padding: "4px 12px" }}>
                            Cerrar asamblea
                          </Button>
                        </div>
                      </div>

                      {/* ── 16:9 canvas (full width) with PiP camera ─────────── */}
                      <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", borderRadius: 12, overflow: "hidden", backgroundColor: "#0B0820" }}>

                        {/* Background gradient */}
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(150deg, #6258C4 0%, #3D2E8F 60%, #1A0F3C 100%)" }} />

                        {/* Screen share (fills canvas when active) */}
                        <video
                          ref={screenVideoRef}
                          autoPlay
                          muted
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", zIndex: 10, display: screenStream ? "block" : "none" }}
                        />

                        {/* Slide content */}
                        {!screenStream && canvasMode === "slide" && (
                          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "5% 8%", gap: "3%" }}>
                            <div style={{ fontSize: "clamp(9px, 1.2vw, 11px)", fontWeight: 600, letterSpacing: "0.08em", opacity: 0.5, color: "#FFFFFF", textTransform: "uppercase" }}>
                              {liveSlide + 1} / {liveItems.length} · {liveItem?.title?.slice(0, 30)}
                            </div>
                            <div style={{ fontSize: "clamp(18px, 2.8vw, 32px)", fontWeight: 500, lineHeight: 1.2, letterSpacing: "-0.025em", color: "#FFFFFF" }}>
                              {(liveItem as AgendaItemInput | undefined)?.slideTitle || liveItem?.title || "Sin título"}
                            </div>
                            {(liveItem as AgendaItemInput | undefined)?.slideContent && (
                              <p style={{ fontSize: "clamp(11px, 1.4vw, 15px)", opacity: 0.8, lineHeight: 1.7, margin: 0, color: "#FFFFFF", whiteSpace: "pre-line", maxHeight: "30%", overflow: "hidden" }}>
                                {(liveItem as AgendaItemInput).slideContent}
                              </p>
                            )}
                            {(liveItem as AgendaItemInput | undefined)?.votePrompt && (
                              <div style={{ padding: "2% 3%", borderRadius: 8, backgroundColor: "rgba(255,255,255,0.12)", border: "0.5px solid rgba(255,255,255,0.2)", fontSize: "clamp(11px, 1.3vw, 14px)", fontWeight: 500, color: "#FFFFFF", display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start" }}>
                                <Vote size={12} /> {(liveItem as AgendaItemInput).votePrompt}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Votación digital en tiempo real — panel lateral */}
                        {canvasMode === "vote_live" && property && assembly && (
                          <div style={{ position: "absolute", inset: 0, overflowY: "auto", backgroundColor: "rgba(10,6,30,0.95)", zIndex: 30, padding: 16 }}>
                            <VotingAdminPanel
                              propertyId={property.id}
                              assemblyId={assembly.id}
                              votingBasis={assembly.votingBasis as import("@kuoro/contracts").VotingBasis}
                              onLiveSessionOpened={(s) => { setDigitalLiveSession(s); }}
                              onLiveSessionClosed={(s) => {
                                setDigitalLiveSession(null);
                                const c = s.counts;
                                const now = new Date().toISOString();
                                const summary: AssemblyVoteResultSummary = {
                                  id: s.id,
                                  assemblyId: s.assemblyId,
                                  question: s.question,
                                  votingRule: s.votingRule as AssemblyVoteResultSummary["votingRule"],
                                  yesVotes: c.yesCount,
                                  noVotes: c.noCount,
                                  abstainVotes: c.abstainCount,
                                  blankVotes: c.blankCount,
                                  totalCoefficient: c.totalWeight > 0 ? c.totalWeight : 100,
                                  approved: s.approved ?? false,
                                  closedAt: s.closedAt ?? now,
                                  createdAt: now,
                                };
                                setCanvasVoteResult(summary);
                                setCanvasMode("vote_results");
                                toast.success(s.approved ? "Votación cerrada — aprobada" : "Votación cerrada — no aprobada");
                              }}
                              onLiveSessionCancelled={() => { setDigitalLiveSession(null); }}
                            />
                          </div>
                        )}

                        {/* Vote results overlay on canvas */}
                        {canvasMode === "vote_results" && canvasVoteResult && (() => {
                          const chartData = [
                            { name: "A favor", value: canvasVoteResult.yesVotes, fill: "#3D9A6A" },
                            { name: "En contra", value: canvasVoteResult.noVotes, fill: "#DC2626" },
                            { name: "Abstención", value: canvasVoteResult.abstainVotes, fill: "#D97706" },
                            { name: "En blanco", value: canvasVoteResult.blankVotes, fill: "#A8A49E" }
                          ].filter((d) => d.value > 0);
                          return (
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "4% 8%", gap: "4%" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "4%", flex: 1, maxWidth: "45%" }}>
                                <div style={{ fontSize: "clamp(9px, 1.1vw, 11px)", fontWeight: 700, letterSpacing: "0.1em", color: "#A594F9", textTransform: "uppercase" }}>Resultado de la votación</div>
                                <div style={{ fontSize: "clamp(14px, 2vw, 20px)", fontWeight: 500, color: "#FFFFFF", lineHeight: 1.3 }}>{canvasVoteResult.question}</div>
                                <div style={{ padding: "3% 4%", borderRadius: 10, backgroundColor: canvasVoteResult.approved ? "rgba(61,154,106,0.25)" : "rgba(220,38,38,0.25)", border: `1px solid ${canvasVoteResult.approved ? "#3D9A6A" : "#DC2626"}`, display: "inline-block", alignSelf: "flex-start" }}>
                                  <div style={{ fontSize: "clamp(18px, 2.8vw, 32px)", fontWeight: 700, color: canvasVoteResult.approved ? "#3D9A6A" : "#DC2626" }}>
                                    {canvasVoteResult.approved ? "APROBADO" : "NO APROBADO"}
                                  </div>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4% 6%", marginTop: "2%" }}>
                                  {[
                                    ["A favor", canvasVoteResult.yesVotes, "#3D9A6A"],
                                    ["En contra", canvasVoteResult.noVotes, "#DC2626"],
                                    ["Abstención", canvasVoteResult.abstainVotes, "#D97706"],
                                    ["En blanco", canvasVoteResult.blankVotes, "#A8A49E"]
                                  ].map(([label, value, color]) => (
                                    <div key={String(label)}>
                                      <div style={{ fontSize: "clamp(9px, 1vw, 11px)", color: "rgba(255,255,255,0.5)" }}>{label}</div>
                                      <div style={{ fontSize: "clamp(16px, 2.4vw, 28px)", fontWeight: 600, color: String(color) }}>{value}%</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div style={{ width: "clamp(140px, 25%, 240px)", aspectRatio: "1" }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie data={chartData} dataKey="value" cx="50%" cy="50%" innerRadius="35%" outerRadius="65%" paddingAngle={2}>
                                      {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                                    </Pie>
                                    <Legend iconSize={8} wrapperStyle={{ fontSize: "clamp(9px, 1vw, 11px)", color: "#FFFFFF" }} />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Badges */}
                        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6, zIndex: 20 }}>
                          {screenStream && (
                            <div style={{ padding: "3px 10px", borderRadius: 20, backgroundColor: "rgba(0,0,0,0.6)", fontSize: 10, color: "#FFFFFF", fontWeight: 600 }}>
                              PANTALLA COMPARTIDA
                            </div>
                          )}
                          {canvasMode === "vote_results" && (
                            <div style={{ padding: "3px 10px", borderRadius: 20, backgroundColor: "rgba(0,0,0,0.6)", fontSize: 10, color: "#A594F9", fontWeight: 600 }}>
                              RESULTADOS EN PANTALLA
                            </div>
                          )}
                        </div>

                        {/* PiP camera — bottom-right corner */}
                        <div style={{ position: "absolute", bottom: 14, right: 14, width: "18%", aspectRatio: "4/3", borderRadius: 8, overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.18)", backgroundColor: "#111", zIndex: 20 }}>
                          {cameraStream ? (
                            <video
                              ref={cameraVideoRef}
                              autoPlay
                              muted
                              playsInline
                              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4 }}>
                              <Video size={14} style={{ color: "rgba(255,255,255,0.2)" }} />
                              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textAlign: "center", padding: "0 4px" }}>Cámara pronto</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── Controls row (below canvas) ──────────────────────── */}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        {/* Navigation */}
                        <Button variant="secondary" type="button" disabled={liveSlide === 0} onClick={() => { setLiveSlide((s) => Math.max(0, s - 1)); setCanvasMode("slide"); }} style={{ borderRadius: 7, fontSize: 12, gap: 6 }}>
                          <ChevronLeft size={14} /> Anterior
                        </Button>
                        <div style={{ display: "flex", gap: 4 }}>
                          {liveItems.map((_, idx) => (
                            <button key={idx} type="button" onClick={() => { setLiveSlide(idx); setCanvasMode("slide"); }} style={{ width: 26, height: 26, borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, backgroundColor: liveSlide === idx && canvasMode === "slide" ? "var(--primary)" : "var(--muted)", color: liveSlide === idx && canvasMode === "slide" ? "#FFFFFF" : "var(--text-secondary)", transition: "all 100ms ease" }}>
                              {idx + 1}
                            </button>
                          ))}
                        </div>
                        <Button type="button" disabled={liveSlide >= liveItems.length - 1} onClick={() => { setLiveSlide((s) => Math.min(liveItems.length - 1, s + 1)); setCanvasMode("slide"); }} style={{ backgroundColor: "var(--primary)", color: "#FFFFFF", borderRadius: 7, fontSize: 12, gap: 6 }}>
                          Siguiente <ChevronRight size={14} />
                        </Button>

                        <div style={{ flex: 1 }} />

                        {/* Screen share */}
                        <Button type="button" variant="secondary" onClick={screenStream ? stopScreenShare : () => void startScreenShare()} style={{ borderRadius: 7, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: screenStream ? "var(--danger-surface)" : undefined, color: screenStream ? "var(--danger)" : undefined }}>
                          {screenStream ? <MonitorOff size={13} /> : <Monitor size={13} />}
                          {screenStream ? "Detener pantalla" : "Compartir pantalla"}
                        </Button>

                        {/* Dismiss results from canvas */}
                        {canvasMode === "vote_results" && (
                          <Button type="button" variant="secondary" onClick={() => setCanvasMode("slide")} style={{ borderRadius: 7, fontSize: 12 }}>
                            Volver a diapositiva
                          </Button>
                        )}

                        {/* Única mesa de votación (API en tiempo real; los asistentes votan desde su enlace) */}
                        <Button
                          type="button"
                          variant={canvasMode === "vote_live" ? "default" : "secondary"}
                          onClick={() => setCanvasMode(canvasMode === "vote_live" ? "slide" : "vote_live")}
                          style={{
                            borderRadius: 7, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6,
                            backgroundColor: canvasMode === "vote_live" ? "#1A0F3C" : undefined,
                            color: canvasMode === "vote_live" ? "#A594F9" : undefined,
                            border: canvasMode === "vote_live" ? "0.5px solid #6258C4" : undefined,
                          }}
                        >
                          <Vote size={13} /> {canvasMode === "vote_live" ? "Ocultar mesa de votación" : "Mesa de votación"}
                        </Button>
                      </div>

                      {/* ── Speaker notes + resources ────────────────────────── */}
                      <div style={{ display: "grid", gridTemplateColumns: liveItemDocs.length > 0 ? "1fr 1fr" : "1fr", gap: 10 }}>
                        {(liveItem as AgendaItemInput | undefined)?.speakerNotes && (
                          <div style={{ padding: "10px 14px", borderRadius: 8, backgroundColor: "var(--accent)", border: "0.5px solid var(--border)" }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--primary)", letterSpacing: "0.04em", marginBottom: 4 }}>NOTAS DEL MODERADOR</div>
                            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
                              {(liveItem as AgendaItemInput).speakerNotes}
                            </p>
                          </div>
                        )}

                        {liveItemDocs.length > 0 && (
                          <div style={{ padding: "10px 14px", borderRadius: 8, backgroundColor: "var(--muted)", border: "0.5px solid var(--border)" }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.04em", marginBottom: 8 }}>RECURSOS DE ESTE PUNTO</div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {liveItemDocs.map((doc) => {
                                const isImage = doc.documentMimeType?.startsWith("image/");
                                const isPdf = doc.documentMimeType === "application/pdf";
                                return (
                                  <button key={doc.id} type="button" onClick={() => {
                                    if (isImage || isPdf) setActiveResource({ title: doc.title, mimeType: doc.documentMimeType ?? "", data: doc.documentData });
                                    else { const a = document.createElement("a"); a.href = doc.documentData; a.download = doc.documentName; a.click(); }
                                  }} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", backgroundColor: "var(--background)", fontSize: 11, color: "var(--foreground)", cursor: "pointer" }}>
                                    <FileText size={11} />
                                    {doc.title.slice(0, 24)}{isImage ? " · imagen" : isPdf ? " · PDF" : " · descargar"}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ── Past votes summary bar ───────────────────────────── */}
                      {savedVoteResults.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {savedVoteResults.map((r, idx) => (
                            <button key={r.id} type="button" onClick={() => { setCanvasVoteResult(r); setCanvasMode("vote_results"); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, border: `0.5px solid ${r.approved ? "var(--success)" : "var(--danger)"}`, backgroundColor: r.approved ? "var(--success-surface)" : "var(--danger-surface)", fontSize: 11, color: r.approved ? "var(--success)" : "var(--danger)", cursor: "pointer" }}>
                              <Vote size={10} />
                              Votación {idx + 1} · {r.approved ? "Aprobado" : "No aprobado"}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* ── Inline document/image viewer ────────────────────── */}
                      {activeResource && (
                        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
                          <div style={{ width: "100%", maxWidth: 900, maxHeight: "90vh", display: "flex", flexDirection: "column", borderRadius: 10, overflow: "hidden", backgroundColor: "#111" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", backgroundColor: "rgba(255,255,255,0.05)" }}>
                              <span style={{ fontSize: 13, fontWeight: 500, color: "#FFFFFF" }}>{activeResource.title}</span>
                              <button type="button" onClick={() => setActiveResource(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)" }}><X size={16} /></button>
                            </div>
                            <div style={{ flex: 1, overflow: "auto" }}>
                              {activeResource.mimeType.startsWith("image/") ? (
                                <img src={activeResource.data} alt={activeResource.title} style={{ maxWidth: "100%", display: "block", margin: "0 auto" }} />
                              ) : activeResource.mimeType === "application/pdf" ? (
                                <iframe src={activeResource.data} title={activeResource.title} style={{ width: "100%", height: "70vh", border: "none" }} />
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── Tab: Post-reunión ─────────────────────────────────────── */}
            {activeTab === "post" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 2 }}>Post-reunión</div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>Resultados de votaciones, acta y trazabilidad.</p>
                </div>

                {/* Vote results history */}
                {savedVoteResults.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, letterSpacing: "0.04em" }}>
                      VOTACIONES REGISTRADAS ({savedVoteResults.length})
                    </div>
                    {savedVoteResults.map((r, idx) => {
                      const chartData = [
                        { name: "A favor", value: r.yesVotes, fill: "#3D9A6A" },
                        { name: "En contra", value: r.noVotes, fill: "#DC2626" },
                        { name: "Abstención", value: r.abstainVotes, fill: "#D97706" },
                        { name: "En blanco", value: r.blankVotes, fill: "#A8A49E" }
                      ].filter((d) => d.value > 0);
                      return (
                        <div key={r.id} className="card-base" style={{ padding: 20 }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                            <div>
                              <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600, letterSpacing: "0.04em", marginBottom: 4 }}>
                                VOTACIÓN {idx + 1}
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{r.question}</div>
                              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3 }}>
                                Regla: {r.votingRule === "simple" ? "Mayoría simple" : r.votingRule === "dos_tercios" ? "Dos tercios" : r.votingRule === "unanimidad" ? "Unanimidad" : "Informativa"}
                                {" · "}{new Date(r.closedAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                              </div>
                            </div>
                            <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, backgroundColor: r.approved ? "var(--success-surface)" : "var(--danger-surface)", color: r.approved ? "var(--success)" : "var(--danger)", flexShrink: 0 }}>
                              {r.approved ? "Aprobado" : "No aprobado"}
                            </span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, alignItems: "center" }}>
                            <ResponsiveContainer width="100%" height={140}>
                              <PieChart>
                                <Pie data={chartData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2}>
                                  {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                                </Pie>
                                <Tooltip formatter={(v) => `${v}%`} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              {[
                                { label: "A favor", value: r.yesVotes, color: "#3D9A6A" },
                                { label: "En contra", value: r.noVotes, color: "#DC2626" },
                                { label: "Abstención", value: r.abstainVotes, color: "#D97706" },
                                { label: "En blanco", value: r.blankVotes, color: "#A8A49E" },
                                { label: "Participación", value: r.totalCoefficient, color: "var(--primary)" }
                              ].map(({ label, value, color }) => (
                                <div key={label} style={{ padding: "8px 10px", borderRadius: 7, backgroundColor: "var(--muted)" }}>
                                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 2 }}>{label}</div>
                                  <div style={{ fontSize: 16, fontWeight: 500, color }}>{value}%</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: 40, borderRadius: 12, backgroundColor: "var(--muted)", textAlign: "center", border: "0.5px dashed var(--border)" }}>
                    <FileText size={22} style={{ color: "var(--primary)", marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 6 }}>Sin votaciones registradas</div>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                      Las votaciones que registres durante la sala aparecerán aquí con sus gráficas y estadísticas.
                    </p>
                  </div>
                )}

                {/* Acta placeholder */}
                <div style={{ padding: 20, borderRadius: 10, backgroundColor: "var(--accent)", border: "0.5px solid var(--border)" }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--primary)", marginBottom: 4 }}>Acta de asamblea — próximamente</div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
                    Kuoro IA generará el borrador del acta con los resultados de votación y decisiones tomadas. Podrás revisarla, editarla y exportarla en PDF.
                  </p>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
        </>)} {/* end !isReadOnly */}

      </div>
    </PlatformShell>
  );
}
