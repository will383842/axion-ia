/**
 * Qualiopi ind. 21 — L'ÉCRIVAIN UNIQUE des évaluations de compétences d'un formateur
 * indépendant. AJOUT SEUL : ce module ne fait que des `create` (la base refuse d'ailleurs
 * UPDATE, DELETE et TRUNCATE sur la table, triggers `…_ajout_seul`).
 *
 * Chaque versement est :
 *   - réservé au rôle `habiliter_formateur`, jugé AVANT toute lecture ;
 *   - attribué à l'identité console (session), jamais à une saisie ;
 *   - daté par la base (`createdAt`) ;
 *   - refusé s'il est vierge ou incomplet ;
 *   - journalisé DANS la même transaction (`exiger`) : pas de grille sans trace.
 *
 * Une décision « habilité » qui n'atteint pas les seuils de `reglages.ts` est refusée ;
 * toute décision porte un motif et garde une copie des seuils du jour.
 *
 * Verrou : `__tests__/ecrivain-unique.spec.ts` refuse toute autre écriture de la table.
 */

import { prisma } from "@/lib/prisma";
import type { AdminSession } from "@/server/actions/knowledge/_guards";
import { MOTIF_REFUS, peutEngager } from "@/server/auth/habilitations";
import { journaliser } from "@/server/journal/journaliser";

import { MOTIF_MAX, VERSION_CONFIGURATION_EVALUATION } from "./configuration";
import { SELECT_LIGNE_EVALUATION } from "./lecture";
import { REGLAGES_EVALUATION } from "./reglages";
import {
  validerDecision,
  validerFormationMethode,
  validerNotes,
  type NatureEvaluation,
} from "./regles";

/** L'acte qui ouvre le versement des grilles. */
export const ACTE_EVALUATION = "habiliter_formateur" as const;

export type DemandeVersement =
  | {
      readonly nature: "entretien" | "mise_en_situation";
      readonly notes: unknown;
      readonly observation?: string | null;
    }
  | {
      readonly nature: "decision_habilitation";
      readonly formationId: string;
      readonly decision: unknown;
      readonly motif: unknown;
    }
  | { readonly nature: "formation_methode"; readonly jour: unknown };

export type ResultatVersement =
  { readonly ok: true; readonly id: string } | { readonly ok: false; readonly message: string };

const refus = (message: string): ResultatVersement => ({ ok: false, message });

class Refus extends Error {}

/** Verse une grille, une décision ou la case « formation à la méthode suivie ». */
export async function verserEvaluation(input: {
  readonly trainerId: string;
  readonly session: AdminSession;
  readonly demande: DemandeVersement;
  readonly maintenant?: Date;
}): Promise<ResultatVersement> {
  const { trainerId, session, demande } = input;
  if (!peutEngager(session.role, ACTE_EVALUATION)) {
    return refus(`Versement refusé : ${MOTIF_REFUS[ACTE_EVALUATION]}`);
  }
  const maintenant = input.maintenant ?? new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const t = await tx.trainer.findUnique({
        where: { id: trainerId },
        select: { statut: true },
      });
      if (t === null) throw new Refus("Formateur introuvable.");
      if (t.statut !== "sous_traitant") {
        throw new Refus("Les grilles d'évaluation concernent les formateurs indépendants.");
      }

      let data: {
        nature: NatureEvaluation;
        notes?: Record<string, number>;
        motif?: string | null;
        formationId?: string;
        decision?: "habilite" | "avec_reserve" | "non_habilite" | "second_essai";
        entretienId?: string;
        miseEnSituationId?: string | null;
        seuilsAppliques?: Record<string, number>;
        dateSuivie?: Date;
      };

      if (demande.nature === "entretien" || demande.nature === "mise_en_situation") {
        const v = validerNotes(demande.nature, demande.notes);
        if (!v.ok) throw new Refus(v.message);
        const observation = (demande.observation ?? "").trim();
        if (observation.length > MOTIF_MAX) {
          throw new Refus(`L'observation dépasse ${MOTIF_MAX} caractères.`);
        }
        data = { nature: demande.nature, notes: { ...v.notes }, motif: observation || null };
      } else if (demande.nature === "decision_habilitation") {
        const formation = await tx.formation.findUnique({
          where: { id: demande.formationId },
          select: { id: true },
        });
        if (formation === null) throw new Refus("Formation introuvable.");
        const lignes = await tx.evaluationCompetenceFormateur.findMany({
          where: { trainerId },
          select: SELECT_LIGNE_EVALUATION,
        });
        const v = validerDecision({
          decision: demande.decision,
          motif: demande.motif,
          lignes,
          reglages: REGLAGES_EVALUATION,
        });
        if (!v.ok) throw new Refus(v.message);
        data = {
          nature: "decision_habilitation",
          formationId: formation.id,
          decision: v.decision,
          motif: v.motif,
          entretienId: v.entretienId,
          miseEnSituationId: v.miseEnSituationId,
          seuilsAppliques: { ...REGLAGES_EVALUATION },
        };
      } else if (demande.nature === "formation_methode") {
        const v = validerFormationMethode(demande.jour, maintenant);
        if (!v.ok) throw new Refus(v.message);
        data = { nature: "formation_methode", dateSuivie: v.dateSuivie };
      } else {
        throw new Refus("Versement inconnu.");
      }

      const cree = await tx.evaluationCompetenceFormateur.create({
        data: {
          trainerId,
          ...data,
          version: VERSION_CONFIGURATION_EVALUATION,
          auteurId: session.userId,
          auteurRole: session.role.slice(0, 40),
        },
        select: { id: true },
      });
      // Aucune note ni motif au journal : la ligne est la preuve, le journal dit le geste.
      await journaliser(
        tx,
        {
          action: "qualiopi.trainer.evaluation_competences",
          targetType: "Trainer",
          targetId: trainerId,
          changes: {
            nature: data.nature,
            evaluationId: cree.id,
            ...(data.decision ? { decision: data.decision, formationId: data.formationId } : {}),
            role: session.role,
          },
          session: { userId: session.userId },
        },
        { exiger: true },
      );
      return { ok: true as const, id: cree.id };
    });
  } catch (err) {
    if (err instanceof Refus) return refus(err.message);
    return refus("Le versement n'a pas été enregistré (erreur technique).");
  }
}
