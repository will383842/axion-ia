/**
 * Prospection — Génération d'export segmenté + re-filtre RGPD (T8, pur).
 *
 * Combine la segmentation (exploitables/partiels/à-compléter) et le re-filtre
 * opt-out/non-diffusible AU MOMENT de générer (05-CONFORMITE §6 point 3). Une
 * entreprise exclue (opt-out arrivé après collecte, non-diffusible) n'apparaît
 * dans AUCUN fichier (matrice #4/#5). Pur → testable sans DB ni FS.
 */

import {
  buildCsv,
  segmentOfContactabilite,
  type ExportCompanyRow,
  type ExportSegment,
} from "./segment";
import {
  exportExclusionReason,
  type SuppressionSets,
  type ExclusionReason,
} from "@/server/prospection/rgpd/export-filter";

export interface SegmentedExport {
  exploitables: string;
  partiels: string;
  aCompleter: string;
  counts: Record<ExportSegment, number>;
  excluded: number;
  excludedByReason: Record<string, number>;
}

/** Ligne d'export enrichie des champs nécessaires au re-filtre RGPD. */
export interface ExportRowWithRgpd extends ExportCompanyRow {
  statutDiffusion: string | null;
  optOut: boolean;
  emails: string[];
}

/**
 * Génère les 3 fichiers CSV segmentés, en EXCLUANT les entreprises opposées /
 * non-diffusibles (re-filtre live). Retourne aussi les compteurs d'exclusion.
 */
export function buildSegmentedExport(
  rows: ReadonlyArray<ExportRowWithRgpd>,
  suppressions: SuppressionSets,
): SegmentedExport {
  const buckets: Record<ExportSegment, ExportCompanyRow[]> = {
    exploitables: [],
    partiels: [],
    a_completer: [],
  };
  let excluded = 0;
  const excludedByReason: Record<string, number> = {};

  for (const row of rows) {
    const reason: ExclusionReason = exportExclusionReason(
      {
        siren: row.siren,
        statutDiffusion: row.statutDiffusion,
        optOut: row.optOut,
        emails: row.emails,
      },
      suppressions,
    );
    if (reason) {
      excluded++;
      excludedByReason[reason] = (excludedByReason[reason] ?? 0) + 1;
      continue;
    }
    buckets[segmentOfContactabilite(row.contactabilite)].push(row);
  }

  return {
    exploitables: buildCsv(buckets.exploitables),
    partiels: buildCsv(buckets.partiels),
    aCompleter: buildCsv(buckets.a_completer),
    counts: {
      exploitables: buckets.exploitables.length,
      partiels: buckets.partiels.length,
      a_completer: buckets.a_completer.length,
    },
    excluded,
    excludedByReason,
  };
}
