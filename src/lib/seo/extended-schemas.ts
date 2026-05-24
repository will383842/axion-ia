/**
 * Schema.org helpers complémentaires (Sprint v7 Phase 12).
 *
 * Étend la stack existante `src/lib/seo.ts` (21 helpers de base) avec des
 * schemas exotiques mais à fort signal AEO/GEO 2026 :
 *   1. DefinedTerm           — pour content type `glossary_term`
 *   2. SoftwareApplication   — pour content type `calculator_roi`
 *   3. VideoObject           — pour case studies vidéos (futurs)
 *   4. ClaimReview           — fact-check (signal trust AI Overviews)
 *   5. SiteNavigationElement — menu nav top (signal structure site)
 *   6. SpecialAnnouncement   — news IA temps réel (LLM citation prioritaire)
 *
 * Pattern : chaque helper retourne un objet JSON-LD plain (pas de side effects)
 * consommable par `<JsonLdGraph schemas={[...]} />` ou `<script type="application/ld+json">`.
 */

import { SITE_URL } from "@/lib/seo";

// ─── 1. DefinedTerm — glossary_term content type ─────────────────────────────

export interface DefinedTermInput {
  readonly term: string;
  readonly definition: string;
  readonly url: string; // canonical URL de la fiche glossaire
  readonly inDefinedTermSet?: string; // URL du glossaire parent (ex: /glossaire)
  readonly termCode?: string; // ID stable (ex: "rag", "llm", "fine-tuning")
}

export function buildDefinedTermJsonLd(input: DefinedTermInput) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    "@id": `${input.url}#definedterm`,
    name: input.term,
    description: input.definition,
    url: input.url,
    ...(input.termCode ? { termCode: input.termCode } : {}),
    ...(input.inDefinedTermSet
      ? {
          inDefinedTermSet: {
            "@type": "DefinedTermSet",
            "@id": `${input.inDefinedTermSet}#defterm-set`,
            url: input.inDefinedTermSet,
          },
        }
      : {}),
  } as const;
}

// ─── 2. SoftwareApplication — calculator_roi content type ────────────────────

export interface SoftwareApplicationInput {
  readonly name: string;
  readonly description: string;
  readonly url: string;
  readonly applicationCategory: string; // "BusinessApplication" | "WebApplication" | ...
  readonly operatingSystem?: string; // "Web" | "Cross-platform"
  readonly price?: string; // "0" si gratuit
  readonly priceCurrency?: string;
}

export function buildSoftwareApplicationJsonLd(input: SoftwareApplicationInput) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${input.url}#softwareapplication`,
    name: input.name,
    description: input.description,
    url: input.url,
    applicationCategory: input.applicationCategory,
    operatingSystem: input.operatingSystem ?? "Web",
    ...(input.price != null
      ? {
          offers: {
            "@type": "Offer",
            price: input.price,
            priceCurrency: input.priceCurrency ?? "EUR",
          },
        }
      : {}),
  } as const;
}

// ─── 3. VideoObject — case studies vidéos ────────────────────────────────────

export interface VideoObjectInput {
  readonly name: string;
  readonly description: string;
  readonly thumbnailUrl: string;
  readonly contentUrl?: string;
  readonly embedUrl?: string;
  readonly uploadDate: string; // ISO 8601
  readonly duration?: string; // ISO 8601 duration ("PT5M30S")
}

export function buildVideoObjectJsonLd(input: VideoObjectInput) {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: input.name,
    description: input.description,
    thumbnailUrl: input.thumbnailUrl,
    uploadDate: input.uploadDate,
    ...(input.contentUrl ? { contentUrl: input.contentUrl } : {}),
    ...(input.embedUrl ? { embedUrl: input.embedUrl } : {}),
    ...(input.duration ? { duration: input.duration } : {}),
  } as const;
}

// ─── 4. ClaimReview — fact-check (trust signal AI Overviews) ─────────────────

export interface ClaimReviewInput {
  readonly url: string;
  readonly claimReviewed: string;
  readonly reviewRating: 1 | 2 | 3 | 4 | 5; // best=5, worst=1
  readonly itemReviewedAuthor?: string;
  readonly itemReviewedDatePublished?: string;
  readonly reviewBody: string;
}

export function buildClaimReviewJsonLd(input: ClaimReviewInput) {
  return {
    "@context": "https://schema.org",
    "@type": "ClaimReview",
    "@id": `${input.url}#claimreview`,
    url: input.url,
    datePublished: new Date().toISOString().slice(0, 10),
    claimReviewed: input.claimReviewed,
    author: { "@type": "Organization", name: "Axion-IA", url: SITE_URL },
    reviewRating: {
      "@type": "Rating",
      ratingValue: input.reviewRating,
      bestRating: 5,
      worstRating: 1,
    },
    reviewBody: input.reviewBody,
    ...(input.itemReviewedAuthor
      ? {
          itemReviewed: {
            "@type": "Claim",
            author: { "@type": "Person", name: input.itemReviewedAuthor },
            ...(input.itemReviewedDatePublished
              ? { datePublished: input.itemReviewedDatePublished }
              : {}),
          },
        }
      : {}),
  } as const;
}

// ─── 5. SiteNavigationElement — menu nav top ─────────────────────────────────

export interface SiteNavigationItem {
  readonly name: string;
  readonly url: string;
  readonly position: number;
}

export function buildSiteNavigationJsonLd(items: ReadonlyArray<SiteNavigationItem>) {
  return {
    "@context": "https://schema.org",
    "@type": "SiteNavigationElement",
    "@id": `${SITE_URL}/#site-navigation`,
    name: "Navigation principale Axion-IA",
    hasPart: items.map((item) => ({
      "@type": "SiteNavigationElement",
      name: item.name,
      url: item.url,
      position: item.position,
    })),
  } as const;
}

// ─── 6. SpecialAnnouncement — news IA temps réel ────────────────────────────

export interface SpecialAnnouncementInput {
  readonly name: string;
  readonly text: string;
  readonly url: string;
  readonly datePosted: string; // ISO 8601
  readonly expires?: string; // ISO 8601
  readonly category?: string; // ex: "https://www.wikidata.org/wiki/Q81068910" (AI category)
}

export function buildSpecialAnnouncementJsonLd(input: SpecialAnnouncementInput) {
  return {
    "@context": "https://schema.org",
    "@type": "SpecialAnnouncement",
    "@id": `${input.url}#specialannouncement`,
    name: input.name,
    text: input.text,
    url: input.url,
    datePosted: input.datePosted,
    ...(input.expires ? { expires: input.expires } : {}),
    ...(input.category ? { category: input.category } : {}),
    announcementLocation: {
      "@type": "Country",
      name: "France",
      identifier: "FR",
    },
  } as const;
}
