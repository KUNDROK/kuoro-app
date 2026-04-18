/**
 * Límites best-effort en memoria (una instancia del API).
 * En varias réplicas de Railway cada una tiene su propio contador; para un límite global haría falta Redis u otro store.
 */

const requestTimestampsByAdmin = new Map<string, number[]>();

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Suma de caracteres de todos los mensajes user en el historial enviado. */
export function totalUserChars(messages: { role: string; content?: string }[]): number {
  let n = 0;
  for (const m of messages) {
    if (m.role === "user" && typeof m.content === "string") {
      n += m.content.length;
    }
  }
  return n;
}

export function assertAdminAssistantInputWithinLimit(
  messages: { role: string; content?: string }[],
): void {
  const maxChars = parsePositiveInt(process.env["ADMIN_ASSISTANT_MAX_INPUT_CHARS"], 14_000);
  const total = totalUserChars(messages);
  if (total > maxChars) {
    throw Object.assign(
      new Error(
        `El texto enviado supera el límite permitido (${maxChars} caracteres en total en tus mensajes). ` +
          "Acorta la conversación o divide la pregunta.",
      ),
      { statusCode: 400 },
    );
  }
}

/**
 * Cuenta cada llamada POST al asistente como un uso. Ventana deslizante por adminId.
 */
export function assertAdminAssistantRateLimit(adminId: string): void {
  const maxRequests = parsePositiveInt(process.env["ADMIN_ASSISTANT_MAX_REQUESTS_PER_WINDOW"], 40);
  const windowMs = parsePositiveInt(process.env["ADMIN_ASSISTANT_RATE_WINDOW_MS"], 3_600_000);

  const now = Date.now();
  const prev = requestTimestampsByAdmin.get(adminId) ?? [];
  const recent = prev.filter((t) => now - t < windowMs);

  if (recent.length >= maxRequests) {
    const minutes = Math.round(windowMs / 60_000);
    throw Object.assign(
      new Error(
        `Límite de uso del asistente alcanzado (${maxRequests} solicitudes cada ${minutes} minutos). ` +
          "Vuelve a intentar más tarde. Si necesitas más cupo, contacta al soporte de Kuoro.",
      ),
      { statusCode: 429 },
    );
  }

  recent.push(now);
  requestTimestampsByAdmin.set(adminId, recent);

  if (requestTimestampsByAdmin.size > 50_000) {
    for (const [id, ts] of requestTimestampsByAdmin) {
      const kept = ts.filter((t) => now - t < windowMs);
      if (kept.length === 0) requestTimestampsByAdmin.delete(id);
      else requestTimestampsByAdmin.set(id, kept);
    }
  }
}
