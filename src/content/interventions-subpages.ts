// Config de maillage des pages détail formation COLLECTIVE (module
// interventions-formations). Calqué sur implementation-subpages.ts : sépare les
// données de maillage (pages sœurs suggérées) et le label géo du pack de contenu
// principal (interventions.ts). Consommé par FormationSubPageExtras.
//
// Périmètre = formations COLLECTIVES uniquement (1 jour / 2 jours). Les pages
// 4 h (demarrage-ia-express / atelier-ia-cible) ont leur propre template
// (CollectiveTrainingPage) ; le coaching/dirigeants/individuel relève du module
// un-à-un (hors périmètre).

import type { InterventionSlug } from "./interventions";

/** Sous-ensemble des slugs interventions qui sont des formations collectives
 *  rendues par ProductPageTemplate (cf. interventions.ts). */
export type FormationDetailSlug =
  | "essentielle"
  | "approfondie"
  | "gagner-du-temps"
  | "intervention-claude";

/**
 * Pages suggérées (maillage interne « Voir aussi »). 3 formations sœurs par
 * page. Le 4ᵉ lien (cross-module « commencer par un audit ») est ajouté par le
 * composant. Combinaisons distinctes par page (ordre différent) pour éviter le
 * maillage strictement uniforme.
 */
export const FORMATION_RELATED: Record<FormationDetailSlug, FormationDetailSlug[]> = {
  essentielle: ["approfondie", "gagner-du-temps", "intervention-claude"],
  approfondie: ["essentielle", "gagner-du-temps", "intervention-claude"],
  "gagner-du-temps": ["essentielle", "approfondie", "intervention-claude"],
  "intervention-claude": ["essentielle", "gagner-du-temps", "approfondie"],
};

/**
 * Label du format pour la section couverture nationale
 * (« {label} disponible partout en France »). Sujet réel de la page → signal
 * géo spécifique au format plutôt que générique « formation IA ».
 */
export const FORMATION_GEO_LABEL: Record<FormationDetailSlug, { fr: string; en: string }> = {
  essentielle: { fr: "La formation IA Essentielle", en: "The Essential AI training" },
  approfondie: { fr: "La formation IA Approfondie", en: "The Deep Dive AI training" },
  "gagner-du-temps": { fr: "La formation IA productivité", en: "AI productivity training" },
  "intervention-claude": { fr: "La formation Claude", en: "Claude AI training" },
};

/**
 * Durée ISO 8601 par format collectif — alimente le Course JSON-LD des pages
 * détail (CourseInstance.courseWorkload). Aligné sur les durées réelles de la
 * taxonomie (essentielle/gagner-du-temps/intervention-claude = 1 jour ≈ PT8H ;
 * approfondie = 2 jours = P2D).
 */
export const FORMATION_DURATION_ISO: Record<FormationDetailSlug, string> = {
  essentielle: "PT8H",
  approfondie: "P2D",
  "gagner-du-temps": "PT8H",
  "intervention-claude": "PT8H",
};

/** Garde de type : ce slug intervention est-il une formation collective détail ? */
export function isFormationDetailSlug(slug: InterventionSlug): slug is FormationDetailSlug {
  return (
    slug === "essentielle" ||
    slug === "approfondie" ||
    slug === "gagner-du-temps" ||
    slug === "intervention-claude"
  );
}
