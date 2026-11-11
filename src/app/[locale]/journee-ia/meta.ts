// Titre et description de la page « La Journée IA » (hors de page.tsx : une page
// Next ne peut exporter que ses propres noms réservés). Le prix est lu dans
// pricing.ts, jamais écrit ici.
import { JOURNEE_IA_TIER, formatAmount } from "@/content/pricing";

/** Titre : au plus 60 caractères (testé). */
export function titrePage(): string {
  return `La Journée IA · ${formatAmount(JOURNEE_IA_TIER.priceFlat ?? 0, "fr", { compact: true })} · dans votre entreprise · Axion-IA`;
}

/** Description : au plus 158 caractères (testé). */
export const DESCRIPTION =
  "Une journée chez vous : nous chiffrons le temps perdu avec vos équipes et vous repartez avec un rapport et un plan d’action sur 90 jours.";
