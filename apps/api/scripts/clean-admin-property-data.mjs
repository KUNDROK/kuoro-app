/**
 * Borra propiedades (con asambleas/votos), unidades, copropietarios (Owner)
 * y todos los administradores (AdminUser + sesiones). Deja la BD lista
 * para registrar un admin nuevo desde cero.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL no está definida (.env en la raíz del monorepo).");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

try {
  const counts = await prisma.$transaction(async (tx) => {
    const v = await tx.vote.deleteMany();
    const ar = await tx.assemblyRepresentation.deleteMany();
    const vs = await tx.votingSession.deleteMany();
    const avr = await tx.assemblyVoteResult.deleteMany();
    const sq = await tx.speakerQueueEntry.deleteMany();
    const lk = await tx.liveKitPendingAction.deleteMany();
    const ad = await tx.assemblyDocument.deleteMany();
    const ai = await tx.assemblyInvitation.deleteMany();
    const ag = await tx.assemblyAccessGrant.deleteMany();
    const ac = await tx.assemblyAccessConfig.deleteMany();
    const agi = await tx.agendaItem.deleteMany();
    const cal = await tx.conferenceAuditLog.deleteMany();
    const asm = await tx.assembly.deleteMany();
    const uo = await tx.unitOwner.deleteMany();
    const u = await tx.unit.deleteMany();
    const o = await tx.owner.deleteMany();
    const p = await tx.property.deleteMany();
    const sess = await tx.adminSession.deleteMany();
    const adm = await tx.adminUser.deleteMany();
    return { v, ar, vs, avr, sq, lk, ad, ai, ag, ac, agi, cal, asm, uo, u, o, p, sess, adm };
  });

  console.log("Limpieza completada (filas borradas por tabla):");
  for (const [k, r] of Object.entries(counts)) {
    console.log(`  ${k}: ${r.count}`);
  }
} finally {
  await prisma.$disconnect();
  await pool.end();
}
