// Template : src/server/image-bank/constants.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// SSOT — Toutes les constantes du module image-bank.
//
// Aucune autre source ne devrait dupliquer ces valeurs. Si une valeur est
// utilisée dans 2 fichiers ou plus, elle vit ici.
//
// Cohérence avec autres SSOT Axion-IA :
//   - `SITE_URL`, `BUILD_DATE` : @/lib/seo (ne PAS dupliquer ici)
//   - `routing.pathnames` : @/i18n/routing (déclare /galerie /gallery)
//   - Design tokens (#2a2520 mocha, etc.) : src/app/globals.css @theme
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ImageAsset,
  ImageAssetTranslation,
  ImageCategory,
  ImageCategoryTranslation,
} from "../../../prisma/generated/client";

// ─── i18n ────────────────────────────────────────────────────────────────────

/** Segment URL galerie par locale (cohérent avec `@/i18n/routing` pathnames). */
export const GALLERY_SEGMENT = {
  fr: "galerie",
  en: "gallery",
} as const satisfies Record<"fr" | "en", string>;

/** Segment URL téléchargement watermarké par locale. */
export const DOWNLOAD_SEGMENT = {
  fr: "telecharger",
  en: "download",
} as const satisfies Record<"fr" | "en", string>;

/** Locale BCP-47 (Open Graph + JSON-LD `inLanguage`). */
export const LOCALE_BCP47 = {
  fr: "fr-FR",
  en: "en-US",
} as const satisfies Record<"fr" | "en", string>;

/** Locale OG (Open Graph `og:locale` underscore). */
export const LOCALE_OG = {
  fr: "fr_FR",
  en: "en_US",
} as const satisfies Record<"fr" | "en", string>;

/** Labels breadcrumb "Home" / "Gallery" par locale. */
export const HOME_LABEL = { fr: "Accueil", en: "Home" } as const;
export const GALLERY_LABEL = { fr: "Galerie", en: "Gallery" } as const;

// ─── License & copyright ────────────────────────────────────────────────────

export const DEFAULT_LICENSE_TYPE = "cc-by-4.0";
export const DEFAULT_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
/** Entité juridique estonienne (registry EE, doctrine CLAUDE.md §22). */
export const DEFAULT_COPYRIGHT_HOLDER = "Axion-IA OÜ";
/** Credit text (CC BY 4.0 attribution short form). */
export const DEFAULT_CREDIT_TEXT = "Axion-IA";

// ─── Sharp pipeline ──────────────────────────────────────────────────────────

/** Anti zip-bomb (100 MP cap, vs default Sharp 268 MP). */
export const SHARP_PIXEL_LIMIT = 100_000_000;
export const SHARP_LIMITS = { limitInputPixels: SHARP_PIXEL_LIMIT } as const;

/** WebP variants (sm/md/lg/xl widths). lg = LCP cible. */
export const WEBP_VARIANTS = [
  { name: "sm", width: 640 },
  { name: "md", width: 960 },
  { name: "lg", width: 1200 },
  { name: "xl", width: 1920 },
] as const;

/** AVIF variants (md/lg uniquement V1 — Safari 16.4+ universal). */
export const AVIF_VARIANTS = [
  { name: "md", width: 960 },
  { name: "lg", width: 1200 },
] as const;

export const THUMBNAIL_WIDTH = 300;
export const LQIP_WIDTH = 20;
export const LQIP_BLUR = 3;
export const LQIP_JPEG_QUALITY = 30;

/** OG image variant dédié — ratio 1.91:1 strict pour Twitter/LinkedIn previews.
 *  Sans ce variant, Twitter crop centré → perd du contenu. */
export const OG_VARIANT = { width: 1200, height: 630 } as const;

/** WCAG 2.2 accessibility features par défaut.
 *  Liste schema.org : https://schema.org/accessibilityFeature */
export const DEFAULT_ACCESSIBILITY_FEATURES = ["alternativeText", "structuralNavigation"] as const;
export const DEFAULT_ACCESSIBILITY_HAZARD = "none" as const;
export const DEFAULT_ACCESSIBILITY_CONTROL = ["fullKeyboardControl", "fullMouseControl"] as const;

