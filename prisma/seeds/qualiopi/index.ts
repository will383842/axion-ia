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

async function main(): Promise<void> {
  await seedQualiopiConfig();
  await seedOffresSite(prisma);
  await reconcileOffresFromSkeleton(prisma);
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
