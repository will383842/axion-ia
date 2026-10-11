/**
 * Double emploi d'un formateur — UNE formulation, pour toutes les portes
 * d'affectation (fiche de session, création, report ; lot S2, N5).
 *
 * Le contrôle lui-même est `getTrainerConflicts` (planning unifié) : réutilisé,
 * jamais réécrit. Ce module ne fait que dire le conflit trouvé, dans les mêmes
 * mots partout.
 *
 * ⚠️ Lève si le planning est illisible : chaque porte décide elle-même de son
 * repli (la fiche de session laisse passer, le report écarte).
 */

import { getTrainerConflicts } from "@/features/admin-planning/queries";
import type { ConflictTarget } from "@/features/admin-planning/conflicts";

/** « ce formateur est déjà mobilisé sur « X » du … au … », ou `null` sans conflit. */
export async function constaterDoubleEmploi(
  trainerId: string,
  cible: ConflictTarget,
): Promise<string | null> {
  const conflits = await getTrainerConflicts(trainerId, cible);
  if (conflits.length === 0) return null;
  const premier = conflits[0];
  const autres = conflits.length > 1 ? ` (et ${conflits.length - 1} autre(s))` : "";
  return (
    `ce formateur est déjà mobilisé sur « ${premier?.titre ?? "une autre prestation"} »` +
    ` du ${premier?.debut.toLocaleDateString("fr-FR")} au ${(premier?.fin ?? premier?.debut)?.toLocaleDateString("fr-FR")}${autres}.`
  );
}
