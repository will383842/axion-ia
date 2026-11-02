/**
 * LISTES FERMÉES de `version_texte` et `utm_campaign` (ADR contrat v3, I6 : « limités à une
 * liste connue »). Une simple regex laisserait passer un pseudo (`jean_dupont_75`) : seules les
 * valeurs déclarées ICI sont acceptées. Ajouter une valeur = une ligne dans ce module (lecteurs
 * d'abord, comme le dictionnaire) ; en retirer une est interdit tant qu'un texte la porte encore.
 */

/** Versions connues du texte du premier message privé (M1) — preuve d'information. */
export const VERSIONS_TEXTE_CONNUES = ["m1-brouillon-v1", "m1-v1"] as const;

/** Campagnes connues : alignées sur les familles du dictionnaire d'origine. */
export const CAMPAGNES_UTM_CONNUES = [
  "guide_reseau",
  "cas_concret",
  "carrousel",
  "video",
  "tour_france_ia",
  "autre",
] as const;

export type VersionTexteConnue = (typeof VERSIONS_TEXTE_CONNUES)[number];
export type CampagneUtmConnue = (typeof CAMPAGNES_UTM_CONNUES)[number];
