/**
 * Identifiant du job BullMQ d'un rapport avant audit (2026-11-02). PUR.
 *
 * Premier passage : `rapport-avant-audit-<id>`. Reprise : un identifiant STABLE par tranche de
 * `TRANCHE_REPRISE_MS` (la période du balayage). Avant, chaque reprise portait `Date.now()` : un
 * balayage qui passait alors qu'un job de reprise attendait encore dans la file en ajoutait un
 * second. Dans une même tranche, BullMQ ignore désormais l'ajout en double (même `jobId`) ; d'une
 * tranche à l'autre, le doublon reste sans effet (la prise en base est atomique).
 */

/** Une tranche = la période du balayage des lancements en suspens (10 minutes). */
export const TRANCHE_REPRISE_MS = 10 * 60_000;

export function jobIdRapport(
  rapportId: string,
  reprise: boolean,
  maintenant: Date = new Date(),
): string {
  if (!reprise) return `rapport-avant-audit-${rapportId}`;
  const tranche = Math.floor(maintenant.getTime() / TRANCHE_REPRISE_MS);
  return `rapport-avant-audit-${rapportId}-reprise-${tranche}`;
}
