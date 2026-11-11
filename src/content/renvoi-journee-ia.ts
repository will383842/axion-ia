// Renvoi vers La Journée IA — le bloc commun des pages qui se concurrençaient sur
// « audit / formation IA » (audit SEO/GEO du 11/11/2026) : `/audit`,
// `/formations/ia-pour-bien-commencer-journee` et `/tarifs`.
//
// Décision de Williams : le point de départ recommandé est La Journée IA. Les
// autres pages restent en ligne, alignées sur elle, et y renvoient.
//
// 🔑 Ce module ne garde que les libellés propres au bloc. Le chemin, le déroulé,
// le rapport, la garantie, sa condition et le lien de diagnostic viennent de
// `journee-ia-commun.ts` ; le prix est le jeton `JETON_PRIX`, résolu depuis
// `pricing.ts`. Aucun montant n'est écrit ici.

import {
  CONDITION_GARANTIE,
  DEROULE_JOURNEE_IA,
  GARANTIE_PHRASE,
  JETON_PRIX,
  RAPPORT_COMPLET,
  remplacerJetons,
} from "@/content/journee-ia-commun";

/** L'ancre du lien : descriptive, jamais « en savoir plus ». */
export const ANCRE_JOURNEE_IA = "Découvrir La Journée IA : audit et formation dans vos locaux";

export const SURTITRE_RENVOI = "Le point de départ que nous recommandons";

export const TITRE_RENVOI = "Commencez par La Journée IA";

/** Le libellé du bouton de rendez-vous. */
export const LIBELLE_RENDEZ_VOUS_RENVOI = "Prendre rendez-vous";

/** La phrase de prix du bloc : le jeton, résolu depuis `pricing.ts`. */
export function phrasePrixJourneeIa(): string {
  return remplacerJetons(`Prix unique : ${JETON_PRIX}.`);
}

/** Tout le texte du bloc, à plat (pour les tests de mots interdits). */
export function texteDuRenvoi(precision?: string): string {
  return [
    SURTITRE_RENVOI,
    TITRE_RENVOI,
    DEROULE_JOURNEE_IA,
    phrasePrixJourneeIa(),
    RAPPORT_COMPLET,
    GARANTIE_PHRASE,
    CONDITION_GARANTIE,
    precision ?? "",
    ANCRE_JOURNEE_IA,
    LIBELLE_RENDEZ_VOUS_RENVOI,
  ].join("\n");
}
