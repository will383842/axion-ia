/**
 * Qualiopi — Lecture des indisponibilités des formateurs.
 *
 * Aucune règle ici : le calcul (bornes incluses, capacité résiduelle, conflits)
 * vit dans `availability.ts`, pur et testé.
 *
 * Stub-aware (try/catch → valeurs vides) : ces lectures peuvent être appelées au
 * build SSG, où `DATABASE_URL` pointe sur `stub.invalid`. Jamais de `*OrThrow`.
 */

import { prisma } from "@/lib/prisma";
import {
  dayKeyOfDateColumn,
  type Indisponibilite,
  type TrainerAvailabilityTypeValue,
} from "./availability";

export interface IndispoRow extends Indisponibilite {
  id: string;
  motif: string | null;
}

/**
 * Indisponibilités qui INTERSECTENT la fenêtre `[debut, fin]` (bornes incluses).
 *
 * Le prédicat d'intersection est `debutIndispo <= fin && finIndispo >= debut` :
 * une fenêtre qui commence avant le mois et finit dedans compte, tout comme
 * l'inverse. Filtrer sur `dateDebut BETWEEN …` raterait un congé de trois
 * semaines à cheval sur deux mois — précisément le cas qu'on veut voir.
 */
export async function listIndisposEntre(debut: Date, fin: Date): Promise<IndispoRow[]> {
  try {
    const rows = await prisma.trainerAvailability.findMany({
      where: { dateDebut: { lte: fin }, dateFin: { gte: debut } },
      orderBy: { dateDebut: "asc" },
    });
    return rows.map(versIndispo);
  } catch {
    return [];
  }
}

/** Toutes les indisponibilités d'un formateur, les plus récentes d'abord. */
export async function listIndisposFormateur(trainerId: string): Promise<IndispoRow[]> {
  try {
    const rows = await prisma.trainerAvailability.findMany({
      where: { trainerId },
      orderBy: { dateDebut: "desc" },
      take: 100,
    });
    return rows.map(versIndispo);
  } catch {
    return [];
  }
}

function versIndispo(r: {
  id: string;
  trainerId: string;
  type: TrainerAvailabilityTypeValue;
  dateDebut: Date;
  dateFin: Date;
  motif: string | null;
}): IndispoRow {
  return {
    id: r.id,
    trainerId: r.trainerId,
    type: r.type,
    // Colonnes `DATE` : stockées à minuit UTC, donc converties sans fuseau.
    debut: dayKeyOfDateColumn(r.dateDebut),
    fin: dayKeyOfDateColumn(r.dateFin),
    motif: r.motif,
  };
}

// NB : la lecture des habilitations reste volontairement sur le tableau legacy
// `Trainer.formationsHabilitees` (via `isTrainerHabilite` / `TrainerManageForm`)
// tant que le backfill `backfill-trainer-habilitations-2026-07-10.ts` n'a pas
// tourné en production. Le dual-write peuple `trainer_habilitations` pour
// préparer la bascule ; un lecteur normalisé prématuré serait du code mort. On
// l'ajoutera au moment de basculer la source de vérité, pas avant.
