// Titre et description de la page « La Journée IA » (hors de page.tsx : une page
// Next ne peut exporter que ses propres noms réservés). Le prix est lu dans
// pricing.ts, jamais écrit ici.
import { JOURNEE_IA_TIER, formatAmount } from "@/content/pricing";

/**
 * Prix HT de la Journée IA, lu dans pricing.ts. Lève une erreur claire si le
 * champ a disparu ou n'est pas un nombre fini > 0 : mieux vaut un build rouge
 * qu'un « 0 € HT » publié (page et JSON-LD) sans aucun signal.
 */
export function prixJourneeIa(priceFlat: unknown): number {
  if (typeof priceFlat !== "number" || !Number.isFinite(priceFlat) || priceFlat <= 0) {
    throw new Error(
      `JOURNEE_IA_TIER.priceFlat doit être un nombre fini > 0 (reçu : ${String(priceFlat)})`,
    );
  }
  return priceFlat;
}

/** Titre : au plus 60 caractères (testé). */
export function titrePage(): string {
  return `La Journée IA · ${formatAmount(prixJourneeIa(JOURNEE_IA_TIER.priceFlat), "fr", { compact: true })} · dans votre entreprise · Axion-IA`;
}

/** Description : au plus 158 caractères (testé). */
export const DESCRIPTION =
  "Une journée chez vous : nous chiffrons le temps perdu avec vos équipes et vous repartez avec un rapport et un plan d’action sur 90 jours.";
