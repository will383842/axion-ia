/**
 * Content Generator — SEO score déterministe /100 (§ 10.2 master prompt v1.7).
 *
 * Sprint 1 Day 3 AGT-E. 13 critères pondérés. V1 = règles déterministes (pas ML).
 *
 * Grille (sum = 100) :
 * - Title 50-60 chars                        : 10
 * - Meta description 140-160 chars           : 10
 * - H1 unique présent                        : 8
 * - 3-8 H2 + structure stricte               : 10
 * - Primary keyword dans title + H1 + body 3+: 12
 * - Direct answer 40-80 mots                 : 8
 * - FAQ 4+ items                             : 8
 * - Internal links 3+                        : 6
 * - Word count ≥ 800 (article) / 2000 (guide): 10
 * - Image avec alt + caption                 : 6
 * - Sources/citations 1+ (intent info)       : 6
 * - Canonical URL absolute                   : 3
 * - JSON-LD Person Manon référencé           : 3
 */

import type { SearchIntent } from "../../../../prisma/generated/client";

export interface SeoScoreInput {
  readonly title: string;
  readonly metaDescription: string;
  readonly bodyHtml: string;
  readonly bodyText: string;
  readonly directAnswer?: string;
  readonly faqCount?: number;
  readonly internalLinkCount?: number;
  readonly imageCount?: number;
  readonly imagesWithAlt?: number;
  readonly imagesWithCaption?: number;
  readonly citationCount?: number;
  readonly canonical?: string;
  readonly hasPersonManonJsonLd?: boolean;
  readonly primaryKeyword?: string;
  readonly searchIntent?: SearchIntent;
  /** Type de contenu pour ajuster seuils (article/guide). */
  readonly contentKind?: "article" | "guide" | "landing" | "faq" | "comparison";
}

export interface SeoScoreResult {
  readonly score: number;
  readonly breakdown: ReadonlyArray<{
    criterion: string;
    max: number;
    got: number;
    reason?: string;
  }>;
  readonly intentAligned: boolean;
}

function scoreTitle(title: string): { got: number; reason?: string } {
  const len = title.length;
  if (len >= 50 && len <= 60) return { got: 10 };
  if (len >= 45 && len <= 70) return { got: 7, reason: `Title ${len} chars (cible 50-60)` };
  return { got: 3, reason: `Title ${len} chars trop court/long` };
}

function scoreMetaDescription(meta: string): { got: number; reason?: string } {
  const len = meta.length;
  if (len >= 140 && len <= 160) return { got: 10 };
  if (len >= 120 && len <= 180) return { got: 7, reason: `Meta ${len} chars (cible 140-160)` };
  return { got: 3, reason: `Meta ${len} chars trop court/long` };
}

function scoreH1Unique(html: string): { got: number; reason?: string } {
  const h1Matches = html.match(/<h1[\s>]/gi) ?? [];
  if (h1Matches.length === 1) return { got: 8 };
  if (h1Matches.length === 0) return { got: 0, reason: "Pas de H1" };
  return { got: 3, reason: `${h1Matches.length} H1 trouvés (cible 1)` };
}

function scoreH2Structure(html: string): { got: number; reason?: string } {
  const h2Count = (html.match(/<h2[\s>]/gi) ?? []).length;
  if (h2Count >= 3 && h2Count <= 8) return { got: 10 };
  if (h2Count >= 2 && h2Count <= 10) return { got: 7, reason: `${h2Count} H2 (cible 3-8)` };
  return { got: 3, reason: `${h2Count} H2 hors cible 3-8` };
}

function scorePrimaryKeyword(
  bodyText: string,
  title: string,
  primaryKeyword: string | undefined,
): { got: number; reason?: string } {
  if (!primaryKeyword) return { got: 0, reason: "primaryKeyword absent" };
  const kw = primaryKeyword.toLowerCase();
  const inTitle = title.toLowerCase().includes(kw);
  const inH1 = /<h1[^>]*>([^<]*)</.exec(bodyText.toLowerCase())?.[1]?.includes(kw) ?? false;
  const bodyMatches = (bodyText.toLowerCase().match(new RegExp(kw, "g")) ?? []).length;
  let score = 0;
  if (inTitle) score += 4;
  if (inH1) score += 4;
  if (bodyMatches >= 3) score += 4;
  return {
    got: Math.min(12, score),
    reason: `KW '${kw}' title=${inTitle} h1=${inH1} body=${bodyMatches}×`,
  };
}

function scoreDirectAnswer(directAnswer: string | undefined): { got: number; reason?: string } {
  if (!directAnswer) return { got: 0, reason: "Pas de direct answer" };
  const wordCount = directAnswer.split(/\s+/).filter((w) => w.length > 0).length;
  if (wordCount >= 40 && wordCount <= 80) return { got: 8 };
  if (wordCount >= 30 && wordCount <= 100)
    return { got: 5, reason: `${wordCount} mots (cible 40-80)` };
  return { got: 2, reason: `${wordCount} mots hors cible 40-80` };
}

function scoreFaq(faqCount: number | undefined): { got: number; reason?: string } {
  const n = faqCount ?? 0;
  if (n >= 4) return { got: 8 };
  if (n >= 2) return { got: 4, reason: `${n} FAQ (cible 4+)` };
  return { got: 0, reason: `${n} FAQ — au moins 4 attendues` };
}

function scoreInternalLinks(count: number | undefined): { got: number; reason?: string } {
  const n = count ?? 0;
  if (n >= 3) return { got: 6 };
  if (n >= 1) return { got: 3, reason: `${n} liens internes (cible 3+)` };
  return { got: 0, reason: "Pas de liens internes" };
}

