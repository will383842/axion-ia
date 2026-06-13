/**
 * Espace formateur — requêtes coaching 1-to-1 (Node runtime, 2026-06-13).
 *
 * Toutes les requêtes sont SCOPÉES par `trainerId` (sécurité : un formateur ne
 * voit que ses propres séances). Appelées depuis des Server Components après
 * `requireFormateur()`.
 */

import { prisma } from "@/lib/prisma";

/** Liste des séances du formateur (résumé pour le tableau de bord). */
export async function listMySessions(trainerId: string) {
  return prisma.coachingSession.findMany({
    where: { trainerId },
    orderBy: { dateSeance: "desc" },
    select: {
      id: true,
      interventionSlug: true,
      dateSeance: true,
      statut: true,
      beneficiaireNom: true,
      beneficiaireEntreprise: true,
      _count: { select: { optimisations: true, comptesRendus: true, journaux: true } },
    },
  });
}

/**
 * Détail complet d'une séance — null si elle n'appartient pas au formateur.
 * (Le `where` inclut `trainerId` : impossible d'accéder à la séance d'un autre.)
 */
export async function getSessionForFormateur(sessionId: string, trainerId: string) {
  return prisma.coachingSession.findFirst({
    where: { id: sessionId, trainerId },
    include: {
      cartographie: true,
      plan: true,
      optimisations: { orderBy: [{ priorite: "asc" }, { createdAt: "asc" }] },
      comptesRendus: { orderBy: { dateSeance: "desc" } },
      journaux: { orderBy: { dateEntree: "desc" } },
    },
  });
}
