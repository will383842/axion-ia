/**
 * Ce que CE formateur a à contresigner sur CETTE session — lecture pour son espace.
 *
 * La demande de contresignature part par e-mail (`demande-contresignature.ts`) ;
 * elle doit aussi se TROUVER dans l'espace du formateur, avec un accès direct au
 * geste. Cette lecture alimente le bandeau de la page de la formation.
 *
 * 🔑 Même bilan que l'e-mail et que la fiche session (`bilanContresignature`),
 * filtré sur les demi-journées DÉSIGNÉES à ce formateur : un co-formateur ne se
 * voit pas réclamer l'attestation d'une journée qu'il n'a pas animée.
 *
 * ⚠️ L'appartenance se vérifie DANS la lecture (`whereSessionsDuFormateur`),
 * comme `lireFeuilleGroupe` : une sécurité qui repose sur l'ordre d'appel tient
 * tant qu'il n'y a qu'un appelant.
 *
 * Stub-safe : rend `[]` au build SSG.
 */

import { prisma } from "@/lib/prisma";
import { whereSessionsDuFormateur } from "@/server/formateur/collectif-queries";
import { bilanContresignature, type DemiJourneeAContresigner } from "./contresignatures-manquantes";

export async function contresignaturesAttenduesDuFormateur(
  sessionId: string,
  trainerId: string,
  maintenant: Date,
): Promise<DemiJourneeAContresigner[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return [];

  const s = await prisma.trainingSession.findFirst({
    where: {
      id: sessionId,
      // Une session annulée ou reportée ne se contresigne pas.
      statut: { notIn: ["annulee", "reportee"] },
      ...whereSessionsDuFormateur(trainerId),
    },
    select: {
      formateurPrincipalId: true,
      jours: { select: { date: true, heureDebut: true, heureFin: true, trainerId: true } },
      emargementContresignatures: {
        where: { revokedAt: null },
        select: { date: true, demiJournee: true },
      },
      enrollments: {
        select: {
          presences: {
            where: { emargementSignatures: { some: { revokedAt: null } } },
            select: { date: true, demiJournee: true },
          },
        },
      },
    },
  });
  if (s === null) return [];

  const { aContresigner } = bilanContresignature({
    jours: s.jours,
    formateurPrincipalId: s.formateurPrincipalId,
    creneauxSignes: s.enrollments.flatMap((e) => e.presences),
    contresignatures: s.emargementContresignatures,
    maintenant,
  });
  return aContresigner.filter((d) => d.formateurId === trainerId);
}
