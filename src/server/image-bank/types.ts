// Template : src/server/image-bank/types.ts
//
// Types partagés entre services + Server Actions + composants admin.

import type { ImageBankLocale, Orientation, SourceType, UsageAction } from "./constants";

// ─── Import (Sharp pipeline) ────────────────────────────────────────────────

export interface ImportInput {
  buffer: Buffer;
  mimetype: string;
  originalFilename: string;
}

export interface ImportResult {
  uuid: string;
  fileHash: string;
  filePath: string;
  thumbnailPath: string;
  avifPath: string | null;
  /** OG variant dédié 1200×630 (ratio 1.91:1) — pour Twitter/LinkedIn `og:image`. */
  ogPath: string;
  lqipDataUri: string;
  fileFormat: "webp";
  fileSize: number;
  width: number;
  height: number;
  orientation: Orientation;
  aspectRatio: string;
  srcset: string;
}

// ─── Translation (Claude vision FR ↔ EN) ────────────────────────────────────

export interface TranslateInput {
  imageId: string;
  sourceLang: ImageBankLocale;
  targetLang: ImageBankLocale;
  imageUrl?: string;
}

export interface TranslateResult {
  title: string;
  slug: string;
  alt: string;
  caption: string | null;
  description: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  aiSummary: string | null;
  embedTitle: string | null;
}

// ─── Enrichment (Claude vision) ─────────────────────────────────────────────

export interface EnrichInput {
  imageId: string;
  lang: ImageBankLocale;
  imageUrl?: string;
  mode: "auto" | "improve" | "regenerate";
}

export interface EnrichResult {
  alt: string;
  caption: string;
  description: string;
  keywordsPrimary: string;
  keywordsSecondary: string[];
  geoPlacename?: string;
  geoRegion?: string;
  geoPosition?: string;
  aiSummary: string;
  embedTitle: string;
  metaTitle: string;
  metaDescription: string;
}

// ─── Watermark ──────────────────────────────────────────────────────────────

export interface WatermarkOptions {
  color?: string;
  opacity?: number;
  text?: string;
  fontSize?: number;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
}

// ─── Country detection ──────────────────────────────────────────────────────

export interface DetectCountryInput {
  geoRegion?: string | null;
  geoPlacename?: string | null;
  keywordsPrimary?: string | null;
  keywordsSecondary?: string[] | null;
  translations: Array<{ title: string; alt: string; caption?: string | null }>;
}

// ─── Tracking usage ─────────────────────────────────────────────────────────

export interface TrackUsageInput {
  imageId: string;
  action: UsageAction;
  referrerUrl?: string;
  userAgent?: string;
  ipHash?: string;
  language?: string;
  countryCode?: string;
}

// ─── SEO score breakdown (admin analytics) ──────────────────────────────────

export interface SeoScoreBreakdown {
  total: number;
  altFr: number;
  altEn: number;
  caption: number;
  description: number;
  metaTitles: number;
  countries: number;
  geoPosition: number;
  photographer: number;
  keywords: number;
  avif: number;
  iptc: number;
}

export type { ImageBankLocale, Orientation, SourceType, UsageAction };
