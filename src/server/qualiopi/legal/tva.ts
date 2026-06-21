/**
 * Qualiopi — Régime de TVA des factures (module PUR, testable sans infra).
 *
 * ⚠️ Qualiopi n'a AUCUN effet sur la TVA. Le régime dépend du statut fiscal de
 * l'OF, configurable (et évolutif dans le temps) via SiteSetting `regime_tva` :
 *
 *  - `assujetti`       : TVA au taux standard (20 %) — DÉFAUT légalement sûr.
 *                        S'applique tant qu'aucune exonération/franchise n'est
 *                        acquise, y compris sur les formations, y compris via
 *                        OPCO/CPF (le financeur ne change pas le régime TVA).
 *  - `exoneration_261` : exonération « formation professionnelle continue »
 *                        (art. 261-4-4° CGI) — NÉCESSITE l'attestation DREETS
 *                        (Cerfa 3511) + NDA + BPF à jour. Couvre UNIQUEMENT les
 *                        actions de FPC : les lignes de conseil/audit/site web
 *                        restent à 20 % (override `tauxTvaPercent` par ligne).
 *  - `franchise_293b`  : franchise en base (art. 293 B CGI), sous les seuils de
 *                        CA (37 500 € services en 2026) — tout à 0 %, mention
 *                        « TVA non applicable, art. 293 B du CGI ».
 *
 * Les factures déjà émises figent leur régime (instantané) ; seules les
 * nouvelles factures suivent le régime courant de la config.
 *
 * Montants en CENTIMES d'euro (pas de flottant).
 */

import { LEGAL_MENTIONS } from "./legal-mentions";

export type RegimeTva = "assujetti" | "exoneration_261" | "franchise_293b";

export const REGIMES_TVA: readonly RegimeTva[] = [
  "assujetti",
  "exoneration_261",
  "franchise_293b",
] as const;

/** Régime par défaut : assujetti (jamais omettre par erreur une TVA due). */
export const REGIME_TVA_DEFAUT: RegimeTva = "assujetti";

/** Taux standard de TVA en France métropolitaine (%). */
export const TAUX_TVA_STANDARD = 20;

/** Libellés humains (config admin / UI). */
export const REGIME_TVA_LABELS: Record<RegimeTva, string> = {
  assujetti: "Assujetti à la TVA (taux standard 20 %)",
  exoneration_261: "Exonération formation professionnelle (art. 261-4-4° CGI)",
  franchise_293b: "Franchise en base de TVA (art. 293 B CGI)",
};

/** `true` si la valeur est un régime TVA connu. */
export function isRegimeTva(value: unknown): value is RegimeTva {
  return typeof value === "string" && (REGIMES_TVA as readonly string[]).includes(value);
}

/**
 * Taux de TVA applicable à une ligne (%). Un `tauxTvaPercent` explicite sur la
 * ligne PRIME toujours (factures mixtes : formation 0 % + conseil 20 %). Sinon,
 * dérivé du régime : assujetti → taux standard, exonération/franchise → 0 %.
 */
export function tauxTvaLigne(
  regime: RegimeTva,
  ligne: { tauxTvaPercent?: number },
  tauxStandard: number = TAUX_TVA_STANDARD,
): number {
  if (typeof ligne.tauxTvaPercent === "number" && Number.isFinite(ligne.tauxTvaPercent)) {
    return Math.max(0, ligne.tauxTvaPercent);
  }
  switch (regime) {
    case "assujetti":
      return tauxStandard;
    case "exoneration_261":
    case "franchise_293b":
      return 0;
  }
}

export interface LigneFacturable {
  quantite: number;
  prixUnitaireHtCents: number;
  /** Override du taux TVA de la ligne (%). Sinon dérivé du régime. */
  tauxTvaPercent?: number;
}

/** Ventilation de la TVA par taux (une entrée par taux distinct présent). */
export interface VentilationTva {
  tauxPercent: number;
  baseHtCents: number;
  montantTvaCents: number;
}

export interface TotauxFacture {
  totalHtCents: number;
  ventilation: VentilationTva[];
  totalTvaCents: number;
  totalTtcCents: number;
}

/**
 * Calcule les totaux d'une facture : total HT, ventilation de la TVA par taux
 * (base + montant), total TVA et total TTC. La TVA est calculée par GROUPE de
 * taux (somme des bases puis application du taux) — méthode standard.
 */
export function computeTotauxFacture(
  lignes: readonly LigneFacturable[],
  regime: RegimeTva,
  tauxStandard: number = TAUX_TVA_STANDARD,
): TotauxFacture {
  const baseParTaux = new Map<number, number>();
  let totalHtCents = 0;

  for (const ligne of lignes) {
    const htLigne = Math.round(ligne.quantite * ligne.prixUnitaireHtCents);
    totalHtCents += htLigne;
    const taux = tauxTvaLigne(regime, ligne, tauxStandard);
    baseParTaux.set(taux, (baseParTaux.get(taux) ?? 0) + htLigne);
  }

  const ventilation: VentilationTva[] = [...baseParTaux.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tauxPercent, baseHtCents]) => ({
      tauxPercent,
      baseHtCents,
      montantTvaCents: Math.round((baseHtCents * tauxPercent) / 100),
    }));

  const totalTvaCents = ventilation.reduce((sum, v) => sum + v.montantTvaCents, 0);

  return {
    totalHtCents,
    ventilation,
    totalTvaCents,
    totalTtcCents: totalHtCents + totalTvaCents,
  };
}

/**
 * Clé de la mention légale TVA à afficher selon le régime, ou `null` pour le
 * régime assujetti standard (aucune mention d'exonération/franchise).
 */
export function mentionTvaKey(
  regime: RegimeTva,
): "factureExonerationTva" | "factureFranchiseTva" | null {
  switch (regime) {
    case "exoneration_261":
      return "factureExonerationTva";
    case "franchise_293b":
      return "factureFranchiseTva";
    case "assujetti":
      return null;
  }
}

/** Mention légale TVA (texte) à afficher selon le régime, ou `null`. */
export function mentionTva(regime: RegimeTva): string | null {
  const key = mentionTvaKey(regime);
  return key ? LEGAL_MENTIONS[key] : null;
}
