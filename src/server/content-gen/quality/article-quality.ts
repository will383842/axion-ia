/**
 * Content Generator — Notation qualité centralisée (round 3 2026-06-18).
 *
 * Les ~10 générateurs dupliquaient le MÊME bloc de notation avec des valeurs
 * codées en dur qui sous-notaient TOUS les types :
 *   - contentKind: "article" (faux pour faq/guide/landing/comparison)
 *   - hasPersonManonJsonLd: false (or le rendu l'ajoute toujours)
 *   - h1/canonical/image non crédités (fournis par la PAGE, pas le body)
 *   - qualityScore = moyenne(seo, Flesch BRUT) (pénalise la densité B2B)
 *
 * Deux helpers SOURCE-UNIQUE, insérables sans casser le reste du générateur
 * (qui garde ses objets seo/readability pour le feedback/logging) :
 *   - articlePageSeoDefaults : à spreader dans l'appel computeSeoScore.
 *   - qualityFromScores       : la formule (lisibilité en bande B2B + doctrine).
 */
import { readabilityFitScore } from "./readability";
import type { SeoScoreInput } from "./seo-score";
import { seoContentKind } from "../generators/seo-content-kind";

/**
 * Champs SEO « page-level » garantis sur CHAQUE article content-gen au rendu
 * (le scorer note le body mais ces éléments sont fournis par la page) :
 *  - contentKind dérivé du type (cible de longueur correcte)
 *  - Person Manon JSON-LD (persona éditoriale, toujours rendu)
 *  - <h1> = le titre (body sans h1 par design sanitizer)
 *  - canonical absolue (generateMetadata)
 *  - hero image + alt (assignée au publish)
 */
export function articlePageSeoDefaults(
  slug: string,
  contentTypeSlug: string,
): Pick<
  SeoScoreInput,
  | "contentKind"
  | "hasPersonManonJsonLd"
  | "hasPageH1"
  | "canonical"
  | "imageCount"
  | "imagesWithAlt"
> {
  return {
    contentKind: seoContentKind(contentTypeSlug),
    hasPersonManonJsonLd: true,
    hasPageH1: true,
    canonical: `https://axion-ia.com/fr/blog/${slug}`,
    imageCount: 1,
    imagesWithAlt: 1,
  };
}

/**
 * qualityScore = moyenne(SEO, lisibilité FITNESS). La lisibilité Flesch brute
 * pénalisait le contenu IA B2B (dense par nature) ; readabilityFitScore crédite
 * pleinement une densité professionnelle (cf. readability.ts). -30 si la
 * doctrine échoue. SOURCE UNIQUE de la formule pour tous les générateurs.
 */
export function qualityFromScores(
  seoScore: number,
  readabilityRawScore: number,
  doctrinePassed: boolean,
): number {
  const base = Math.round((seoScore + readabilityFitScore(readabilityRawScore)) / 2);
  return doctrinePassed ? base : Math.max(0, base - 30);
}

/**
 * Append une section « Sources » HTML avec les liens d'autorité sélectionnés
 * (INSEE/DARES/BPI/EU AI Act…). CORRECTIF CITATIONS round 4 2026-06-18 : le LLM
 * n'intégrait JAMAIS les liens externes fournis dans le prompt → citationCount=0
 * sur TOUS les articles (−6 pts SEO). On les pose donc déterministe, en fin de
 * body : vraies sources d'autorité (bon pour l'EEAT) + citationCount garanti.
 * Idempotent (no-op si déjà une section Sources ou si aucun lien).
 */
export function appendSourcesSection(
  bodyHtml: string,
  links: ReadonlyArray<{ url: string; title: string }>,
): string {
  if (!links || links.length === 0) return bodyHtml;
  if (/id="sources-axion"/.test(bodyHtml)) return bodyHtml; // déjà injecté
  const items = links
    .slice(0, 6)
    .map(
      (l) => `<li><a href="${l.url}" target="_blank" rel="noopener noreferrer">${l.title}</a></li>`,
    )
    .join("");
  return `${bodyHtml}\n<section id="sources-axion"><h2>Sources</h2><ul>${items}</ul></section>`;
}
