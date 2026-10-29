/**
 * Montants HT et TTC pour la fiche client (lot 0). TVA = `TAUX_TVA_STANDARD`, jamais d'exonération.
 */

import { TAUX_TVA_STANDARD } from "@/server/qualiopi/legal/tva";

const FORMAT_ENTIER = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const FORMAT_CENTIMES = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Deux décimales dès qu'il y a des centimes (« 10,50 », jamais « 10,5 »), aucune sinon. */
function euros(cents: number): string {
  // Séparateur de milliers : espace insécable (U+00A0), quelle que soit la version d'ICU.
  return (cents % 100 === 0 ? FORMAT_ENTIER : FORMAT_CENTIMES)
    .format(cents / 100)
    .replace(/[\u202f\u00a0]/g, "\u00a0");
}

/** `120000` donne « 1 200 € HT » et « 1 440 € TTC » (espaces insécables), TTC arrondi au centime. */
export function htEtTtc(htCents: number): { ht: string; ttc: string } {
  const ttcCents = Math.round((htCents * (100 + TAUX_TVA_STANDARD)) / 100);
  return { ht: `${euros(htCents)}\u00a0€\u00a0HT`, ttc: `${euros(ttcCents)}\u00a0€\u00a0TTC` };
}
