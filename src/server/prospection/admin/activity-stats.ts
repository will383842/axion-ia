/**
 * Prospection — Agrégation de couverture PAR ACTIVITÉ (secteur ou code NAF).
 *
 * Répond à « savoir exactement ce qui a été enrichi + % de contacts exploitables
 * par type d'activité » : au-delà du par-département, on ventile collectées /
 * enrichies / exploitables par secteur (grossier) puis par NAF (fin, ex.
 * architectes dans le BTP). Pur → l'appelant fournit les `groupBy` Prisma.
 */

export interface ActivityRow {
  key: string;
  label: string;
  collectees: number;
  enrichies: number;
  exploitables: number;
  partiels: number;
  nonContactables: number;
  /** enrichies / collectées. */
  pctEnrichies: number;
  /** exploitables / collectées — le taux de succès « contact exploitable ». */
  pctExploitable: number;
}

export interface ContactGroupRow {
  key: string | null;
  contactabilite: string | null;
  count: number;
}
export interface EnrichedGroupRow {
  key: string | null;
  count: number;
}

export function aggregateActivity(
  contactRows: ReadonlyArray<ContactGroupRow>,
  enrichedRows: ReadonlyArray<EnrichedGroupRow>,
  labelOf: (key: string) => string,
): ActivityRow[] {
  const map = new Map<string, ActivityRow>();
  const get = (k: string): ActivityRow => {
    let row = map.get(k);
    if (!row) {
      row = {
        key: k,
        label: k,
        collectees: 0,
        enrichies: 0,
        exploitables: 0,
        partiels: 0,
        nonContactables: 0,
        pctEnrichies: 0,
        pctExploitable: 0,
      };
      map.set(k, row);
    }
    return row;
  };

  for (const r of contactRows) {
    if (!r.key) continue;
    const row = get(r.key);
    row.collectees += r.count;
    if (r.contactabilite === "exploitable") row.exploitables += r.count;
    else if (r.contactabilite === "partiel") row.partiels += r.count;
    else row.nonContactables += r.count; // non_contactable OU null
  }
  for (const r of enrichedRows) {
    if (r.key) get(r.key).enrichies += r.count;
  }

  const rows = [...map.values()];
  for (const row of rows) {
    row.pctExploitable = row.collectees > 0 ? row.exploitables / row.collectees : 0;
    row.pctEnrichies = row.collectees > 0 ? row.enrichies / row.collectees : 0;
    row.label = labelOf(row.key);
  }
  return rows.sort((a, b) => b.collectees - a.collectees);
}
