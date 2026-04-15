/**
 * Singleton de PrismaClient exportado para reutilización.
 * Importar desde aquí en todos los módulos de dominio.
 */
import "../bootstrap-env";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env["DATABASE_URL"],
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