export const WEBP_QUALITY = 80;
export const WEBP_EFFORT = 4;
export const AVIF_QUALITY = 55;
export const AVIF_EFFORT = 6;

/** File size budget LCP (lg WebP). */
export const LCP_IMAGE_BYTES_MAX = 200_000;
export const UPLOAD_BYTES_MAX = 50 * 1024 * 1024;
/** Sync threshold — au-dessus, déléguer à BullMQ. */
export const SYNC_UPLOAD_BYTES_MAX = 5 * 1024 * 1024;

/** Types MIME acceptés à l'upload (validation magic bytes via Sharp). */
export const ACCEPTED_INPUT_FORMATS = [
  "jpeg",
  "jpg",
  "png",
  "webp",
  "tiff",
  "heif",
  "avif",
] as const;

// ─── Storage paths ───────────────────────────────────────────────────────────

/** Préfixe DB pour les chemins de variants (cohérent avec public/). */
export const STORAGE_URL_PREFIX = "/image-bank";

// ─── BullMQ ──────────────────────────────────────────────────────────────────

export const ENRICH_QUEUE_NAME = "image-bank-enrich";
export const VARIANTS_QUEUE_NAME = "image-bank-variants";
/** Queue de conversion slug-based PNG/JPG → WebP/AVIF (public/images/). */
export const AUTO_CONVERT_QUEUE_NAME = "image-bank-convert";
/** Concurrency worker enrich — respecte Anthropic Tier 2 ~50 req/min. */
export const ENRICH_CONCURRENCY = 5;
export const ENRICH_ATTEMPTS = 3;
export const ENRICH_BACKOFF_DELAY_MS = 5_000;

// ─── Cache tags (Next 16 revalidateTag) ──────────────────────────────────────

export const CACHE_TAGS = {
  /** Tag racine — invalide tout le module à chaque write admin. */
  root: "image-bank",
  /** Tag liste galerie par langue (index pages). */
  galleryByLang: (lang: "fr" | "en") => `image-bank-gallery:${lang}`,
  /** Tag détail image par slug + lang. */
  image: (slug: string) => `image:${slug}`,
  /** Tag par langue (groupe les sous-pages d'une langue). */
  byLang: (lang: "fr" | "en") => `image-bank:${lang}`,
  /** Tag sitemap (regen sitemap-images-*.xml). */
  sitemap: "image-bank-sitemap",
  /** Tag enrich (background revalidation). */
  enrich: (imageId: string) => `image-bank-enrich:${imageId}`,
} as const;

// ─── SEO score & publication gate ────────────────────────────────────────────

export const SEO_SCORE_PUBLISH_GATE = 80;
export const SEO_SCORE_ALERT_THRESHOLD = 60;
export const ALT_LENGTH_MIN = 30;
export const ALT_LENGTH_MAX = 125;
export const CAPTION_LENGTH_MIN = 80;
export const CAPTION_LENGTH_MAX = 200;
export const DESCRIPTION_LENGTH_MIN = 150;
export const DESCRIPTION_LENGTH_MAX = 500;
export const META_TITLE_MAX = 60;
export const META_DESCRIPTION_MIN = 140;
export const META_DESCRIPTION_MAX = 170;
export const KEYWORDS_SECONDARY_MIN = 5;
export const KEYWORDS_SECONDARY_MAX = 10;
export const SLUG_MAX_LENGTH = 100;

// ─── Watermark (palette Design.md v3) ────────────────────────────────────────

/** `--color-mocha` (Design.md v3) — couleur watermark fixe. */
export const WATERMARK_COLOR = "#2a2520";
export const WATERMARK_OPACITY = 0.65;
export const WATERMARK_DEFAULT_POSITION = "bottom-right" as const;
export const WATERMARK_DEFAULT_TEXT_FN = (year: number) => `© ${year} Axion-IA — CC BY 4.0`;

// ─── Rate-limit (Redis token bucket via @/lib/rate-limit existant) ──────────