function scoreWordCount(
  bodyText: string,
  kind: SeoScoreInput["contentKind"],
): { got: number; reason?: string } {
  const words = bodyText.split(/\s+/).filter((w) => w.length > 0).length;
  // Cible de longueur par type : un guide pilier est long, une FAQ géo est
  // volontairement plus concise (intro + Q/R). Sans le cas "faq", les FAQ
  // étaient notées sur la cible article (800) → 0 pt malgré une longueur
  // appropriée à leur format.
  const target = kind === "guide" ? 2000 : kind === "landing" ? 1500 : kind === "faq" ? 600 : 800;
  if (words >= target) return { got: 10 };
  if (words >= target * 0.7) return { got: 5, reason: `${words} mots (cible ${target}+)` };
  return { got: 0, reason: `${words} mots — trop court (cible ${target}+)` };
}

function scoreImages(input: SeoScoreInput): { got: number; reason?: string } {
  const total = input.imageCount ?? 0;
  if (total === 0) return { got: 0, reason: "Pas d'image" };
  const withAlt = input.imagesWithAlt ?? 0;
  const withCaption = input.imagesWithCaption ?? 0;
  let score = 0;
  if (withAlt === total) score += 3;
  if (withCaption >= 1) score += 3;
  return { got: score, reason: `${total} images, alt=${withAlt}, caption=${withCaption}` };
}

function scoreCitations(
  count: number | undefined,
  intent: SearchIntent | undefined,
): { got: number; reason?: string } {
  const n = count ?? 0;
  if (intent === "informational") {
    if (n >= 3) return { got: 6 };
    if (n >= 1) return { got: 3, reason: `${n} citations (cible 3+ pour intent informational)` };
    return { got: 0, reason: "Intent informational sans citation" };
  }
  return { got: n >= 1 ? 6 : 4 };
}

function scoreCanonical(canonical: string | undefined): { got: number; reason?: string } {
  if (!canonical) return { got: 0, reason: "Canonical absent" };
  if (canonical.startsWith("https://axion-ia.com/")) return { got: 3 };
  return { got: 1, reason: "Canonical pas en https://axion-ia.com/" };
}

function scorePersonManon(has: boolean | undefined): { got: number; reason?: string } {
  if (has) return { got: 3 };
  return { got: 0, reason: "Person Manon JSON-LD manquant" };
}

/**
 * Vérifie l'alignement structurel avec l'intent recherche (§ 26.3).
 * Retourne true si tous les critères de l'intent sont satisfaits.
 */
function checkIntentAlignment(input: SeoScoreInput): boolean {
  const intent = input.searchIntent;
  if (!intent) return true;
  switch (intent) {
    case "transactional": {
      // Doit avoir CTA primary dans la 1ʳᵉ moitié
      const firstHalf = input.bodyHtml.slice(0, input.bodyHtml.length / 2);
      return /class="[^"]*\bbtn[-_]primary\b/.test(firstHalf);
    }
    case "local":
      // Doit avoir LocalBusiness JSON-LD + meta geo
      return /LocalBusiness/.test(input.bodyHtml) && /geo\.region/.test(input.bodyHtml);
    case "informational":
      // Doit avoir ≥ 3 citations
      return (input.citationCount ?? 0) >= 3;
    case "commercial_investigation":
      // Doit avoir <table> comparatif
      return /<table[\s>]/i.test(input.bodyHtml);
    case "navigational":
      return true; // pas auto-généré V1
    case "voice_search":
      // Phrases conversationnelles courtes (heuristique : H1 en forme de question)
      return /\?/.test(input.bodyHtml.slice(0, 500));
    case "ai_overview":
      // ≥ 2 sources externes citées (optimisation AI Overview)
      return (input.citationCount ?? 0) >= 2;
    case "featured_snippet":
      // Doit avoir paragraphe data-aeo="tldr"
      return /data-aeo="tldr"/.test(input.bodyHtml);
    default:
      return true;
  }
}

export function computeSeoScore(input: SeoScoreInput): SeoScoreResult {
  const checks = [
    { criterion: "Title 50-60 chars", max: 10, ...scoreTitle(input.title) },
    { criterion: "Meta 140-160 chars", max: 10, ...scoreMetaDescription(input.metaDescription) },
    { criterion: "H1 unique", max: 8, ...scoreH1Unique(input.bodyHtml) },
    { criterion: "3-8 H2", max: 10, ...scoreH2Structure(input.bodyHtml) },
    {
      criterion: "Primary KW title+H1+body",
      max: 12,
      ...scorePrimaryKeyword(input.bodyText, input.title, input.primaryKeyword),
    },
    { criterion: "Direct answer 40-80 mots", max: 8, ...scoreDirectAnswer(input.directAnswer) },
    { criterion: "FAQ 4+", max: 8, ...scoreFaq(input.faqCount) },
    { criterion: "Internal links 3+", max: 6, ...scoreInternalLinks(input.internalLinkCount) },
    { criterion: "Word count", max: 10, ...scoreWordCount(input.bodyText, input.contentKind) },
    { criterion: "Images alt + caption", max: 6, ...scoreImages(input) },
    {
      criterion: "Citations intent-aware",
      max: 6,
      ...scoreCitations(input.citationCount, input.searchIntent),
    },
    { criterion: "Canonical absolute", max: 3, ...scoreCanonical(input.canonical) },
    {
      criterion: "Person Manon JSON-LD",
      max: 3,
      ...scorePersonManon(input.hasPersonManonJsonLd),
    },
  ];

  const totalScore = checks.reduce((sum, c) => sum + c.got, 0);
  return {
    score: Math.min(100, totalScore),
    breakdown: checks,
    intentAligned: checkIntentAlignment(input),
  };
}
