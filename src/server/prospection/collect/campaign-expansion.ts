/**
 * Prospection — Expansion d'une campagne en cellules de couverture (T4, pur).
 *
 * Une campagne cible des `secteurs[]` et/ou `nafCodes[]` × `departements[]` ×
 * `tailles[]`. On DÉTEND toujours en codes NAF (01-DATA-MODEL §CoverageCell :
 * identité de cellule au niveau NAF). Les cellules sont créées **paresseusement**
 * à partir du dénominateur `StockReference` : uniquement les triplets réellement
 * peuplés (`stockAttendu > 0`) → évite ~1 M de cellules fantômes.
 */

import type { Secteur, Taille, CellStatut } from "@/lib/prospection/enums";
import {
  nafPrefixesForSecteurs,
  nafDigits,
  secteurFromNaf,
} from "@/lib/prospection/naf-to-secteur";
import { regionOfDepartement } from "@/lib/prospection/departement-to-region";

export interface CampaignTargeting {
  departements: string[];
  secteurs: Secteur[];
  nafCodes: string[];
  tailles: Taille[];
  /** Mode « tout le département » : ignore le filtre secteur/NAF (tous secteurs). */
  toutesActivites?: boolean;
}

/** Dénombrement StockReference (une ligne = triplet dép×naf×taille peuplé). */
export interface StockRefRow {
  departement: string;
  naf: string;
  taille: Taille;
  stockAttendu: number;
}

export interface CoverageCellSpec {
  departement: string;
  region: string;
  naf: string;
  secteur: Secteur;
  taille: Taille;
  attendu: number;
}

/**
 * Préfixes NAF ciblés par la campagne : union des préfixes des secteurs + les
 * codes NAF explicites (normalisés en chiffres pour le préfixe-match).
 */
export function campaignNafPrefixes(t: CampaignTargeting): string[] {
  const set = new Set<string>(nafPrefixesForSecteurs(t.secteurs));
  for (const code of t.nafCodes) {
    const d = nafDigits(code);
    if (d.length >= 2) set.add(d);
  }
  return [...set];
}

/** Vrai si le code NAF (complet) matche l'un des préfixes ciblés. */
export function nafMatchesPrefixes(naf: string, prefixes: readonly string[]): boolean {
  const d = nafDigits(naf);
  return prefixes.some((p) => d.startsWith(p));
}

/**
 * Détend une campagne en cellules à partir des lignes `StockReference`
 * pré-filtrées (dép ∈ departements, taille ∈ tailles). Ne garde que les lignes
 * dont le NAF matche les préfixes ciblés ET `stockAttendu > 0`.
 */
export function cellsFromStockRefs(
  t: CampaignTargeting,
  refs: readonly StockRefRow[],
): CoverageCellSpec[] {
  // Mode « tout le département » : aucun filtre secteur/NAF (toutes activités).
  const prefixes = t.toutesActivites ? [] : campaignNafPrefixes(t);
  const tailles = new Set(t.tailles);
  const deps = new Set(t.departements);
  const cells: CoverageCellSpec[] = [];
  for (const r of refs) {
    if (r.stockAttendu <= 0) continue;
    if (!deps.has(r.departement)) continue;
    if (!tailles.has(r.taille)) continue;
    if (prefixes.length > 0 && !nafMatchesPrefixes(r.naf, prefixes)) continue;
    cells.push({
      departement: r.departement,
      region: regionOfDepartement(r.departement),
      naf: r.naf,
      secteur: secteurFromNaf(r.naf),
      taille: r.taille,
      attendu: r.stockAttendu,
    });
  }
  return cells;
}

/**
 * Décide le statut d'une cellule après collecte (matrice T4 « exhaustivité ») :
 * `collecte ≥ attendu` (moins une tolérance pour cessations concurrentes) →
 * `fait`, sinon `erreur` (jamais `fait` sur une cellule tronquée).
 */
export function decideCellOutcome(
  collecte: number,
  attendu: number,
  toleranceRatio = 0,
): CellStatut {
  const seuil = Math.floor(attendu * (1 - toleranceRatio));
  return collecte >= seuil ? "fait" : "erreur";
}
