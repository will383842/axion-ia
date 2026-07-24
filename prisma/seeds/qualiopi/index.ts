#!/usr/bin/env tsx
/**
 * Qualiopi — Seed des paramètres métier (SiteSetting cat. `qualiopi`).
 *
 * Idempotent et NON destructif : crée chaque clé manquante avec sa valeur par
 * défaut ; ne RÉÉCRIT JAMAIS la valeur d'une clé existante (préserve les
 * identifiants légaux saisis par Will). Met seulement à jour description +
 * catégorie pour rester aligné au registre.
 *
 * Usage : `pnpm qualiopi:seed`.
 */

import { PrismaClient, Prisma } from "../../generated/client";
import {
  QUALIOPI_CONFIG_REGISTRY,
  QUALIOPI_CONFIG_KEY_PREFIX,
} from "../../../src/server/qualiopi/config/registry";
import { seedOffresSite, reconcileOffresFromSkeleton } from "./offres";
import { seedOffresV2, reconcileOffresV2 } from "./offres-v2";
import { seedCatalogFormations } from "./catalog-formations";
import { cleanupCatalogue } from "../../../src/server/qualiopi/formations/catalogue-cleanup";
import { seedGrilleQualite } from "./grille";
import { seedGrilleV2 } from "./grille-v2";

const prisma = new PrismaClient();

async function seedQualiopiConfig(): Promise<void> {
  const keys = Object.keys(QUALIOPI_CONFIG_REGISTRY) as (keyof typeof QUALIOPI_CONFIG_REGISTRY)[];
  let created = 0;
  let kept = 0;
  for (const key of keys) {
    const entry = QUALIOPI_CONFIG_REGISTRY[key];
    const fullKey = `${QUALIOPI_CONFIG_KEY_PREFIX}${key}`;
    const existing = await prisma.siteSetting.findUnique({ where: { key: fullKey } });
    if (existing) {
      // Préserver la valeur — synchroniser seulement description/catégorie.
      await prisma.siteSetting.update({
        where: { key: fullKey },
        data: { description: entry.description, category: "qualiopi" },
      });
      kept += 1;
    } else {
      await prisma.siteSetting.create({
        data: {
          key: fullKey,
          value: entry.default as Prisma.InputJsonValue,
          description: entry.description,
          category: "qualiopi",
        },
      });
      created += 1;
    }
  }
  console.log(
    `✅ [qualiopi:seed] config — ${created} clé(s) créée(s), ${kept} préservée(s) (total ${keys.length}).`,
  );
}

/**
 * Aligne le référentiel Formation/OffreSite sur le catalogue public courant.
 * Idempotent et non destructif (archivage/désactivation, jamais de suppression).
 */
async function runCatalogueCleanup(): Promise<void> {
  const res = await cleanupCatalogue(prisma, { apply: true });
  for (const f of res.formationsToArchive) {
    console.log(`↻ [qualiopi:seed] archivée — ${f.numero} « ${f.titre} » (${f.slug})`);
  }
  for (const o of res.offresToDeactivate) {
    console.log(`↻ [qualiopi:seed] offre désactivée — ${o.code} (${o.slug})`);
  }
  for (const f of res.formationsArchiveesRevenuesAuCatalogue) {
    console.warn(
      `⚠️  [qualiopi:seed] ${f.numero} (${f.slug}) est archivée mais son slug est revenu ` +
        `au catalogue — réactivation NON automatique, à arbitrer en console.`,
    );
  }
  console.log(
    `✅ [qualiopi:seed] catalogue — ${res.formationsArchivedCount} formation(s) archivée(s), ` +
      `${res.offresDeactivatedCount} offre(s) désactivée(s), ` +
      `${res.formationsSurMesureKept.length} sur-mesure conservée(s).`,
  );
}

async function main(): Promise<void> {
  await seedQualiopiConfig();
  await seedOffresSite(prisma);
  await reconcileOffresFromSkeleton(prisma);
  await seedOffresV2(prisma);
  await reconcileOffresV2(prisma);
  await seedCatalogFormations(prisma);
  // Nettoyage GÉNÉRIQUE du référentiel (remplace `archiveReplacedCatalogue` et
  // sa liste de slugs en dur, qui n'attrapait que la génération listée à la
  // main — d'où les 17 formations de juillet restées actives 9 jours). La règle
  // est dérivée du SSOT : hors de `FORMATIONS_V2` ⇒ archivée (sauf sur-mesure).
  // Exécuté APRÈS l'import pour que les formations du catalogue courant existent
  // déjà en base et ne soient jamais candidates à l'archivage.
  await runCatalogueCleanup();
  await seedGrilleQualite(prisma);
  await seedGrilleV2(prisma);
}

main()
  .catch((err) => {
    console.error("[qualiopi:seed] FATAL:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
