/**
 * LISTES FERMÉES de `version_texte` et `utm_campaign` (ADR contrat v3, I6 : « limités à une
 * liste connue »). Une simple regex laisserait passer un pseudo (`jean_dupont_75`) : seules les
 * valeurs déclarées ICI sont acceptées. Ajouter une valeur = une ligne dans ce module (lecteurs
 * d'abord, comme le dictionnaire) ; en retirer une est interdit tant qu'un texte la porte encore.
 */

/** Versions connues du texte du premier message privé (M1) — preuve d'information. */
/**
 * LISTE FERMÉE : on AJOUTE, on ne retire jamais (un texte déjà envoyé peut encore la porter).
 * Les `mp-m1-*` sont les numéros du Studio (dictionnaire-textes-mp.v2.json) ; `mp-m1-v3` est le
 * message avec lien. Chaque valeur respecte le format CRM `^[A-Za-z0-9._-]{3,64}$`.
 */
export const VERSIONS_TEXTE_CONNUES = [
  "m1-brouillon-v1",
  "m1-v1",
  "mp-m1-v2",
  "mp-m1-v2-a",
  "mp-m1-v2-b",
  "mp-m1-v2-c",
  "mp-m1-v2-d",
  "mp-m1-v2-e",
  "mp-m1-v3",
  "mp-m1-v4-1",
  "mp-m1-v4-2",
  "mp-m1-v4-3",
  "mp-m1-v4-4",
  "mp-m1-v5-1",
  "mp-m1-v5-2",
  "mp-m1-v5-3",
  "mp-m1-v5-4",
] as const;

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
