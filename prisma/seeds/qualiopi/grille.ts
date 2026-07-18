/**
 * Qualiopi — Seed de la grille qualité pédagogique par défaut.
 *
 * Idempotent : crée `grille_qualite_v1` si absente, NE clobbe PAS si présente.
 * cleUnique = "grille_qualite_v1" → contrainte @@unique en DB.
 */

import type { PrismaClient, Prisma } from "../../generated/client";
import { DEFAULT_GRILLE_CRITERES } from "../../../src/server/qualiopi/engine/grille-schema";

export async function seedGrilleQualite(
  prisma: Prisma.TransactionClient | PrismaClient,
): Promise<void> {
  const CLE = "grille_qualite_v1";

  const existing = await prisma.grilleQualiteConfig.findUnique({
    where: { cleUnique: CLE },
  });

  if (existing) {
    console.log(`ℹ️  [qualiopi:seed] grille "${CLE}" déjà présente — préservée.`);
    return;
  }

  await prisma.grilleQualiteConfig.create({
    data: {
      cleUnique: CLE,
      criteres: DEFAULT_GRILLE_CRITERES as unknown as Prisma.InputJsonValue,
      scorePlancher: 80,
      nbPassesMax: 3,
      actif: true,
      promptVersion: 1,
    },
  });

  console.log(
    `✅ [qualiopi:seed] grille "${CLE}" créée (scorePlancher=80, nbPassesMax=3, actif=true).`,
  );
}
