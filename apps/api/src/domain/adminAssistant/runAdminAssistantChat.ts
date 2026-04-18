import type {
  AdminAssistantChatRequest,
  AdminAssistantChatResponse,
  AdminAssistantClientMessage,
} from "@kuoro/contracts";
import { buildAdminAssistantSystemPrompt } from "./knowledge";
import { assertAdminAssistantInputWithinLimit, assertAdminAssistantRateLimit } from "./rateAndInputLimits";
import { ADMIN_ASSISTANT_OPENAI_TOOLS, executeAdminAssistantTool } from "./toolExecutor";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MAX_CLIENT_MESSAGES = 28;
const MAX_TOOL_ROUNDS = 12;

type OpenAIMessage = Record<string, unknown>;

function sanitizeClientMessages(messages: AdminAssistantClientMessage[]): OpenAIMessage[] {
  const trimmed = messages.slice(-MAX_CLIENT_MESSAGES);
  const out: OpenAIMessage[] = [];
  for (const m of trimmed) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const content = typeof m.content === "string" ? m.content : "";
    if (!content.trim()) continue;
    out.push({ role: m.role, content });
  }
  return out;
}

function contextSystemMessage(body: AdminAssistantChatRequest): OpenAIMessage {
  const lines = [
    "Contexto de pantalla del administrador (IDs que ya tiene la UI; úsalos en herramientas si aplica):",
    `- propertyId: ${body.propertyId?.trim() || "(no indicado)"}`,
    `- assemblyId: ${body.assemblyId?.trim() || "(no indicado)"}`,
  ];
  return { role: "system", content: lines.join("\n") };
}

async function callOpenAI(messages: OpenAIMessage[]): Promise<{
  message: OpenAIMessage;
  finishReason: string | undefined;
}> {
  const apiKey = process.env["OPENAI_API_KEY"]?.trim();
  if (!apiKey) {
    throw Object.assign(new Error("OPENAI_API_KEY no configurada"), { statusCode: 503 });
  }

  const model = process.env["OPENAI_ADMIN_ASSISTANT_MODEL"]?.trim() || "gpt-4o-mini";

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 2800,
      messages,
      tools: ADMIN_ASSISTANT_OPENAI_TOOLS,
      tool_choice: "auto",
    }),
  });

  const raw = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    throw Object.assign(new Error("Respuesta inválida del proveedor de IA"), { statusCode: 502 });
  }

  if (!response.ok) {
    const errMsg =
      typeof data.error === "object" && data.error !== null && "message" in data.error
        ? String((data.error as { message?: string }).message)
        : `OpenAI HTTP ${response.status}`;
    throw Object.assign(new Error(errMsg), { statusCode: 502 });
  }

  const choices = data.choices as unknown;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw Object.assign(new Error("Sin choices en respuesta OpenAI"), { statusCode: 502 });
  }

  const first = choices[0] as Record<string, unknown>;
  const message = first.message as OpenAIMessage | undefined;
  if (!message || typeof message !== "object") {
    throw Object.assign(new Error("Mensaje vacío del proveedor"), { statusCode: 502 });
  }

  return {
    message,
    finishReason: typeof first.finish_reason === "string" ? first.finish_reason : undefined,
  };
}

export async function runAdminAssistantChat(
  adminId: string,
  body: AdminAssistantChatRequest,
): Promise<AdminAssistantChatResponse> {
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    throw Object.assign(new Error("messages es requerido"), { statusCode: 400 });
  }

  assertAdminAssistantInputWithinLimit(body.messages as { role: string; content?: string }[]);
  assertAdminAssistantRateLimit(adminId);

  if (!process.env["OPENAI_API_KEY"]?.trim()) {
    return {
      message: {
        role: "assistant",
        content:
          "El asistente de IA no está configurado en el servidor: falta la variable de entorno **OPENAI_API_KEY**. " +
          "Cuando esté disponible, podré consultar propietarios, asambleas, invitaciones, eventos de sala y votaciones " +
          "usando herramientas seguras con tu sesión de administrador.",
      },
      degraded: true,
    };
  }

  const messages: OpenAIMessage[] = [
    { role: "system", content: buildAdminAssistantSystemPrompt() },
    contextSystemMessage(body),
    ...sanitizeClientMessages(body.messages),
  ];

  let rounds = 0;

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds += 1;
    const { message } = await callOpenAI(messages);
    const toolCalls = message.tool_calls as
      | Array<{
          id?: string;
          type?: string;
          function?: { name?: string; arguments?: string };
        }>
      | undefined;

    if (toolCalls && toolCalls.length > 0) {
      messages.push(message);
      for (const tc of toolCalls) {
        const id = typeof tc.id === "string" ? tc.id : "";
        const name = tc.function?.name ?? "";
        const args = typeof tc.function?.arguments === "string" ? tc.function.arguments : "{}";
        const result = await executeAdminAssistantTool(adminId, name, args);
        messages.push({
          role: "tool",
          tool_call_id: id,
          content: result,
        });
      }
      continue;
    }

    const text =
      typeof message.content === "string"
        ? message.content
        : Array.isArray(message.content)
          ? (message.content as { text?: string }[])
              .map((c) => (typeof c.text === "string" ? c.text : ""))
              .join("")
          : "";

    return {
      message: {
        role: "assistant",
        content: text.trim() || "No obtuve texto de respuesta del modelo.",
      },
    };
  }

  return {
    message: {
      role: "assistant",
      content: "Se alcanzó el límite de pasos con herramientas. Reformula una pregunta más específica.",
    },
  };
}
