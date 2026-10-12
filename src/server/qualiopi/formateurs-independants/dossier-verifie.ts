/**
 * Formateurs indépendants — le dossier passe « vérifié » à la contresignature
 * (lot B, M15).
 *
 * Écrit, dans une seule écriture conditionnelle :
 *   - `dossierStatut = "verifie"` et `dossierVerifieAt` : le formateur entre dans la
 *     population des relances de pièces (S6, `pieces-relances.ts`) ;
 *   - `accesVersion + 1` : le lien du dossier (même en lecture seule) est RÉVOQUÉ.
 *
 * Seul un dossier ouvert (en cours, à compléter ou à vérifier) passe : une fiche sans
 * dossier en ligne, ou déjà vérifiée, n'est pas touchée. Le journal ne porte que
 * l'identifiant de la fiche.
 *
 * Le rôle (contresigner) est gardé par l'appelant.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";

export async function marquerDossierVerifie(p: {
  trainerId: string;
  parId: string;
  maintenant: Date;
}): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const r = await tx.trainer.updateMany({
      where: {
        id: p.trainerId,
        dossierStatut: { in: ["en_cours", "a_completer", "a_verifier"] },
      },
      data: {
        dossierStatut: "verifie",
        dossierVerifieAt: p.maintenant,
        accesVersion: { increment: 1 },
      },
    });
    if (r.count !== 1) return false;
    await journaliser(
      tx,
      {
        action: "qualiopi.formateur.dossier_verifie",
        targetType: "Trainer",
        targetId: p.trainerId,
        changes: { lienDossierRevoque: true },
        session: { userId: p.parId },
      },
      { exiger: true },
    );
    return true;
  });
}
