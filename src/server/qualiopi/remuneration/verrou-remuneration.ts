/**
 * Lot S3 (C3) — fabrique UNIQUE des clés de verrou de rémunération, et ordre
 * UNIQUE de leur prise.
 *
 * Deux verrous consultatifs de TRANSACTION (`pg_advisory_xact_lock`, relâchés
 * au commit comme au rollback) :
 *   - `remuneration_run_<année>_<mois>` — la période, que le run mensuel tient
 *     pendant qu'il efface et réécrit les lignes du mois ;
 *   - `remuneration_trainer_<id>` — le formateur.
 *
 * 🔴 Pourquoi un seul module. Deux écrivains qui orthographient la même clé
 * différemment (`_06` d'un côté, `_6` de l'autre) prennent DEUX verrous et ne
 * se sérialisent pas — chacun croit être seul. Et deux écrivains qui prennent
 * les mêmes verrous dans un ordre différent s'interbloquent. D'où l'ordre fixe,
 * appliqué ICI et nulle part ailleurs : période(s) par mois croissant, puis
 * formateur(s) par identifiant croissant. Une garde statique
 * (`verrou-remuneration.spec.ts`) refuse toute autre construction de ces clés.
 *
 * `$executeRawUnsafe` et non le gabarit paramétré : c'est la forme que le run
 * employait déjà (et que ses tests lisent). Les clés ne portent que des entiers
 * et des UUID validés en amont ; l'apostrophe est tout de même doublée.
 */

export interface PeriodeVerrou {
  year: number;
  month: number;
}

export type CibleVerrouRemuneration = { periode: PeriodeVerrou } | { trainerId: string };

export function cleVerrouRemuneration(cible: CibleVerrouRemuneration): string {
  if ("periode" in cible) {
    return `remuneration_run_${cible.periode.year}_${cible.periode.month}`;
  }
  return `remuneration_trainer_${cible.trainerId}`;
}

function sqlVerrou(cle: string): string {
  return `SELECT pg_advisory_xact_lock(hashtext('${cle.replace(/'/g, "''")}'))`;
}

/**
 * Prend, dans la transaction `tx`, les verrous de période puis de formateur,
 * dans l'ordre fixe. Bloquant : attend que le détenteur commite.
 */
export async function prendreVerrousRemuneration(
  tx: { $executeRawUnsafe: (sql: string) => Promise<unknown> },
  cibles: {
    periodes: readonly PeriodeVerrou[];
    trainerIds: readonly string[];
  },
): Promise<void> {
  const periodes = [
    ...new Map(cibles.periodes.map((p) => [p.year * 12 + (p.month - 1), p])).entries(),
  ]
    .sort(([a], [b]) => a - b)
    .map(([, p]) => p);
  const trainerIds = [...new Set(cibles.trainerIds)].sort();

  for (const periode of periodes) {
    await tx.$executeRawUnsafe(sqlVerrou(cleVerrouRemuneration({ periode })));
  }
  for (const trainerId of trainerIds) {
    await tx.$executeRawUnsafe(sqlVerrou(cleVerrouRemuneration({ trainerId })));
  }
}
