// Le prix de la Journée IA, lu dans `pricing.ts` : la page n'écrit aucun montant.

import { JOURNEE_IA_TIER, formatTierPrice } from "@/content/pricing";
import { JETON_PRIX } from "./contenu";

/** « 1 490 € HT » — jamais écrit à la main. */
export function prixDeLaJournee(locale: "fr" | "en" = "fr"): string {
  return formatTierPrice(JOURNEE_IA_TIER, locale);
}

/** Remplace le jeton de prix d'un texte par le prix lu dans `pricing.ts`. */
export function remplacerLePrix(texte: string): string {
  return texte.replaceAll(JETON_PRIX, prixDeLaJournee("fr"));
}
