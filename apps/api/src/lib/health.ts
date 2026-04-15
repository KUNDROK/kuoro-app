import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function getHealthPayload(): Record<string, unknown> {
  let version = process.env["npm_package_version"] ?? "0.1.0";
  const commit =
    process.env["RAILWAY_GIT_COMMIT_SHA"]?.trim().slice(0, 12) ||
    process.env["VERCEL_GIT_COMMIT_SHA"]?.trim().slice(0, 12) ||
    process.env["GITHUB_SHA"]?.trim().slice(0, 12) ||
    null;

  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(here, "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    if (pkg.version) version = pkg.version;
  } catch {
    // ignorar si no se encuentra package.json (p. ej. empaquetado distinto)
  }

  const dbUrl = process.env["DATABASE_URL"] ?? "";
  const database =
    dbUrl.startsWith("postgres") || dbUrl.startsWith("postgresql") ? "postgresql" : dbUrl ? "configured" : "unknown";

  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "@kuoro/api",
    version,
    commit,
    database
  };
}
