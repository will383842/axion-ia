/**
 * Porte de doctrine des transitions vers « en ligne » (publication, programmation,
 * remise en ligne). Contrairement au contrôle d'alt-text, elle ne se contourne PAS
 * avec `forceOverride` : un interdit n'est pas une erreur de forme.
 *
 * Helper serveur → serveur (pas de "use server").
 */

import { prisma } from "@/lib/prisma";
import { verifierDoctrineTraduction } from "@/lib/knowledge/banned-words";

/** Renvoie la raison du blocage, ou `null` si toutes les traductions passent. */
export async function raisonDoctrineEntree(entryId: string): Promise<string | null> {
  const translations = await prisma.knowledgeTranslation.findMany({
    where: { entryId },
    select: {
      locale: true,
      title: true,
      excerpt: true,
      body: true,
      bodyText: true,
      metaTitle: true,
      metaDescription: true,
    },
  });
  for (const t of translations) {
    const check = verifierDoctrineTraduction(t);
    if (!check.valid) return `${t.locale}: ${check.reason ?? "doctrine non respectée"}`;
  }
  return null;
}
