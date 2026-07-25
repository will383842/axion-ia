/**
 * Qualiopi — Lecture formateurs (Trainer) + helper d'habilitation.
 *
 * Stub-aware (try/catch → [] / null). Jamais de `*OrThrow`.
 *
 * Contexte : audit E2E 2026-06-06 (R9). Le modèle Trainer existait sans aucun
 * CRUD/UI ni blocage d'assignation. Ce module fournit la couche de lecture +
 * `isTrainerHabilite` (pur, testable) utilisé par la garde d'assignation
 * formateur↔session (off.6/19 RNQ : seul un formateur habilité — et vérifié si
 * sous-traitant — peut être assigné à une formation).
 */

import { prisma } from "@/lib/prisma";
import type { Trainer, TrainerStatut } from "../../../../prisma/generated/client";

export interface ListTrainersOpts {
  /** Filtre par statut (salarie / sous_traitant). */
  statut?: TrainerStatut;
  /** N'inclure que les formateurs actifs. */
  actifOnly?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Formateur enrichi du NOMBRE RÉEL d'habilitations, lu depuis
 * `TrainerHabilitation` — la seule source qui fasse foi pour la garde
 * d'assignation.
 *
 * 🔴 Audit certification 2026-07-25 : la liste affichait
 * `formationsHabilitees.length` (colonne legacy `String[]`). En production cette
 * colonne contenait 33 SLUGS d'un catalogue depuis archivé, dans un format que
 * plus aucun lecteur ne sait résoudre (le code attend des UUID). L'écran
 * annonçait donc « 33 habilitations » pendant que la garde en voyait 0 et
 * refusait toute assignation. Compter la relation supprime la contradiction.
 */
export type TrainerAvecHabilitations = Trainer & { nbHabilitations: number };

/** Tous les formateurs, triés par nom. Stub-safe → [] au build. */
export async function listTrainers(opts?: ListTrainersOpts): Promise<TrainerAvecHabilitations[]> {
  try {
    const where: { statut?: TrainerStatut; actif?: boolean } = {};
    if (opts?.statut) where.statut = opts.statut;
    if (opts?.actifOnly) where.actif = true;
    const rows = await prisma.trainer.findMany({
      ...(Object.keys(where).length > 0 ? { where } : {}),
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
      ...(opts?.limit !== undefined ? { take: opts.limit } : {}),
      ...(opts?.offset !== undefined ? { skip: opts.offset } : {}),
      include: { _count: { select: { habilitations: true } } },
    });
    return rows.map(({ _count, ...t }) => ({ ...t, nbHabilitations: _count.habilitations }));
  } catch {
    return [];
  }
}

/** Formateur par id UUID. Stub-safe → null. */
export async function getTrainer(id: string): Promise<Trainer | null> {
  try {
    return await prisma.trainer.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

/** Formateur par email. Stub-safe → null. */
export async function getTrainerByEmail(email: string): Promise<Trainer | null> {
  try {
    return await prisma.trainer.findUnique({ where: { email } });
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Habilitation (pur — testable sans DB)
// ─────────────────────────────────────────────────────────────────────────────

/** Champs minimaux nécessaires au contrôle d'habilitation. */
export type TrainerHabilitationFields = Pick<
  Trainer,
  "statut" | "formationsHabilitees" | "sousTraitantVerifieAt" | "actif"
>;

export interface HabilitationCheck {
  ok: boolean;
  raison?: string;
}

/**
 * Un formateur peut-il être assigné à une formation donnée ?
 *
 * Règles (RNQ off.6/19) :
 *   - le formateur doit être ACTIF ;
 *   - la formation doit figurer dans `formationsHabilitees` ;
 *   - si SOUS-TRAITANT : `sousTraitantVerifieAt` doit être renseigné
 *     (vérification data.gouv.fr — cf. validateSousTraitant).
 */
export function isTrainerHabilite(
  trainer: TrainerHabilitationFields,
  formationId: string,
): HabilitationCheck {
  if (!trainer.actif) {
    return { ok: false, raison: "Formateur inactif." };
  }
  if (!trainer.formationsHabilitees.includes(formationId)) {
    return {
      ok: false,
      raison:
        "Formateur non habilité sur cette formation (ajouter la formation à ses habilitations).",
    };
  }
  if (trainer.statut === "sous_traitant" && !trainer.sousTraitantVerifieAt) {
    return {
      ok: false,
      raison: "Sous-traitant non vérifié (data.gouv.fr) — ne peut pas être assigné.",
    };
  }
  return { ok: true };
}
