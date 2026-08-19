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

// ─────────────────────────────────────────────────────────────────────────────
// Habilitations : DEUX notions, une seule définition de chacune
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Habilitation ACTIVE — ce que la GARDE d'assignation regarde.
 *
 * 🔴 Depuis le 2026-08-17 la dé-habilitation ne SUPPRIME plus la ligne, elle la
 * DATE (`retireAt`) : la preuve de conformité d'une session déjà animée survit
 * au retrait (ind. 21/22). Conséquence directe : lire `TrainerHabilitation` sans
 * ce filtre, c'est lire l'HISTORIQUE et déclarer habilité quelqu'un qui ne l'est
 * plus.
 */
export const HABILITATION_ACTIVE_WHERE = { retireAt: null } as const;

/**
 * Formation encore À L'OFFRE — ce qu'une pièce a le droit de citer.
 *
 * `not: "archive"` plutôt que `= "actif"` : le statut `publie` désigne une
 * formation bel et bien proposée ; l'écarter SOUS-déclarerait le périmètre du
 * formateur — l'erreur symétrique, tout aussi fausse devant un auditeur. Même
 * doctrine que `listFormationOptions` et que le Formation Engine.
 */
export const FORMATION_AU_CATALOGUE_WHERE = { statut: { not: "archive" } } as const;

/**
 * Habilitation DÉCLARABLE — ce qu'une pièce IMPRIMÉE peut annoncer : active, ET
 * portant sur une formation encore au catalogue.
 *
 * 🔴 Vérification du plan Qualiopi 2026-08-19 : les deux générateurs de la fiche
 * formateur (`verserFicheFormateurAction` et `genererCvFormateurAction`)
 * recopiaient chacun leur propre filtre — et avaient divergé. L'un filtrait
 * `archive` sans `retireAt`, l'autre ne filtrait rien du tout, et la liste des
 * intervenants comptait `retireAt` sans `archive`. Deux pièces du même dossier
 * se contredisaient, dans les deux sens. La DUPLICATION était la cause : une
 * définition recopiée à trois endroits diverge au premier amendement, et rien ne
 * signale l'écart. Il n'y en a donc plus qu'UNE.
 */
export const HABILITATION_DECLARABLE_WHERE = {
  ...HABILITATION_ACTIVE_WHERE,
  formation: FORMATION_AU_CATALOGUE_WHERE,
} as const;

/**
 * `where` complet des habilitations déclarables d'UN formateur — à passer tel
 * quel à `prisma.trainerHabilitation.findMany`. Point d'entrée unique des
 * générateurs de pièces.
 */
export function whereHabilitationsDeclarables(trainerId: string) {
  return { trainerId, ...HABILITATION_DECLARABLE_WHERE };
}

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
export type TrainerAvecHabilitations = Trainer & {
  /** Ids de formation habilités, lus depuis `TrainerHabilitation`. */
  formationIdsHabilites: string[];
  nbHabilitations: number;
};

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
      // 🔴 `HABILITATION_ACTIVE_WHERE` — seules les habilitations ACTIVES
      // comptent. Sans ce filtre, un formateur dé-habilité continuerait
      // d'apparaître habilité partout, et la garde `isTrainerHabilite` le
      // laisserait animer.
      //
      // ⚠️ Et VOLONTAIREMENT pas `HABILITATION_DECLARABLE_WHERE` : cette lecture
      // alimente `isTrainerHabilite` et l'écran d'affectation, pas une pièce
      // imprimée. `archiveFormationAction` autorise explicitement l'archivage
      // « même avec des sessions en cours/réalisées » — une session vivante peut
      // donc porter une formation archivée. Écarter ici les formations archivées
      // interdirait de remplacer le formateur d'une session en cours, sur une
      // formation retirée du catalogue APRÈS sa planification : un formateur qui
      // se désiste ne serait plus remplaçable. Le filtre `archive` appartient aux
      // POINTS D'IMPRESSION, où sur-déclarer trompe l'auditeur ; pas à la garde,
      // où il empêcherait un acte légitime.
      include: {
        habilitations: {
          where: { ...HABILITATION_ACTIVE_WHERE },
          select: { formationId: true },
        },
      },
    });
    return rows.map(({ habilitations, ...t }) => {
      const ids = habilitations.map((h) => h.formationId);
      return { ...t, formationIdsHabilites: ids, nbHabilitations: ids.length };
    });
  } catch {
    return [];
  }
}

/** Ids de formation habilités d'UN formateur. Stub-safe → []. */
export async function getFormationIdsHabilites(trainerId: string): Promise<string[]> {
  try {
    const rows = await prisma.trainerHabilitation.findMany({
      // Même filtre que `listTrainers` : une habilitation retirée reste au
      // registre pour l'auditeur, elle ne rend plus le formateur habilité.
      where: { trainerId, ...HABILITATION_ACTIVE_WHERE },
      select: { formationId: true },
    });
    return rows.map((r) => r.formationId);
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

/**
 * Champs minimaux nécessaires au contrôle d'habilitation.
 *
 * 🔴 Audit certification 2026-07-25 (F11) : `formationsHabilitees` (colonne legacy
 * `String[]`) a été remplacée ici par `formationIdsHabilites`, lu depuis
 * `TrainerHabilitation`. La colonne legacy contenait en production des SLUGS
 * (`ia-pour-bien-commencer`) alors que la garde compare des UUID de formation :
 * `includes()` ne pouvait JAMAIS être vrai, donc tout formateur était déclaré
 * « non habilité » et aucune session ne pouvait recevoir de formateur — pendant
 * que la liste affichait « 33 habilitations » en comptant ce même tableau.
 */
export type TrainerHabilitationFields = Pick<
  Trainer,
  "statut" | "sousTraitantVerifieAt" | "actif"
> & { formationIdsHabilites: readonly string[] };

export interface HabilitationCheck {
  ok: boolean;
  raison?: string;
}

/**
 * Un formateur peut-il être assigné à une formation donnée ?
 *
 * Règles (RNQ off.6/19) :
 *   - le formateur doit être ACTIF ;
 *   - la formation doit figurer dans ses habilitations (`TrainerHabilitation`) ;
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
  if (!trainer.formationIdsHabilites.includes(formationId)) {
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
