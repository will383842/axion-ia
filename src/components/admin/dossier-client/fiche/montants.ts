/**
 * Montants HT et TTC pour la fiche client (lot 0). TVA = `TAUX_TVA_STANDARD`, jamais d'exonération.
 */

import { TAUX_TVA_STANDARD } from "@/server/qualiopi/legal/tva";

const FORMAT = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

function euros(cents: number): string {
  return FORMAT.format(cents / 100);
}

/** `120000` donne « 1 200 € HT » et « 1 440 € TTC » (espaces insécables), TTC arrondi au centime. */
export function htEtTtc(htCents: number): { ht: string; ttc: string } {
  const ttcCents = Math.round((htCents * (100 + TAUX_TVA_STANDARD)) / 100);
  return { ht: `${euros(htCents)} € HT`, ttc: `${euros(ttcCents)} € TTC` };
}
