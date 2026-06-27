// Config de maillage des pages détail UN-À-UN (module coaching-1-to-1).
// Calqué sur implementation-subpages.ts / interventions-subpages.ts : sépare la
// donnée de maillage (pages sœurs suggérées) des templates. Consommé par
// UnAUnSubPageExtras, câblé dans IndividualCoachingPage + InterventionDetailPage.
//
// Périmètre = les 6 pages détail 1-to-1 (2 coaching individuel rendues par
// IndividualCoachingPage + 4 dirigeant/Claude rendues par InterventionDetailPage).
// AUCUN prix (les tarifs restent dans pricing.ts). FR canonique + miroir EN.
//
// Les `href` sont DÉRIVÉS du SSOT taxonomie via coaching-1to1 (WS7b) : la clé
// FR canonique est résolue par `coachingFormatPath(slug, "fr")` (locale figée à
// "fr" car next-intl résout l'EN lui-même via <Link>), au lieu d'être tapée en
// dur — un changement de path dans la taxonomie ne peut plus laisser ces liens
// périmés.

import { coachingFormatPath } from "@/content/coaching-1to1";

/** Les 2 slugs de pages détail un-à-un (formats Claude retirés le 2026-06-13). */
export type UnAUnDetailSlug = "coaching-decouverte" | "dirigeant-vision-strategique";

interface UnAUnPageMeta {
  /** Clé canonique FR (routing.pathnames) — next-intl résout l'EN via <Link>. */
  href: string;
  labelFr: string;
  labelEn: string;
  /** Accroche courte distincte (anti-doorway), prospect-friendly, 0 prix. */
  descFr: string;
  descEn: string;
}

/** Métadonnées de maillage des 6 pages détail un-à-un. */
export const UN_A_UN_PAGES: Record<UnAUnDetailSlug, UnAUnPageMeta> = {
  "coaching-decouverte": {
    href: coachingFormatPath("coaching-decouverte", "fr"),
    labelFr: "Collaborateur · Optimisation du poste",
    labelEn: "Team member · Workstation optimization",
    descFr:
      "Une journée sur le poste : cartographie du fonctionnement actuel et identification de ce qu'on peut automatiser pour gagner du temps.",
    descEn:
      "A day at the workstation: mapping the current workflow and identifying what can be automated to save time.",
  },
  "dirigeant-vision-strategique": {
    href: coachingFormatPath("dirigeant-vision-strategique", "fr"),
    labelFr: "Dirigeant · Vision stratégique",
    labelEn: "Executive · Strategic vision",
    descFr:
      "Un déclic sur les opportunités IA de votre marché — pas un audit, une vision claire à 12-24 mois.",
    descEn:
      "A trigger on the AI opportunities in your market — not an audit, a clear 12-24 month vision.",
  },
};

/**
 * Pages suggérées (maillage interne « Voir aussi »). 3 sœurs par page, ordre
 * distinct pour éviter le maillage strictement uniforme. Le 4ᵉ lien
 * (cross-module « commencer par un audit ») est ajouté par le composant.
 */
export const UN_A_UN_RELATED: Record<UnAUnDetailSlug, UnAUnDetailSlug[]> = {
  "coaching-decouverte": ["dirigeant-vision-strategique"],
  "dirigeant-vision-strategique": ["coaching-decouverte"],
};
