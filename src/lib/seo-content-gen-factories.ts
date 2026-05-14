/**
 * Content Generator — Factories JSON-LD (§ 9.7.8 master prompt v1.7).
 *
 * Sprint 1 Day 3 AGT-F. 10 factories pour les 9 types de contenu V1.
 *
 * Extension de `src/lib/seo.ts` (existing) — séparé pour éviter mass-edit
 * du fichier source de vérité SEO (35 KB existing). Les factories d'ici
 * peuvent ré-importer SITE_URL + buildOrganizationJsonLd existants.
 *
 * Validation runtime : tous les schemas émis sont compatibles Schema.org 2026 +
 * Rich Results Test Google.
 */

import type { AuthorProfile } from "../../prisma/generated/client";

// Lecture process.env directe (pas @/env t3-validator) pour rester testable
// côté Vitest (t3-env throw "client-side detected" en test sans NEXT_RUNTIME).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";

// ============================================================
// 1. Person — Manon (auteur canonique)
// ============================================================

/**
 * Person JSON-LD pour Manon depuis AuthorProfile DB (§ 9.8 master prompt v2.1).
 *
 * Garde-fou : la fonction throw si profile.slug !== "manon" (anti-fuite
 * sameAs sur un autre auteur). Doctrine v2.1 = zéro réseau social donc
 * pas de `sameAs[]` émis. Description inclut disclaimer IA explicite.
 */
export function buildPersonManonJsonLd(
  profile: Pick<
    AuthorProfile,
    | "slug"
    | "displayName"
    | "jobTitle"
    | "photoUrl1024"
    | "photoAlt"
    | "knowsAbout"
    | "personaDisclaimer"
  >,
): Record<string, unknown> {
  if (profile.slug !== "manon") {
    throw new Error(
      `buildPersonManonJsonLd called with non-manon slug '${profile.slug}' — guard v2.1`,
    );
  }
  const caption = profile.photoAlt ?? `${profile.displayName} — portrait éditorial Axion-IA`;
  const description =
    profile.personaDisclaimer ??
    `${profile.displayName} est la plume éditoriale d'Axion-IA. Persona éditoriale transparente — portrait IA disclosed.`;
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${SITE_URL}/fr/equipe/manon#person`,
    name: profile.displayName,
    givenName: profile.displayName,
    jobTitle: profile.jobTitle,
    url: `${SITE_URL}/fr/equipe/manon`,
    image: {
      "@type": "ImageObject",
      url: `${SITE_URL}${profile.photoUrl1024}`,
      width: 1024,
      height: 1024,
      caption,
    },
    description,
    knowsAbout: profile.knowsAbout,
    knowsLanguage: ["fr-FR"],
    worksFor: { "@id": `${SITE_URL}/#organization` },
    // GARDE-FOU v2.1 : pas de sameAs (Manon n'a aucun réseau social)
  };
}

// ============================================================
// 2-4. Article / BlogPosting / TechArticle variants
// ============================================================

export interface ArticleJsonLdInput {
  readonly title: string;
  readonly description: string;
  readonly slug: string;
  readonly locale: "fr" | "en";
  readonly publishedAt: Date | string;
  readonly updatedAt: Date | string;
  readonly imageUrl?: string;
  readonly imageAlt?: string;
  readonly authorIdRef?: string;
  readonly section?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly wordCount?: number;
  readonly readingTimeMinutes?: number;
  /**
   * Segment d'URL : "blog" (défaut) ou "actualites" (NewsArticle RSS § 28).
   * Aligne canonical + mainEntityOfPage sur le path public réel.
   */
  readonly urlSegment?: "blog" | "actualites";
}

