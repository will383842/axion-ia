/**
 * Qualiopi ind. 21 — LECTURE des évaluations de compétences d'un formateur.
 *
 * Partagée par la fiche console, l'écrivain (`ecriture.ts`), les deux règles
 * d'activation et la garde de mission : tous jugent sur les mêmes lignes.
 *
 * 🔴 Aucun écran du formateur (dossier en ligne, espace formateur) n'importe ce module :
 * un test le verrouille (`__tests__/le-formateur-ne-voit-jamais-les-grilles.spec.ts`).
 *
 * Module neutre (sans `server-only`) : `activation.ts` et la garde de mission sont aussi
 * appelés hors requête.
 */

import { prisma } from "@/lib/prisma";

import type { FaitsActivationQ21 } from "./garde-activation-q21";
import type { LigneEvaluationLue } from "./regles";

type Client = Pick<typeof prisma, "evaluationCompetenceFormateur">;

export const SELECT_LIGNE_EVALUATION = {
  id: true,
  nature: true,
  formationId: true,
  notes: true,
  decision: true,
  motif: true,
  dateSuivie: true,
  version: true,
  createdAt: true,
} as const;

/** Toutes les lignes versées pour ce formateur, de la plus ancienne à la plus récente. */
export async function lireEvaluationsDuFormateur(
  trainerId: string,
  db: Client = prisma,
): Promise<LigneEvaluationLue[]> {
  return db.evaluationCompetenceFormateur.findMany({
    where: { trainerId },
    orderBy: { createdAt: "asc" },
    select: SELECT_LIGNE_EVALUATION,
  });
}

/** Ce que la fiche console affiche : les lignes, avec leur auteur. */
export async function lireEvaluationsConsole(trainerId: string) {
  const lignes = await prisma.evaluationCompetenceFormateur.findMany({
    where: { trainerId },
    orderBy: { createdAt: "asc" },
    select: {
      ...SELECT_LIGNE_EVALUATION,
      auteurId: true,
      auteurRole: true,
      entretienId: true,
      miseEnSituationId: true,
    },
  });
  const auteurs = [...new Set(lignes.map((l) => l.auteurId))];
  const noms =
    auteurs.length === 0
      ? []
      : await prisma.adminUser.findMany({
          where: { id: { in: auteurs } },
          select: { id: true, name: true, email: true },
        });
  const parId = new Map(noms.map((u) => [u.id, u.name || u.email]));
  return lignes.map((l) => ({ ...l, auteur: parId.get(l.auteurId) ?? "compte supprimé" }));
}

/**
 * Les faits de la garde d'activation Q21 (`garde-activation-q21.ts`). Fiche absente : `{}`,
 * donc tout manque.
 */
export async function lireFaitsActivationQ21(trainerId: string): Promise<FaitsActivationQ21> {
  // Chaque lecture part d'une promesse : une erreur levée en construisant l'une ne laisse
  // jamais les autres rejetées sans preneur.
  const [t, evaluations, controles] = await Promise.all([
    Promise.resolve().then(() =>
      prisma.trainer.findUnique({
        where: { id: trainerId },
        select: {
          siret: true,
          sousTraitantNda: true,
          documents: {
            where: { type: "cv" },
            select: {
              type: true,
              statutValidation: true,
              fichierUrl: true,
              contenu: { select: { trainerDocumentId: true } },
              dateEmission: true,
              dateExpiration: true,
            },
          },
        },
      }),
    ),
    Promise.resolve().then(() => lireEvaluationsDuFormateur(trainerId)),
    Promise.resolve().then(() =>
      prisma.verificationRegistreSousTraitance.findMany({
        where: { trainerId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { verdict: true, source: true, verifieAt: true, createdAt: true, siret: true },
      }),
    ),
  ]);
  if (t === null) return {};
  return {
    evaluations,
    siret: t.siret ?? null,
    nda: t.sousTraitantNda ?? null,
    controles,
    pieces: t.documents,
  };
}
