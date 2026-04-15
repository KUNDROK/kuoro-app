import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { logger } from "./logger";

function stripTrailingSlash(u: string): string {
  return u.replace(/\/$/, "");
}

/**
 * URL pública del SPA (enlaces en correos, CTAs, etc.).
 * Prioridad: APP_BASE_URL → PUBLIC_APP_URL (legado) → INVITATION_APP_URL (legado).
 */
export function resolveAppBaseUrl(): string {
  const raw =
    process.env["APP_BASE_URL"]?.trim() ||
    process.env["PUBLIC_APP_URL"]?.trim() ||
    process.env["INVITATION_APP_URL"]?.trim() ||
    "";
  if (raw) {
    const base = stripTrailingSlash(raw);
    if (/localhost|127\.0\.0\.1/i.test(base)) {
      logger.warn(
        "appUrls",
        "APP_BASE_URL apunta a localhost: enlaces del correo no funcionarán desde otros dispositivos.",
        { base }
      );
    }
    return base;
  }

  logger.warn(
    "appUrls",
    "APP_BASE_URL no definido; usando http://localhost:5173 para enlaces (solo misma máquina que Vite)."
  );
  return "http://localhost:5173";
}

/**
 * URL pública del API (opcional). Sin barra final.
 * Ej.: https://api-staging.railway.app/api/v1
 * Útil para logs y futuros enlaces absolutos al API.
 */
export function resolveApiBaseUrl(): string | undefined {
  const v = process.env["API_BASE_URL"]?.trim();
  return v ? stripTrailingSlash(v) : undefined;
}

export function resolveDeploymentMode(): "development" | "staging" | "production" | "test" {
  const n = (process.env["NODE_ENV"] ?? "development").toLowerCase();
  if (n === "production") return "production";
  if (n === "staging") return "staging";
  if (n === "test") return "test";
  return "development";
}

export function logRuntimeEnvironment(): void {
  const mode = resolveDeploymentMode();
  const app = resolveAppBaseUrl();
  const api = resolveApiBaseUrl();
  const lk = Boolean(process.env["LIVEKIT_API_KEY"]?.trim() && process.env["LIVEKIT_API_SECRET"]?.trim());
  const rs = Boolean(process.env["RESEND_API_KEY"]?.trim());
  let pkgVersion = "0.1.0";
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(here, "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    if (pkg.version) pkgVersion = pkg.version;
  } catch {
    // dist u otra ruta
  }

  logger.info("env", "Arranque — entorno", {
    mode,
    APP_BASE_URL: app,
    API_BASE_URL: api ?? "(no definida; cliente puede usar mismo origen o VITE_API_BASE_URL)",
    LIVEKIT: lk ? "configurado" : "no configurado",
    RESEND: rs ? "configurado" : "no configurado",
    packageVersion: pkgVersion,
  });
}
