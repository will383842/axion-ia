/**
 * PROBE 01 — Seed runtime du référentiel Qualiopi (Phase 1).
 * Exécution réelle contre Postgres dev (localhost:5433). Aucun mock.
 * Teste : état initial, seed, idempotence, non-destructivité, grille active.
 */
import { PrismaClient } from "../../../prisma/generated/client";
import {
  seedQualiopiReferenceData,
  getQualiopiReferenceDataStatus,
} from "@/server/qualiopi/seed/reference-data";

const prisma = new PrismaClient();

async function main() {
  console.log("=== ÉTAT INITIAL (avant tout seed de ce probe) ===");
  const before = await getQualiopiReferenceDataStatus(prisma);
  console.log(JSON.stringify(before, null, 2));

  console.log("\n=== SEED #1 (ran attendu=true) ===");
  const r1 = await seedQualiopiReferenceData(prisma);
  console.log(JSON.stringify(r1, null, 2));

  console.log("\n=== SEED #2 idempotence (counts doivent rester identiques) ===");
  const r2 = await seedQualiopiReferenceData(prisma);
  console.log(JSON.stringify(r2, null, 2));
  console.log(
    "IDEMPOTENT_OFFRES:",
    r1.offresCount === r2.offresCount,
    "IDEMPOTENT_CONFIG:",
    r1.configKeysSet === r2.configKeysSet,
  );

  console.log("\n=== NON-DESTRUCTIF : écrit une valeur légale (NDA) puis re-seed ===");
  const ndaKey = "qualiopi.nda_numero";
  // Pose une valeur factice 'PROBE-NDA-12345'
  const existing = await prisma.siteSetting.findUnique({ where: { key: ndaKey } });
  if (existing) {
    await prisma.siteSetting.update({ where: { key: ndaKey }, data: { value: "PROBE-NDA-12345" } });
  } else {
    await prisma.siteSetting.create({
      data: { key: ndaKey, value: "PROBE-NDA-12345", category: "qualiopi", description: "probe" },
    });
  }
  await seedQualiopiReferenceData(prisma);
  const after = await prisma.siteSetting.findUnique({ where: { key: ndaKey } });
  console.log("NDA après re-seed =", JSON.stringify(after?.value));
  console.log("NON_DESTRUCTIF_OK:", JSON.stringify(after?.value) === JSON.stringify("PROBE-NDA-12345"));

  console.log("\n=== GRILLE ACTIVE (coexistence v1 SQL + v1/v2 seed) ===");
  const grilles = await prisma.grilleQualiteConfig.findMany({
    select: { cleUnique: true, actif: true, promptVersion: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(JSON.stringify(grilles, null, 2));
  const actives = grilles.filter((g) => g.actif);
  console.log("NB_GRILLES_ACTIVES:", actives.length, "→", actives.map((g) => g.cleUnique).join(", "));

  console.log("\n=== OFFRES (échantillon) ===");
  const offres = await prisma.offreSite.findMany({ select: { code: true, titreFr: true }, take: 50 });
  console.log("NB_OFFRES:", offres.length);
  console.log(offres.map((o) => o.code).join(", "));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("PROBE_ERROR:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
