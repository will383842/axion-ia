/**
 * PROBE 03 — Premier boot sur DB VIERGE (clean-room, Phase 1 / S7).
 * Prouve que le seed auto peuple offres_site + config + grilles depuis ZÉRO.
 * DB cible : axion_ia_audit (migrée + grille SQL appliquée, AUCUN qualiopi:seed manuel).
 */
import { PrismaClient } from "../../../prisma/generated/client";
import {
  seedQualiopiReferenceData,
  getQualiopiReferenceDataStatus,
} from "@/server/qualiopi/seed/reference-data";

const url = "postgresql://axion_ia:axion_ia_dev@localhost:5433/axion_ia_audit?schema=public";
const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  console.log("=== AVANT seed (DB fraîchement migrée, grille SQL seule) ===");
  const before = await getQualiopiReferenceDataStatus(prisma);
  console.log(JSON.stringify(before, null, 2));

  console.log("\n=== SEED auto (1er boot simulé) ===");
  const r = await seedQualiopiReferenceData(prisma);
  console.log(JSON.stringify(r, null, 2));

  console.log("\n=== APRÈS seed ===");
  const after = await getQualiopiReferenceDataStatus(prisma);
  console.log(JSON.stringify(after, null, 2));

  const ok =
    r.ran &&
    after.offresCount > 0 &&
    after.configKeysSet >= after.configKeysTotal &&
    after.grilleActiveCle != null;
  console.log("\nPREMIER_BOOT_PEUPLE_OK:", ok);
  console.log(
    `offres: ${before.offresCount}→${after.offresCount} | config: ${before.configKeysSet}→${after.configKeysSet}/${after.configKeysTotal} | grille active: ${after.grilleActiveCle}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("PROBE_ERROR:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