function buildArticleBase(
  type: "Article" | "BlogPosting" | "TechArticle" | "NewsArticle",
  input: ArticleJsonLdInput,
): Record<string, unknown> {
  const segment = input.urlSegment ?? (type === "NewsArticle" ? "actualites" : "blog");
  const url = `${SITE_URL}/${input.locale}/${segment}/${input.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${url}#article`,
    headline: input.title,
    description: input.description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: input.locale === "fr" ? "fr-FR" : "en-US",
    datePublished: new Date(input.publishedAt).toISOString(),
    dateModified: new Date(input.updatedAt).toISOString(),
    author: {
      "@id": input.authorIdRef ?? `${SITE_URL}/fr/equipe/manon#person`,
    },
    publisher: { "@id": `${SITE_URL}/#organization` },
    ...(input.imageUrl
      ? {
          image: {
            "@type": "ImageObject",
            url: input.imageUrl,
            ...(input.imageAlt ? { caption: input.imageAlt } : {}),
          },
        }
      : {}),
    ...(input.section ? { articleSection: input.section } : {}),
    ...(input.tags && input.tags.length > 0 ? { keywords: input.tags.join(", ") } : {}),
    ...(input.wordCount ? { wordCount: input.wordCount } : {}),
    ...(input.readingTimeMinutes ? { timeRequired: `PT${input.readingTimeMinutes}M` } : {}),
  };
}

export function buildArticleJsonLd(input: ArticleJsonLdInput): Record<string, unknown> {
  return buildArticleBase("Article", input);
}

export function buildBlogPostingJsonLd(input: ArticleJsonLdInput): Record<string, unknown> {
  return buildArticleBase("BlogPosting", input);
}

export function buildTechArticleJsonLd(input: ArticleJsonLdInput): Record<string, unknown> {
  return buildArticleBase("TechArticle", input);
}

// ============================================================
// 5. NewsArticle (Pipeline 2 RSS — § 28 master prompt v1.7)
// ============================================================

export interface NewsArticleJsonLdInput extends ArticleJsonLdInput {
  /** Format CGU Schema.org NewsArticle — ex: "Paris, 2026-05-13". */
  readonly dateline?: string;
  /** ex: "Actualités IA", "Marché", "Réglementation". */
  readonly printSection?: string;
  /** URL source originale. */
  readonly sourceUrl: string;
  /** Nom de la source originale (ex: "Le Monde Informatique"). */
  readonly sourceName: string;
}

export function buildNewsArticleJsonLd(input: NewsArticleJsonLdInput): Record<string, unknown> {
  const base = buildArticleBase("NewsArticle", input);
  return {
    ...base,
    ...(input.dateline ? { dateline: input.dateline } : {}),
    ...(input.printSection ? { printSection: input.printSection } : {}),
    isBasedOn: {
      "@type": "CreativeWork",
      url: input.sourceUrl,
      publisher: input.sourceName,
    },
  };
}

// ============================================================
// 6. QAPage (Q/R post-process auto — § 29 master prompt v1.7)
// ============================================================

export interface QAPageJsonLdInput {
  readonly question: string;
  readonly answerHtml: string;
  readonly slug: string;
  readonly locale: "fr" | "en";
  readonly publishedAt: Date | string;
  readonly parentArticleUrl?: string;
  readonly upvoteCount?: number;
  readonly speakableCssSelectors?: ReadonlyArray<string>;
}

export function buildQAPageJsonLd(input: QAPageJsonLdInput): Record<string, unknown> {
  const url = `${SITE_URL}/${input.locale}/faq/${input.slug}`;
  const speakable = input.speakableCssSelectors ?? [".faq-answer", '[data-aeo="answer"]'];
  return {
    "@context": "https://schema.org",
    "@type": "QAPage",
    "@id": `${url}#qapage`,
    url,
    inLanguage: input.locale === "fr" ? "fr-FR" : "en-US",
    datePublished: new Date(input.publishedAt).toISOString(),
    mainEntity: {
      "@type": "Question",
      name: input.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: input.answerHtml.replace(/<[^>]+>/g, "").slice(0, 5000),
        ...(input.upvoteCount ? { upvoteCount: input.upvoteCount } : {}),
        ...(input.parentArticleUrl ? { url: input.parentArticleUrl } : {}),
      },
      ...(input.parentArticleUrl
        ? { isPartOf: { "@type": "WebPage", url: input.parentArticleUrl } }
        : {}),
    },
    author: { "@id": `${SITE_URL}/fr/equipe/manon#person` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: speakable,
    },
  };
}

