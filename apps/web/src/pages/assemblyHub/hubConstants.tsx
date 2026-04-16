import type { ReactNode } from "react";
import { CheckCircle, FileText, Mail, Settings, Shield, Video } from "lucide-react";
import type { AssemblyConfigInput, AssemblySummary } from "@kuoro/contracts";
import type { HubTab } from "./types";

export const TABS: Array<{ id: HubTab; label: string; icon: ReactNode }> = [
  { id: "config", label: "Configuración", icon: <Settings size={13} /> },
  { id: "agenda", label: "Agenda", icon: <FileText size={13} /> },
  { id: "convocatoria", label: "Convocatoria", icon: <Mail size={13} /> },
  { id: "acceso", label: "Acceso e identidad", icon: <Shield size={13} /> },
  { id: "revision", label: "Revisión", icon: <CheckCircle size={13} /> },
  { id: "sala", label: "Sala en vivo", icon: <Video size={13} /> },
  { id: "post", label: "Post-reunión", icon: <FileText size={13} /> }
];

export const LIFECYCLE_STAGES: Array<{
  status: AssemblySummary["status"];
  label: string;
  short: string;
}> = [
  { status: "draft", label: "Borrador", short: "Borrador" },
  { status: "scheduled", label: "Programada", short: "Programada" },
  { status: "invitation_sent", label: "Convocada", short: "Convocada" },
  { status: "in_progress", label: "En curso", short: "En curso" },
  { status: "closed", label: "Cerrada", short: "Cerrada" }
];

export const ASSEMBLY_TYPE_OPTIONS: Array<{ value: AssemblyConfigInput["type"]; label: string; description: string }> = [
  { value: "ordinaria", label: "Ordinaria", description: "Reunión anual habitual de la copropiedad." },
  { value: "extraordinaria", label: "Extraordinaria", description: "Se convoca por urgencia o necesidad imprevista." },
  { value: "segunda_convocatoria", label: "Segunda convocatoria", description: "Nueva asamblea cuando la primera no logró quórum." },
  { value: "derecho_propio", label: "Por derecho propio", description: "Opera cuando no se convocó la ordinaria dentro del plazo legal." },
  { value: "no_presencial", label: "No presencial", description: "La deliberación y decisión ocurren por medios remotos." },
  { value: "comunicacion_escrita", label: "Comunicación escrita", description: "La decisión se recoge por escrito, no en una reunión en vivo." }
];

export const MODALITY_OPTIONS: Array<{ value: AssemblyConfigInput["modality"]; label: string }> = [
  { value: "presencial", label: "Presencial" },
  { value: "virtual", label: "Virtual" },
  { value: "mixta", label: "Mixta" }
];
