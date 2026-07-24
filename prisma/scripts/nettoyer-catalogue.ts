#!/usr/bin/env tsx
/**
 * Qualiopi — Archivage des formations/offres qui ne sont plus au catalogue.
 *
 * Rattrape l'écart historique : les générations de catalogue remplacées le
 * 2026-07-15 (commit 630b8b75) n'ont jamais été archivées en base, faute d'une
 * liste de slugs mise à jour à la main. Ce script applique la règle générique
 * de `catalogue-cleanup.ts` — dérivée du SSOT `catalog-v2.ts` — donc il attrape
 * TOUTES les générations obsolètes, y compris celles que personne n'a listées.
 *
 * NON DESTRUCTIF : archive (`statut='archive'`) et désactive (`actif=false`).
 * Sessions, conventions, attestations et factures restent intactes — obligation
 * de conservation 5 ans.
 *
 * USAGE
 *   pnpm qualiopi:nettoyer-catalogue                       # simulation
 *   pnpm qualiopi:nettoyer-catalogue --apply               # exécute
 *   pnpm qualiopi:nettoyer-catalogue --keep-legacy-offres  # épargne AXI-OFF-0xx
 */

import { PrismaClient } from "../generated/client";
import { cleanupCatalogue } from "../../src/server/qualiopi/formations/catalogue-cleanup";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const keepLegacy = process.argv.includes("--keep-legacy-offres");

  console.log(
    apply
      ? "\n🧹 [qualiopi:nettoyer-catalogue] APPLICATION\n"
      : "\n🔍 [qualiopi:nettoyer-catalogue] SIMULATION — aucune écriture (ajouter --apply)\n",
  );

  const res = await cleanupCatalogue(prisma, { apply, includeLegacyOffres: !keepLegacy });

  section(
    "Formations à ARCHIVER (hors catalogue)",
    res.formationsToArchive,
    (f) => `${f.numero}  ${f.slug}  « ${f.titre} »  [${f.statut}]`,
  );
  section(
    "Offres à DÉSACTIVER (hors catalogue, sans formation vivante)",
    res.offresToDeactivate,
    (o) => `${o.code}  ${o.slug}  « ${o.titreFr} »`,
  );
  section(
    "Formations sur-mesure CONSERVÉES (hors catalogue par nature)",
    res.formationsSurMesureKept,
    (f) => `${f.numero}  ${f.slug}  « ${f.titre} »`,
  );
  section(
    "Offres CONSERVÉES (une formation vivante y est encore rattachée)",
    res.offresKeptWithLiveFormation,
    (o) => `${o.code}  ${o.slug}  « ${o.titreFr} »`,
  );
  section(
    "⚠️  Formations ARCHIVÉES dont le slug est REVENU au catalogue (revue manuelle)",
    res.formationsArchiveesRevenuesAuCatalogue,
    (f) => `${f.numero}  ${f.slug}  « ${f.titre} »`,
  );

  if (apply) {
    console.log(
      `\n✅ Appliqué : ${res.formationsArchivedCount} formation(s) archivée(s), ` +
        `${res.offresDeactivatedCount} offre(s) désactivée(s).\n`,
    );
  } else {
    const total = res.formationsToArchive.length + res.offresToDeactivate.length;
    console.log(
      total === 0
        ? "\n✅ Rien à nettoyer — le référentiel est aligné sur le catalogue.\n"
        : `\n📋 ${total} ligne(s) à nettoyer. Pour exécuter :  pnpm qualiopi:nettoyer-catalogue --apply\n`,
    );
  }
}

function section<T>(titre: string, lignes: ReadonlyArray<T>, format: (item: T) => string): void {
  if (lignes.length === 0) return;
  console.log(`\n── ${titre} — ${lignes.length}`);
  for (const l of lignes) console.log(`   • ${format(l)}`);
}

main()
  .catch((err) => {
    console.error("[qualiopi:nettoyer-catalogue] ÉCHEC :", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
