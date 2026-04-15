import "dotenv/config";
import "./bootstrap-env";

import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { config } from "./config";
import { routeRequest } from "./routes";
import { startExpiryJob } from "./domain/expiryJob";
import { startReconciliationJob } from "./domain/reconciliation";
import { logger } from "./lib/logger";
import { applyCors } from "./lib/cors";
import { logRuntimeEnvironment, resolveApiBaseUrl, resolveAppBaseUrl, resolveDeploymentMode } from "./lib/appUrls";

// ─── Validación de configuración en arranque ──────────────────────────────────

function validateConfig() {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!process.env["DATABASE_URL"]) missing.push("DATABASE_URL");

  const livekitKey = process.env["LIVEKIT_API_KEY"];
  const livekitSecret = process.env["LIVEKIT_API_SECRET"];
  const livekitUrl = process.env["LIVEKIT_URL"];

  if (!livekitKey) warnings.push("LIVEKIT_API_KEY no está configurada — tokens de conferencia fallarán");
  if (!livekitSecret) warnings.push("LIVEKIT_API_SECRET no está configurada — tokens de conferencia fallarán");

  if (!livekitUrl) {
    warnings.push("LIVEKIT_URL no está configurada — usando https://demo.livekit.cloud (solo para dev sin keys reales)");
  } else if (livekitUrl.startsWith("http://") && !livekitUrl.includes("localhost")) {
    warnings.push(`LIVEKIT_URL usa HTTP no seguro: ${livekitUrl} (usa wss:// en producción)`);
  }

  const mode = resolveDeploymentMode();
  if ((mode === "staging" || mode === "production") && !process.env["APP_BASE_URL"]?.trim()) {
    warnings.push("APP_BASE_URL no está definida — enlaces en correos usarán fallback localhost o legado");
  }

  if (missing.length > 0) {
    console.error("❌ Variables de entorno REQUERIDAS faltantes:");
    missing.forEach((v) => console.error(`   - ${v}`));
    console.error("   Consulta apps/api/.env.example para la configuración mínima.");
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn("⚠️  Advertencias de configuración:");
    warnings.forEach((w) => console.warn(`   - ${w}`));
  }

  const lkStatus = livekitKey && livekitSecret ? "✅ configurado" : "❌ NO configurado";
  console.log(`   LiveKit: ${lkStatus}`);
  if (livekitUrl) console.log(`   LiveKit URL: ${livekitUrl}`);
}

function isSafeProductionErrorResponse(): boolean {
  const m = resolveDeploymentMode();
  return m === "production" || m === "staging";
}

const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
  applyCors(request, response);

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  try {
    await routeRequest(request, response);
  } catch (error) {
    const statusCode =
      error instanceof Error && "statusCode" in error && typeof (error as { statusCode?: number }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 500;

    logger.error("server", "Error no capturado en routeRequest", {
      statusCode,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    response.statusCode = statusCode;
    response.setHeader("Content-Type", "application/json; charset=utf-8");

    let clientMessage: string;
    if (statusCode === 500 && isSafeProductionErrorResponse()) {
      clientMessage = "Internal server error";
    } else if (error instanceof Error) {
      clientMessage = error.message;
    } else {
      clientMessage = "Unknown error";
    }

    response.end(JSON.stringify({ error: clientMessage }));
  }
});

validateConfig();
logRuntimeEnvironment();

server.listen(config.port, config.host, () => {
  console.log(`\n🚀 Kuoro API (@kuoro/api) en http://${config.host}:${config.port}`);
  console.log(`   NODE_ENV / modo: ${resolveDeploymentMode()}`);
  console.log(`   APP_BASE_URL: ${resolveAppBaseUrl()}`);
  console.log(`   API_BASE_URL: ${resolveApiBaseUrl() ?? "(no definida)"}`);
  console.log(`   DB: ${process.env["DATABASE_URL"] ? "DATABASE_URL definida" : "❌ no configurada"}`);
  console.log("");

  startExpiryJob();
  startReconciliationJob();

  logger.info("server", "API escuchando", {
    port: config.port,
    host: config.host,
    livekit: Boolean(process.env["LIVEKIT_API_KEY"]),
    resend: Boolean(process.env["RESEND_API_KEY"])
  });
});
