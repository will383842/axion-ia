/**
 * SSOT slugify — V-10 consolidation 2026-05-22 (sprint UX suggested polish).
 *
 * Remplace 9 implémentations dispersées (content-publish-worker, content-qa-extract-worker,
 * image-bank/upload.action, image-bank/utils/slug, lib/geo, content/transversal,
 * content/blog/index, app/[locale]/blog/page, lib/knowledge/toc-generator).
 *
 * Doctrine :
 * - NFD + strip diacritics + lowercase + kebab-case + trim
 * - Pas de dep externe (`slugify` npm) → no supply-chain risk
 * - Stable : algorithme identique à l'ancienne logique → 0 régression slugs DB existants
 * - Optionnel : strip stopwords FR (feature flag par opts)
 *
 * @example
 *   slugify("Comment auditer une IA d'entreprise à Paris")
 *   → "comment-auditer-une-ia-d-entreprise-a-paris"
 *
 *   slugify("Article — Édition 2026", { maxLen: 80 })
 *   → "article-edition-2026"
 *
 *   slugify("Le guide complet du RGPD", { stripStopwords: true })
 *   → "guide-complet-rgpd"
 */

const FRENCH_STOPWORDS = new Set([
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "de",
  "du",
  "d",
  "et",
  "ou",
  "a",
  "au",
  "aux",
  "en",
  "l",
  "the",
]);

export interface SlugifyOptions {
  /** Longueur max du slug (par défaut 80, aligné `ArticleTranslation.slug`). */
  readonly maxLen?: number;
  /** Strip stopwords FR + EN (défaut false — conserve l'algorithme historique). */
  readonly stripStopwords?: boolean;
  /** Fallback retourné si le résultat est vide (défaut "" — pas de fallback). */
  readonly fallback?: string;
  /** Strip nested HTML tags avant transformation (défaut false). Utilisé par TOC generator. */
  readonly stripHtml?: boolean;
}

/**
 * Slugifie une chaîne pour usage URL : kebab-case + ASCII safe + sans diacritiques.
 *
 * @param input chaîne à transformer (titre article, nom catégorie, etc.)
 * @param opts options de configuration
 * @returns slug ASCII-safe `[a-z0-9-]+`
 */
export function slugify(input: string, opts: SlugifyOptions = {}): string {
  const { maxLen = 80, stripStopwords = false, fallback = "", stripHtml = false } = opts;
  let normalized = input.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (stripHtml) {
    normalized = normalized.replace(/<[^>]+>/g, "");
  }
  let slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (stripStopwords && slug.length > 0) {
    slug = slug
      .split("-")
      .filter((word) => word.length > 0 && !FRENCH_STOPWORDS.has(word))
      .join("-");
  }
  slug = slug.slice(0, maxLen).replace(/-+$/, "");
  return slug.length > 0 ? slug : fallback;
}

/**
 * Valide qu'un slug respecte le format ASCII safe attendu en DB.
 * Utilisé par les refinements Zod côté admin upload.
 */
export function isValidSlug(slug: string, opts: { maxLen?: number } = {}): boolean {
  const { maxLen = 100 } = opts;
  const re = new RegExp(`^[a-z0-9][a-z0-9-]{0,${maxLen - 1}}$`);
  return re.test(slug);
}
