/**
 * 🔴 Lot L4 (2026-09-30), correction de revue — le conflit de formateur sur la
 * fiche session.
 *
 * La fiche 360° du planning (`/planning/formation/[id]`) était la seule à dire
 * qu'un formateur est déjà mobilisé sur une prestation qui chevauche la session.
 * Depuis qu'elle répond 308 vers la fiche session, celle-ci reprend le calcul —
 * la MÊME règle (`getTrainerConflicts` → `findConflicts`), pas une copie.
 *
 * Fail-soft et DIT : une lecture en échec rend `erreur: true`, que l'écran
 * affiche. « Aucun conflit » ne doit jamais être le masque d'une panne.
 */

import { getTrainerConflicts } from "@/features/admin-planning/queries";
import type { PlanningEvent, PlanningStatut } from "@/features/admin-planning/types";

export interface ConflitsFormateur {
  conflits: PlanningEvent[];
  erreur: boolean;
}

export async function conflitsFormateurSession(s: {
  id: string;
  dateDebut: Date;
  dateFin: Date;
  statut: PlanningStatut;
  formateurPrincipalId: string | null;
}): Promise<ConflitsFormateur> {
  if (s.formateurPrincipalId === null) return { conflits: [], erreur: false };
  try {
    const conflits = await getTrainerConflicts(s.formateurPrincipalId, {
      key: `formation:${s.id}`,
      debut: s.dateDebut,
      fin: s.dateFin,
      statut: s.statut,
    });
    return { conflits, erreur: false };
  } catch {
    return { conflits: [], erreur: true };
  }
}
