/**
 * Lot S3 (C3) — fabrique unique des clés de verrou de rémunération.
 *
 * ⚠️ Squelette du commit de tests rouges : l'implémentation arrive au commit suivant.
 */

export type CibleVerrouRemuneration =
  { periode: { year: number; month: number } } | { trainerId: string };

export function cleVerrouRemuneration(_cible: CibleVerrouRemuneration): string {
  throw new Error("cleVerrouRemuneration : non implémenté");
}

export async function prendreVerrousRemuneration(
  _tx: { $executeRawUnsafe: (sql: string) => Promise<unknown> },
  _cibles: {
    periodes: readonly { year: number; month: number }[];
    trainerIds: readonly string[];
  },
): Promise<void> {
  throw new Error("prendreVerrousRemuneration : non implémenté");
}
