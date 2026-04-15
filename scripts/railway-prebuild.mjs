/**
 * Antes de `npm ci` en Railway: evita EBUSY en apps/web/node_modules/.vite
 * y deja un árbol limpio del front (solo se reinstala en el mismo `npm ci`).
 */
import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const webModules = join(root, "apps", "web", "node_modules");

try {
  if (existsSync(webModules)) {
    rmSync(webModules, { recursive: true, force: true });
  }
} catch {
  // ignorar — npm ci intentará reconciliar
}
