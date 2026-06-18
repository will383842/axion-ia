/**
 * Content Generator — Séquence de types entrelacée (correctif diversité 2026-06-17).
 *
 * Module PUR (aucune I/O, aucune dépendance) → testable sans monter le worker.
 *
 * Problème corrigé : l'orchestrateur sélectionnait le type de chaque slot via un
 * échantillonnage cumulatif (`sampleWeighted`) qui regroupe tous les slots d'un
 * type consécutivement et front-load le 1er type du dict — or Postgres JSONB
 * réordonne les clés (faq_geo, poids 5, finissait en tête). Sur un petit
 * `totalTargetCount` (ex. 6), les slots 0-4 tombaient TOUS sur faq_geo →
 * mono-type. Cette séquence entrelace les types par crédit cumulé (algorithme
 * du plus grand reste / Bresenham), triés par poids décroissant pour être stable
 * indépendamment de l'ordre des clés. Diversité garantie dès le 2e slot, même
 * quand `count < somme des poids`. À indexer par le slot GLOBAL
 * (`generatedCount + i`) pour rester cohérent tick après tick.
 */
export function buildWeightedSequence<K extends string>(
  dist: Record<K, number>,
  count: number,
): K[] {
  const entries = (Object.entries(dist) as Array<[K, number]>)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (entries.length === 0 || total <= 0 || count <= 0) return [];
  const credit = new Map<K, number>(entries.map(([k]) => [k, 0]));
  const out: K[] = [];
  for (let s = 0; s < count; s++) {
    for (const [k, w] of entries) credit.set(k, credit.get(k)! + w / total);
    let best = entries[0]![0];
    for (const [k] of entries) if (credit.get(k)! > credit.get(best)! + 1e-9) best = k;
    out.push(best);
    credit.set(best, credit.get(best)! - 1);
  }
  return out;
}
