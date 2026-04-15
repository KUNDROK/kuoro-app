import type { IncomingMessage, ServerResponse } from "node:http";

import { logger } from "./logger";

type CorsMode = { kind: "wildcard" } | { kind: "origins"; list: string[] };

function normalizeOrigin(o: string): string {
  return o.trim().replace(/\/$/, "");
}

function resolveCorsMode(): CorsMode {
  const env = (process.env["NODE_ENV"] ?? "development").toLowerCase();
  const raw = process.env["ALLOWED_ORIGINS"]?.trim();
  if (raw) {
    const list = raw.split(",").map((s) => normalizeOrigin(s)).filter(Boolean);
    return { kind: "origins", list };
  }
  if (env === "development" || env === "test") {
    return { kind: "wildcard" };
  }
  const app = process.env["APP_BASE_URL"]?.trim();
  if (app) {
    const one = normalizeOrigin(app);
    logger.warn("cors", "ALLOWED_ORIGINS no definido; usando APP_BASE_URL como único origen permitido", {
      origin: one
    });
    return { kind: "origins", list: [one] };
  }
  logger.warn(
    "cors",
    "ALLOWED_ORIGINS y APP_BASE_URL vacíos en entorno no-dev; usando wildcard (configura ALLOWED_ORIGINS en staging/producción)."
  );
  return { kind: "wildcard" };
}

let cachedCors: CorsMode | null = null;

function getCorsMode(): CorsMode {
  if (!cachedCors) cachedCors = resolveCorsMode();
  return cachedCors;
}

export function applyCors(request: IncomingMessage, response: ServerResponse): void {
  const mode = getCorsMode();
  const origin = request.headers.origin;

  if (mode.kind === "wildcard") {
    response.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin) {
    const norm = normalizeOrigin(origin);
    if (mode.list.includes(norm)) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Access-Control-Allow-Credentials", "true");
      response.setHeader("Vary", "Origin");
    }
    // Origen no permitido: no enviar ACAO (el navegador bloquea la petición cruzada)
  } else {
    // Sin cabecera Origin (curl, healthchecks): permitir lectura simple
    response.setHeader("Access-Control-Allow-Origin", "*");
  }

  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}
