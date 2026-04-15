/**
 * Migra Assembly.conferenceService de "quorum_live" (nombre antiguo) a "kuoro_live".
 *
 * Ejecutar una vez tras el rebrand, desde la raíz del repo:
 *   node apps/api/scripts/migrate-quorum-live-to-kuoro-live.mjs
 *
 * Requiere DATABASE_URL (p. ej. en apps/api/.env).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "../.env");
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) {
      const key = m[1].trim();
      let val = m[2].trim().replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

const url = process.env.DATABASE_URL;
if (!url?.trim()) {
  console.error("DATABASE_URL no está definida. Configura apps/api/.env");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

try {
  const r = await pool.query(
    `UPDATE "Assembly" SET "conferenceService" = $1 WHERE "conferenceService" = $2`,
    ["kuoro_live", "quorum_live"]
  );
  console.log(`Filas actualizadas: ${r.rowCount ?? 0} (quorum_live → kuoro_live)`);
} finally {
  await pool.end();
}
