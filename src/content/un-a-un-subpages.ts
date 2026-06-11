// Config de maillage des pages détail UN-À-UN (module coaching-1-to-1).
// Calqué sur implementation-subpages.ts / interventions-subpages.ts : sépare la
// donnée de maillage (pages sœurs suggérées) des templates. Consommé par
// UnAUnSubPageExtras, câblé dans IndividualCoachingPage + InterventionDetailPage.
//
// Périmètre = les 6 pages détail 1-to-1 (2 coaching individuel rendues par
// IndividualCoachingPage + 4 dirigeant/Claude rendues par InterventionDetailPage).
// AUCUN prix (les tarifs restent dans pricing.ts). FR canonique + miroir EN.

/** Les 6 slugs de pages détail un-à-un. */
export type UnAUnDetailSlug =
  | "coaching-decouverte"
  | "dirigeant-vision-strategique"
  | "claude-dirigeant"
  | "claude-implementation-individuel";

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
    href: "/interventions/coaching-decouverte",
    labelFr: "Coaching Découverte",
    labelEn: "Discovery coaching",
    descFr:
      "Une journée pour démarrer : prise en main des outils et 3 à 5 méthodes applicables dès le lendemain.",
    descEn:
      "A day to get started: hands-on with the tools and 3 to 5 methods you can apply the next day.",
  },
  "dirigeant-vision-strategique": {
    href: "/interventions/dirigeant-vision-strategique",
    labelFr: "Dirigeant · Vision stratégique",
    labelEn: "Executive · Strategic vision",
    descFr:
      "Un déclic sur les opportunités IA de votre marché — pas un audit, une vision claire à 12-24 mois.",
    descEn:
      "A trigger on the AI opportunities in your market — not an audit, a clear 12-24 month vision.",
  },
  "claude-dirigeant": {
    href: "/interventions/claude-dirigeant",
    labelFr: "Dirigeant · Maîtrise Claude",
    labelEn: "Executive · Claude mastery",
    descFr:
      "Maîtriser Claude pour vos dossiers stratégiques confidentiels : Chat, Projects et ligne de commande.",
    descEn: "Master Claude for your confidential strategic files: Chat, Projects and command line.",
  },
  "claude-implementation-individuel": {
    href: "/interventions/claude-implementation-individuel",
    labelFr: "Claude installé · Individuel",
    labelEn: "Claude installed · Individual",
    descFr:
      "Claude installé et opérationnel sur votre poste en une journée, adapté à vos vrais cas d'usage.",
    descEn:
      "Claude installed and operational on your workstation in a day, tailored to your real use cases.",
  },
};

/**
 * Pages suggérées (maillage interne « Voir aussi »). 3 sœurs par page, ordre
 * distinct pour éviter le maillage strictement uniforme. Le 4ᵉ lien
 * (cross-module « commencer par un audit ») est ajouté par le composant.
 */
export const UN_A_UN_RELATED: Record<UnAUnDetailSlug, UnAUnDetailSlug[]> = {
  "coaching-decouverte": [
    "dirigeant-vision-strategique",
    "claude-dirigeant",
    "claude-implementation-individuel",
  ],
  "dirigeant-vision-strategique": [
    "claude-dirigeant",
    "claude-implementation-individuel",
    "coaching-decouverte",
  ],
  "claude-dirigeant": [
    "dirigeant-vision-strategique",
    "claude-implementation-individuel",
    "coaching-decouverte",
  ],
  "claude-implementation-individuel": [
    "claude-dirigeant",
    "dirigeant-vision-strategique",
    "coaching-decouverte",
  ],
};
