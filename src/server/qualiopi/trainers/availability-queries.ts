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

/**
 * Habilitations d'un formateur, lues DEPUIS LA TABLE si elle est peuplée, sinon
 * depuis le tableau legacy `Trainer.formationsHabilitees`.
 *
 * Même doctrine que `resolvePrincipalTrainerId` : la source normalisée prime, le
 * legacy sert de repli tant que le backfill n'a pas tourné en production. Une
 * table vide pour un formateur n'est PAS la preuve qu'il n'a aucune habilitation
 * — c'est peut-être seulement que le backfill n'est pas passé. D'où le repli, et
 * non un `[]` qui lui interdirait d'animer quoi que ce soit.
 */
export async function listHabilitations(trainerId: string): Promise<string[]> {
  try {
    const rows = await prisma.trainerHabilitation.findMany({
      where: { trainerId },
      select: { formationId: true },
    });
    if (rows.length > 0) return rows.map((r) => r.formationId);

    const legacy = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { formationsHabilitees: true },
    });
    return legacy?.formationsHabilitees ?? [];
  } catch {
    return [];
  }
}
