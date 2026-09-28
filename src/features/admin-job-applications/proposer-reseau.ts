import "server-only";

/**
 * « PROPOSER LE RÉSEAU D'APPORTEURS » — la lecture (2026-09-28).
 *
 * Pas un module `"use server"` : une lecture exportée d'un fichier d'actions
 * deviendrait un point d'entrée réseau (même doctrine que `reads.ts`). La page
 * applique sa garde avant d'appeler.
 */

import { prisma } from "@/lib/prisma";
import { ORIGINE_CANDIDATURE_OFFRE } from "@/lib/contact/accuse-attendu";

/**
 * La fiche apporteur NÉE de cette candidature, si elle existe — par
 * `details.jobApplicationId`, posé à la création. Une fiche effacée ne compte
 * pas : elle ne se rouvre pas.
 *
 * Le filtre porte AUSSI l'origine : un `jobApplicationId` égaré dans une autre
 * sorte de fiche ne doit pas passer pour « réseau déjà proposé ».
 */
export async function ficheApporteurDeLaCandidature(
  applicationId: string,
): Promise<{ id: string; creeeLe: Date } | null> {
  const ligne = await prisma.submission.findFirst({
    where: {
      AND: [
        { details: { path: ["jobApplicationId"], equals: applicationId } },
        { details: { path: ["origine"], equals: ORIGINE_CANDIDATURE_OFFRE } },
      ],
      deletedAt: null,
    },
    select: { id: true, submittedAt: true },
    orderBy: { submittedAt: "asc" },
  });
  return ligne ? { id: ligne.id, creeeLe: ligne.submittedAt } : null;
}