// ============================================================
// 7. HowTo (guides piliers — § 6.4 + § 9.7.8)
// ============================================================

export interface HowToStepInput {
  readonly name: string;
  readonly text: string;
  readonly url?: string;
  readonly imageUrl?: string;
}

export interface HowToJsonLdInput {
  readonly name: string;
  readonly description: string;
  readonly slug: string;
  readonly locale: "fr" | "en";
  readonly publishedAt: Date | string;
  readonly updatedAt: Date | string;
  readonly totalTimeMinutes?: number;
  readonly estimatedCostUsd?: number;
  readonly tool?: ReadonlyArray<string>;
  readonly supply?: ReadonlyArray<string>;
  readonly steps: ReadonlyArray<HowToStepInput>;
}

export function buildHowToJsonLd(input: HowToJsonLdInput): Record<string, unknown> {
  const url = `${SITE_URL}/${input.locale}/guides/${input.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "@id": `${url}#howto`,
    name: input.name,
    description: input.description,
    url,
    inLanguage: input.locale === "fr" ? "fr-FR" : "en-US",
    datePublished: new Date(input.publishedAt).toISOString(),
    dateModified: new Date(input.updatedAt).toISOString(),
    author: { "@id": `${SITE_URL}/fr/equipe/manon#person` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    ...(input.totalTimeMinutes ? { totalTime: `PT${input.totalTimeMinutes}M` } : {}),
    ...(input.estimatedCostUsd
      ? {
          estimatedCost: {
            "@type": "MonetaryAmount",
            currency: "USD",
            value: input.estimatedCostUsd,
          },
        }
      : {}),
    ...(input.tool && input.tool.length > 0
      ? { tool: input.tool.map((name) => ({ "@type": "HowToTool", name })) }
      : {}),
    ...(input.supply && input.supply.length > 0
      ? { supply: input.supply.map((name) => ({ "@type": "HowToSupply", name })) }
      : {}),
    step: input.steps.map((s, idx) => ({
      "@type": "HowToStep",
      position: idx + 1,
      name: s.name,
      text: s.text,
      ...(s.url ? { url: s.url } : {}),
      ...(s.imageUrl ? { image: s.imageUrl } : {}),
    })),
  };
}

// ============================================================
// 8. SpeakableSpec — réutilisable pour FAQ embed (§ 9bis.11 B)
// ============================================================

export function buildSpeakableSpec(cssSelectors: ReadonlyArray<string>): Record<string, unknown> {
  return {
    "@type": "SpeakableSpecification",
    cssSelector: cssSelectors,
  };
}

// ============================================================
// 9. Citation array — pour Article.citation[] (Perplexity sources)
// ============================================================

export interface CitationInput {
  readonly url: string;
  readonly title: string;
  readonly publishedAt?: string;
  readonly publisher?: string;
}

export function buildCitationArray(
  sources: ReadonlyArray<CitationInput>,
): ReadonlyArray<Record<string, unknown>> {
  return sources.map((s) => ({
    "@type": "CreativeWork",
    url: s.url,
    name: s.title,
    ...(s.publishedAt ? { datePublished: s.publishedAt } : {}),
    ...(s.publisher ? { publisher: s.publisher } : {}),
  }));
}

// ============================================================
// 10. IndexNow payload (§ 9bis.1 master prompt v1.7)
// ============================================================

export interface IndexNowPayload {
  readonly host: string;
  readonly key: string;
  readonly keyLocation: string;
  readonly urlList: ReadonlyArray<string>;
}

/**
 * Construit le payload IndexNow POST (Bing/Yandex/Seznam protocol).
 * Le `key` doit être en parallèle servi sur `keyLocation` (text/plain).
 *
 * @param urls URLs à soumettre (max 10 000 par batch — Bing limit).
 */
export function buildIndexNowPayload(urls: ReadonlyArray<string>): IndexNowPayload {
  const key = process.env.INDEXNOW_KEY ?? "axion-ia-indexnow-key-not-set";
  const host = "axion-ia.com";
  return {
    host,
    key,
    keyLocation: `${SITE_URL}/${key}.txt`,
    urlList: urls.slice(0, 10_000),
  };
}
