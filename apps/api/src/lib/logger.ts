/**
 * Logger estructurado ligero para @kuoro/api.
 *
 * Emite JSON a stdout para que herramientas de observabilidad (Datadog,
 * CloudWatch, etc.) puedan parsear los logs. En desarrollo, emite texto
 * legible si LOG_FORMAT=pretty (o no está definido).
 *
 * Niveles: debug | info | warn | error
 *
 * Uso:
 *   import { logger } from "../lib/logger";
 *   logger.info("conference", "Speaker aprobado", { entryId, assemblyId });
 *   logger.error("livekit", "Revoke fallido", { identity, err });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  ts:      string;
  level:   LogLevel;
  module:  string;
  msg:     string;
  [key: string]: unknown;
}

const IS_PRETTY = process.env["LOG_FORMAT"] !== "json";

function emit(level: LogLevel, module: string, msg: string, ctx: Record<string, unknown> = {}): void {
  const entry: LogEntry = {
    ts:     new Date().toISOString(),
    level,
    module,
    msg,
    ...ctx,
  };

  if (IS_PRETTY) {
    const levelTag = `[${level.toUpperCase().padEnd(5)}]`;
    const moduleTag = `[${module}]`;
    const ctxStr = Object.keys(ctx).length
      ? " " + JSON.stringify(ctx)
      : "";
    const line = `${entry.ts} ${levelTag} ${moduleTag} ${msg}${ctxStr}`;

    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  } else {
    // JSON compacto para ingestión por log aggregators
    const line = JSON.stringify(entry);
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
}

export const logger = {
  debug: (module: string, msg: string, ctx?: Record<string, unknown>) => emit("debug", module, msg, ctx),
  info:  (module: string, msg: string, ctx?: Record<string, unknown>) => emit("info",  module, msg, ctx),
  warn:  (module: string, msg: string, ctx?: Record<string, unknown>) => emit("warn",  module, msg, ctx),
  error: (module: string, msg: string, ctx?: Record<string, unknown>) => emit("error", module, msg, ctx),
};
