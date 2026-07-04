// SSOT — Dérivation de la taille d'entreprise (TPE / PME / ETI / GE).
//
// Module Prospection (T1). Les sources gratuites ne donnent que l'EFFECTIF
// (tranche INSEE), pas le CA/bilan → approximation documentée par effectif
// (décret 2008-1354 approché), recoupée avec `categorieEntreprise` INSEE quand
// présente. Bornes (cf. 01-DATA-MODEL) : TPE < 10 · PME 10-249 · ETI 250-4999 ·
// GE ≥ 5000. Pur, aucune dépendance runtime.

import type { Taille, TailleSource, CategorieEntreprise } from "./enums";

/** Bornes officielles (nb de salariés) — source de vérité des mappings ci-dessous. */
export const TAILLE_BORNES: Record<Taille, { minInclus: number; maxInclus: number }> = {
  TPE: { minInclus: 0, maxInclus: 9 },
  PME: { minInclus: 10, maxInclus: 249 },
  ETI: { minInclus: 250, maxInclus: 4999 },
  GE: { minInclus: 5000, maxInclus: Number.POSITIVE_INFINITY },
};

// Tranches d'effectif INSEE (code → intervalle de salariés). `null` max = borne haute ouverte.
const TRANCHE_EFFECTIF: Record<string, { min: number; max: number }> = {
  "00": { min: 0, max: 0 }, // 0 salarié
  "01": { min: 1, max: 2 },
  "02": { min: 3, max: 5 },
  "03": { min: 6, max: 9 },
  "11": { min: 10, max: 19 },
  "12": { min: 20, max: 49 },
  "21": { min: 50, max: 99 },
  "22": { min: 100, max: 199 },
  "31": { min: 200, max: 249 },
  "32": { min: 250, max: 499 },
  "41": { min: 500, max: 999 },
  "42": { min: 1000, max: 1999 },
  "51": { min: 2000, max: 4999 },
  "52": { min: 5000, max: 9999 },
  "53": { min: 10000, max: Number.POSITIVE_INFINITY },
};

/** Effectif (nb salariés) → taille. Utilise la borne INFÉRIEURE des bornes officielles. */
export function tailleFromEffectif(effectif: number): Taille {
  if (effectif >= TAILLE_BORNES.GE.minInclus) return "GE";
  if (effectif >= TAILLE_BORNES.ETI.minInclus) return "ETI";
  if (effectif >= TAILLE_BORNES.PME.minInclus) return "PME";
  return "TPE";
}

/**
 * Code tranche INSEE → taille. Retourne `null` si le code est inconnu / non
 * renseigné (`NN`, `""`, `undefined`) — on ne devine pas une taille.
 * La borne BASSE de la tranche décide (une tranche ne chevauche jamais 2 tailles
 * dans le découpage INSEE, mais on borne par min pour être déterministe).
 */
export function tailleFromTranche(code: string | null | undefined): Taille | null {
  if (!code) return null;
  const range = TRANCHE_EFFECTIF[code.trim()];
  if (!range) return null;
  return tailleFromEffectif(range.min);
}

/** Catégorie entreprise INSEE brute → taille (PME ne distingue pas TPE). */
export function tailleFromCategorieInsee(
  cat: CategorieEntreprise | null | undefined,
): Taille | null {
  if (cat === "GE") return "GE";
  if (cat === "ETI") return "ETI";
  if (cat === "PME") return "PME";
  return null;
}

/**
 * Dérivation finale + provenance. Priorité à l'effectif (seul à distinguer TPE) ;
 * repli sur la catégorie INSEE. Retourne `null` si aucune source exploitable.
 */
export function deriveTaille(input: {
  trancheEffectif?: string | null;
  categorieEntreprise?: CategorieEntreprise | null;
}): { taille: Taille; source: TailleSource } | null {
  const parEffectif = tailleFromTranche(input.trancheEffectif);
  if (parEffectif) return { taille: parEffectif, source: "effectif" };
  const parCategorie = tailleFromCategorieInsee(input.categorieEntreprise);
  if (parCategorie) return { taille: parCategorie, source: "categorie_insee" };
  return null;
}

/** Vrai si le code tranche INSEE est connu. */
export function isKnownTranche(code: string | null | undefined): boolean {
  return !!code && code.trim() in TRANCHE_EFFECTIF;
}
