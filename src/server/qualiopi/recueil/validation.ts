/**
 * Chantier QNC, L03 — VALIDATION HORODATÉE de l'analyse par l'organisme.
 *
 * Quand l'entreprise a répondu au recueil (`reponse_recue`), Will relit et
 * VALIDE : une ligne de journal (ajout seul — date serveur, auteur) est la
 * preuve. Aucune colonne n'est ajoutée au questionnaire. Idempotente : la
 * première validation fait foi, une seconde n'écrit rien.
 */

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";
import { estActifPour, lireInterrupteurQualiopi } from "@/server/qualiopi/socle/interrupteurs";

import { ACTION_ANALYSE_VALIDEE, LOT_RECUEIL } from "./constantes";

type Db = Pick<
  typeof prisma,
  "setting" | "questionnaireCadrage" | "trainingSession" | "activityLog"
>;

export type ResultatValidation =
  | { readonly ok: true; readonly valideLe: Date; readonly dejaValidee: boolean }
  | { readonly ok: false; readonly message: string };

export async function validerAnalyse(
  db: Db,
  entree: {
    readonly questionnaireId: string;
    readonly auteurId: string;
    readonly maintenant?: Date;
  },
): Promise<ResultatValidation> {
  const q = await db.questionnaireCadrage.findUnique({
    where: { id: entree.questionnaireId },
    select: { id: true, statut: true, projetId: true },
  });
  if (q === null) return { ok: false, message: "Questionnaire introuvable." };
  const etat = await lireInterrupteurQualiopi(LOT_RECUEIL, db);
  // En essai, le lot n'agit que si une session du banc d'essai porte ce projet.
  const test =
    etat === "essai"
      ? (await db.trainingSession.findFirst({
          where: { projetId: q.projetId, estTestInterne: true },
          select: { id: true },
        })) !== null
      : false;
  if (!estActifPour(etat, { estTestInterne: test })) {
    return { ok: false, message: "Le recueil du besoin n'est pas allumé." };
  }
  if (q.statut !== "reponse_recue") {
    return {
      ok: false,
      message: "L'entreprise n'a pas encore répondu : il n'y a rien à valider.",
    };
  }
  const deja = await db.activityLog.findFirst({
    where: {
      action: ACTION_ANALYSE_VALIDEE,
      targetType: "QuestionnaireCadrage",
      targetId: q.id,
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  if (deja !== null) return { ok: true, valideLe: deja.createdAt, dejaValidee: true };

  const valideLe = entree.maintenant ?? new Date();
  await journaliser(
    db,
    {
      action: ACTION_ANALYSE_VALIDEE,
      targetType: "QuestionnaireCadrage",
      targetId: q.id,
      changes: { valideLe: valideLe.toISOString() },
      session: { userId: entree.auteurId },
    },
    { exiger: true },
  );
  return { ok: true, valideLe, dejaValidee: false };
}
