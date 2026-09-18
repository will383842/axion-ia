/**
 * Le constat « contresignature attendue par le financeur » pour UNE session.
 *
 * Le trait d'union entre la règle (`contresignature-attendue.ts`, pure) et la
 * mesure (`bilanContresignature`, unique). Cette lecture n'invente ni l'une ni
 * l'autre : elle va chercher le financement au dossier, rejoue le MÊME bilan
 * que la demande envoyée au formateur, et rend le constat à afficher.
 *
 * ⛔ Aucune écriture, aucun refus, aucune garde. La contresignature reste NON
 * BLOQUANTE (décision de Will du 25/08/2026) : ce module informe, un point.
 *
 * ⚠️ Stub-safe. Au build SSG (`stub.invalid`), il rend un constat MUET plutôt
 * que d'afficher un bandeau calculé sur des tables vides — un « rien à
 * contresigner » pré-rendu serait une affirmation fausse figée dans la page.
 */

import { prisma } from "@/lib/prisma";
import { bilanContresignature } from "./contresignatures-manquantes";
import {
  constaterContresignature,
  type ConstatContresignature,
  type FinancementSession,
} from "./contresignature-attendue";

const MUET: ConstatContresignature = { afficher: false, raison: "financement_non_renseigne" };

/**
 * @param sessionId Session concernée.
 * @param maintenant Instant de lecture — PARAMÈTRE, jamais `new Date()` en dur :
 *   le bilan dépend de l'heure (une journée non terminée ne se réclame pas).
 */
export async function constatContresignatureSession(
  sessionId: string,
  maintenant: Date,
): Promise<ConstatContresignature> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return MUET;

  const s = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      statut: true,
      financementType: true,
      formateurPrincipalId: true,
      sessionFormateurs: { select: { trainerId: true } },
      jours: { select: { date: true, heureDebut: true, heureFin: true, trainerId: true } },
      emargementContresignatures: {
        where: { revokedAt: null },
        select: { date: true, demiJournee: true },
      },
      enrollments: {
        select: {
          // L'override de financement PAR PARTICIPANT (R-INTER) : sur une
          // session inter-entreprises, chaque inscrit peut relever de son
          // propre financeur. Lire la seule session ferait écrire « aucun
          // financeur tiers » sur un dossier qui en a un.
          financementType: true,
          presences: {
            where: { emargementSignatures: { some: { revokedAt: null } } },
            select: { date: true, demiJournee: true },
          },
        },
      },
    },
  });
  if (s === null) return MUET;
  // Une session annulée ou reportée ne se contresigne pas — même exclusion que
  // `contresignaturesAttenduesDuFormateur`. Réclamer une pièce pour un dossier
  // qui ne sera jamais déposé est du bruit pur.
  if (s.statut === "annulee" || s.statut === "reportee") return MUET;

  const bilan = bilanContresignature({
    jours: s.jours,
    formateurPrincipalId: s.formateurPrincipalId,
    creneauxSignes: s.enrollments.flatMap((e) => e.presences),
    contresignatures: s.emargementContresignatures,
    membres: new Set(
      [s.formateurPrincipalId, ...s.sessionFormateurs.map((sf) => sf.trainerId)].filter(
        (id): id is string => id !== null,
      ),
    ),
    maintenant,
  });

  return constaterContresignature({
    financement: {
      session: (s.financementType as FinancementSession | null) ?? null,
      parInscription: s.enrollments.map(
        (e) => (e.financementType as FinancementSession | null) ?? null,
      ),
    },
    signees: bilan.signees,
    aContresigner: bilan.aContresigner,
  });
}
