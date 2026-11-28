/**
 * Gabarits d'articles de blog : correspondance ContentType → gabarit
 * (PLAN gabarits-articles §3). Fonctions pures, sans accès base.
 */
import type { ContentType } from "../../../../prisma/generated/client";

export const GABARITS_ARTICLE = [
  "analyse",
  "guide",
  "comparatif",
  "selection",
  "cas",
  "definition",
  "faq",
  "chiffres",
] as const;

export type GabaritArticle = (typeof GABARITS_ARTICLE)[number];

/**
 * Table exhaustive : l'ajout d'une valeur à l'énumération Prisma `ContentType`
 * casse la compilation tant que la table n'est pas complétée.
 * `blog_from_rss` (actualités) est servi sur /actualites : repli sur l'analyse.
 */
export const GABARIT_PAR_TYPE: Record<ContentType, GabaritArticle> = {
  blog_article: "analyse",
  blog_from_keywords: "analyse",
  blog_from_title: "analyse",
  long_tail_keyword: "analyse",
  pain_point_solution: "analyse",
  landing_ville: "analyse",
  blog_from_rss: "analyse",
  how_to_x_in_y: "guide",
  calculator_roi: "guide",
  guide_pilier: "guide",
  comparison: "comparatif",
  vs_comparator: "comparatif",
  alternative_to: "comparatif",
  top_x_in_y: "selection",
  best_for_x_in_y: "selection",
  case_study_local: "cas",
  what_is_x: "definition",
  glossary_term: "definition",
  faq_standalone: "faq",
  faq_geo: "faq",
  qa_derived: "faq",
  barometer_insight: "chiffres",
};

/** Lignes de tableau (en-tête compris) à partir desquelles un tableau fait un comparatif. */
const SEUIL_LIGNES_TABLEAU = 3;
/** Étapes numérotées à partir desquelles une liste fait un guide. */
const SEUIL_ETAPES = 3;

function compterLignesDuPlusGrandTableau(html: string): number {
  let max = 0;
  for (const m of html.matchAll(/<table\b[\s\S]*?<\/table>/gi)) {
    const n = (m[0].match(/<tr\b/gi) ?? []).length;
    if (n > max) max = n;
  }
  return max;
}

function compterEtapesDuPlusGrandOl(html: string): number {
  let max = 0;
  for (const m of html.matchAll(/<ol\b[\s\S]*?<\/ol>/gi)) {
    const n = (m[0].match(/<li\b/gi) ?? []).length;
    if (n > max) max = n;
  }
  return max;
}

/**
 * Repli pour un type inconnu (article saisi en console, article en fichier) :
 * tableau d'au moins 3 lignes → comparatif ; liste numérotée d'au moins 3
 * étapes → guide ; sinon analyse.
 */
export function gabaritDeRepli(html: string | null | undefined): GabaritArticle {
  if (!html) return "analyse";
  if (compterLignesDuPlusGrandTableau(html) >= SEUIL_LIGNES_TABLEAU) return "comparatif";
  if (compterEtapesDuPlusGrandOl(html) >= SEUIL_ETAPES) return "guide";
  return "analyse";
}

/** Gabarit d'un article : par type de contenu, sinon heuristique de repli sur le HTML. */
export function gabaritPourType(
  type: ContentType | null | undefined,
  html: string | null | undefined,
): GabaritArticle {
  const gabarit =
    type && Object.hasOwn(GABARIT_PAR_TYPE, type) ? GABARIT_PAR_TYPE[type] : undefined;
  return gabarit ?? gabaritDeRepli(html);
}
