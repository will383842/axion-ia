/**
 * Porte de doctrine des transitions vers « en ligne » (publication, programmation,
 * remise en ligne). Contrairement au contrôle d'alt-text, elle ne se contourne PAS
 * avec `forceOverride` : un interdit n'est pas une erreur de forme.
 *
 * Helper serveur → serveur (pas de "use server").
 */

import { prisma } from "@/lib/prisma";
import { ficheDestineeAuPublic, verifierDoctrineTraduction } from "@/lib/knowledge/banned-words";

/** Renvoie la raison du blocage, ou `null` si toutes les traductions passent. */
export async function raisonDoctrineEntree(
  entryId: string,
  apres?: { audience: string; confidentiality: string },
): Promise<string | null> {
  // Fiche interne (team / will_only, confidentialité > public) : hors porte.
  const entry = await prisma.knowledgeEntry.findUnique({
    where: { id: entryId },
    select: { audience: true, confidentiality: true },
  });
  if (!entry || !ficheDestineeAuPublic(apres ?? entry)) return null;

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
