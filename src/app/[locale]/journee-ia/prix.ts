// Le prix de la Journée IA, lu dans `pricing.ts` : la page n'écrit aucun montant.

import { JOURNEE_IA_TIER, formatTierPrice } from "@/content/pricing";
import { remplacerJetons } from "@/content/journee-ia-commun";

/** « 1 490 € HT » — jamais écrit à la main. */
export function prixDeLaJournee(locale: "fr" | "en" = "fr"): string {
  return formatTierPrice(JOURNEE_IA_TIER, locale);
}

/** Remplace les jetons d'un texte (prix, gain de l'exemple…) par leur valeur lue ou calculée. */
export function remplacerLePrix(texte: string): string {
  return remplacerJetons(texte);
}
