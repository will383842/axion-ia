/**
 * Mentions légales FIGÉES des gabarits archivés.
 *
 * ⛔ NE JAMAIS MODIFIER CE FICHIER. Ces chaînes sont celles que portaient les
 * pièces au moment de leur signature — y compris quand elles sont juridiquement
 * inexactes (L.6353-2 abrogé depuis le 01/01/2019). Les corriger ici réécrirait
 * rétroactivement l'exemplaire signé de pièces déjà signées : c'est exactement
 * ce que l'archivage existe pour empêcher.
 *
 * Les gabarits archivés importent d'ici, et non de `legal-mentions.ts`, parce
 * que ce module-là est VIVANT : il a été corrigé le 2026-09-30 et le sera
 * encore. Un gabarit figé qui lirait une mention vivante ne serait figé qu'en
 * apparence.
 */

export const LEGAL_MENTIONS = {
  /** Texte imprimé par `convention` v2 et `convention_tripartite` v2. */
  convention: "Établie conformément aux articles L.6353-1 et L.6353-2 du Code du travail.",
  /** Texte imprimé par `contrat_formation` v1. */
  contratParticulier: "Établi conformément aux articles L.6353-3 à L.6353-7 du Code du travail.",
} as const;

/** Durée imprimée par `releve_connexion` v1. */
export const DOCUMENT_RETENTION_YEARS = 5 as const;