/** Download watermark rate-limit. */
export const DOWNLOAD_RATE_LIMIT_PER_MIN = 10;

// ─── Sitemap chunking (best-practice 2026) ──────────────────────────────────

/** Cap par sub-sitemap (cf. `app/sitemap.ts` SITEMAP_CHUNK_SIZE). */
export const SITEMAP_CHUNK_SIZE = 1000;
/** Cache sitemap (1h public + 24h stale-while-revalidate). */
export const SITEMAP_CACHE_HEADER = "public, max-age=3600, stale-while-revalidate=86400";

// ─── Claude vision ───────────────────────────────────────────────────────────

/** Modèle Sonnet 4.6 par défaut. Override : CLAUDE_MODEL env. */
export const CLAUDE_VISION_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";
export const CLAUDE_MAX_TOKENS_TRANSLATE = 2000;
export const CLAUDE_MAX_TOKENS_ENRICH = 3000;

// ─── Sources autorisées ──────────────────────────────────────────────────────

export const SOURCE_TYPES = ["local", "upload", "ai_generated"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

// ─── Aspect / orientation ────────────────────────────────────────────────────

export const ORIENTATIONS = ["landscape", "portrait", "square"] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

// ─── Action analytics ────────────────────────────────────────────────────────

export const USAGE_ACTIONS = ["view", "download", "embed", "share"] as const;
export type UsageAction = (typeof USAGE_ACTIONS)[number];

// ─── AI referrers (track AEO/GEO ROI) ───────────────────────────────────────

/**
 * Patterns de détection AI crawlers / chat referrers (Sprint AEO V1).
 * Si `image_usage_logs.referrer_url` matche un de ces patterns → tag
 * `country_code = "AI-{source}"` pour analytics dédié AI traffic.
 *
 * Permet de mesurer l'efficacité AEO/GEO : combien de visites viennent
 * de Perplexity / ChatGPT Search / Claude.ai / Google AI Overviews.
 */
export const AI_REFERRER_PATTERNS: ReadonlyArray<{ pattern: RegExp; source: string }> = [
  { pattern: /perplexity\.ai/i, source: "perplexity" },
  { pattern: /chat\.openai\.com|chatgpt\.com/i, source: "chatgpt" },
  { pattern: /claude\.ai|anthropic\.com/i, source: "claude" },
  { pattern: /copilot\.microsoft\.com|bing\.com\/chat/i, source: "copilot" },
  { pattern: /gemini\.google\.com|bard\.google\.com/i, source: "gemini" },
  { pattern: /you\.com\/search/i, source: "you" },
  { pattern: /mistral\.ai/i, source: "mistral" },
  { pattern: /poe\.com/i, source: "poe" },
  { pattern: /(?:^|\.)duckassist\.duckduckgo/i, source: "duck-assist" },
];

/** Détecte si un referrer est un agent IA conversationnel. Retourne le source label ou null. */
export function detectAiReferrerSource(referrerUrl: string | null | undefined): string | null {
  if (!referrerUrl) return null;
  for (const { pattern, source } of AI_REFERRER_PATTERNS) {
    if (pattern.test(referrerUrl)) return source;
  }
  return null;
}

/**
 * Mapping action → champ compteur dénormalisé sur `ImageAsset`.
 * `share` n'a pas de compteur (volume bas, tracker via image_usage_logs seul).
 */
export const USAGE_COUNTER_FIELD: Record<UsageAction, keyof ImageAsset | null> = {
  view: "viewCount",
  download: "downloadCount",
  embed: "embedCount",
  share: null,
};

// ─── Types Prisma augmentés (relations) ──────────────────────────────────────

export type CategoryWithTranslations = ImageCategory & {
  translations: ImageCategoryTranslation[];
};

export type ImageWithTranslations = ImageAsset & {
  translations: ImageAssetTranslation[];
};

export type ImageWithRelations = ImageAsset & {
  translations: ImageAssetTranslation[];
  category?: CategoryWithTranslations | null;
};

// ─── Locale type ─────────────────────────────────────────────────────────────

export type ImageBankLocale = "fr" | "en";
