// Renvoi vers La Journée IA — le bloc commun des pages qui se concurrençaient sur
// « audit / formation IA » (audit SEO/GEO du 11/11/2026) : `/audit`,
// `/formations/ia-pour-bien-commencer-journee` et `/tarifs`.
//
// Décision de Williams : le point de départ recommandé est La Journée IA (audit
// de 2 à 4 h le matin, 4 h de formation l'après-midi, dans vos locaux, prix
// unique, rapport complet sous 3 jours ouvrés, attestation de formation
// nominative, garantie « 3 fois le prix »). Les autres pages restent en ligne,
// alignées sur elle, et y renvoient.
//
// 🔑 Aucun montant n'est écrit ici : le prix vient de `pricing.ts`
// (`JOURNEE_IA_TIER`), la garantie et sa condition de `journee-ia-commun.ts`,
// mot pour mot.

import { JOURNEE_IA_TIER, formatTierPrice } from "@/content/pricing";
import { CONDITION_GARANTIE, GARANTIE_PHRASE } from "@/content/journee-ia-commun";

/** Le chemin de la landing (préfixé par la locale au rendu : `/fr/journee-ia`). */
export const CHEMIN_JOURNEE_IA = "/journee-ia";

/** L'ancre du lien : descriptive, jamais « en savoir plus ». */
export const ANCRE_JOURNEE_IA = "Découvrir La Journée IA : audit et formation dans vos locaux";

export const SURTITRE_RENVOI = "Le point de départ que nous recommandons";

export const TITRE_RENVOI = "Commencez par La Journée IA";

/** Le déroulé, dans les mots de la landing. */
export const DEROULE_JOURNEE_IA =
  "Le matin, 2 à 4 h d’audit dans vos locaux. L’après-midi, 4 h de formation de vos équipes sur leurs propres dossiers, avec une attestation de formation nominative pour chaque participant.";

/** Le délai du rapport : 3 jours ouvrés (décision de Williams), jamais un autre. */
export const RAPPORT_JOURNEE_IA =
  "Votre rapport complet arrive sous 3 jours ouvrés après la journée.";

/** La garantie et sa condition, reprises telles quelles. */
export const GARANTIE_RENVOI = GARANTIE_PHRASE;
export const CONDITION_RENVOI = CONDITION_GARANTIE;

/** Le libellé du bouton de rendez-vous. */
export const LIBELLE_RENDEZ_VOUS_RENVOI = "Prendre rendez-vous";

/** Le seul prix public : celui de La Journée IA, lu dans `pricing.ts`. */
export function prixJourneeIa(): string {
  return formatTierPrice(JOURNEE_IA_TIER, "fr");
}

/** La phrase de prix du bloc. */
export function phrasePrixJourneeIa(): string {
  return `Prix unique : ${prixJourneeIa()}.`;
}

/**
 * Le lien de rendez-vous, avec l'emplacement cliqué (`depuis`), recopié par
 * `/appel` dans `utm_content`.
 */
export function lienRendezVousJourneeIa(depuis: string): string {
  return `/appel?rdv=diagnostic&depuis=${encodeURIComponent(depuis)}`;
}

/** Tout le texte du bloc, à plat (pour les tests de mots interdits). */
export function texteDuRenvoi(precision?: string): string {
  return [
    SURTITRE_RENVOI,
    TITRE_RENVOI,
    DEROULE_JOURNEE_IA,
    phrasePrixJourneeIa(),
    RAPPORT_JOURNEE_IA,
    GARANTIE_RENVOI,
    CONDITION_RENVOI,
    precision ?? "",
    ANCRE_JOURNEE_IA,
    LIBELLE_RENDEZ_VOUS_RENVOI,
  ].join("\n");
}
