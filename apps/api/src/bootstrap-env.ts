/**
 * Debe importarse antes que cualquier módulo que lea process.env (Prisma, LiveKit).
 * En ESM los `import` se resuelven antes que el cuerpo de server.ts; por eso
 * no basta con llamar a dotenv dentro de server.ts después de los imports.
 */
import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../../.env"), override: true });
loadEnv({ path: resolve(here, "../.env") });
