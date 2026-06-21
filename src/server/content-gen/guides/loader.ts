/**
 * Content Generator — Guide pilier loader (Batch 3.A audit 2026-05-15 P0-7).
 *
 * Source de vérité pour les pages `/fr/guides/[slug]`. V1 minimal :
 *   - Lit Article DB-driven par slug + locale via `findArticleBySlug`.
 *   - Filtre côté loader : `templateVariant` matchant pattern guide.
 *   - Retourne `null` si non guide ou non trouvé.
 *
 * Steps HowTo : V1 = parsing heuristique du body (lignes commençant par
 * `Étape N`, `1.`, `1)` ou `## Étape`). Cible précise du JSON-LD = Batch 3.C
 * (pipeline 2-step `guide_pilier` qui produira un champ `guideSteps` JSON
 * structuré dans Article — migration Prisma à venir).
 *
 * Pas d'index sitemap V1 (la sub-sitemap dédiée arrive après que Batch 3.C
 * livre des guides authentiques avec steps fiables — éviter de polluer
 * Search Console avec des "guides" qui sont en fait des landing pages).
 */

import type { Locale } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { parseFaqItems, type FaqItem } from "@/server/content-gen/shared/faq-items";

export interface GuideStep {
  readonly position: number;
  readonly name: string;
  readonly text: string;
}

export interface GuideArticleView {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly body: string;
  readonly publishedAt: Date;
  readonly updatedAt: Date;
  readonly tier: "tier_1_indexable" | "tier_2_noindex_follow" | "tier_3_noindex_nofollow";
  readonly steps: ReadonlyArray<GuideStep>;
  readonly hasStructuredSteps: boolean;
  readonly readingTimeMinutes: number;
  /** FAQ structurée (Article.faqJson) — accordéon + FAQPage (chantier 2026-06-21). */
  readonly faqItems: ReadonlyArray<FaqItem>;
  /** Sources citées (ContentCitation) — section Sources & méthodologie visible. */
  readonly citations: ReadonlyArray<{ name: string; url: string }>;
  /** Héros Unsplash (Article.featuredImage) — avant : aucune image sur /guides. */
  readonly featuredImage: string | null;
  readonly featuredImageAlt: string | null;
  /** Attribution Unsplash (CGU §6) — null si pas de photo Unsplash. */
  readonly photographerName: string | null;
  readonly photographerUrl: string | null;
}

const GUIDE_TEMPLATE_VARIANT_PATTERNS = ["guide", "guide_pilier"];

/**
 * Vérifie qu'un Article est de type guide via `templateVariant` ou
 * convention slug commençant par `guide-`. Volontairement permissif V1
 * pour absorber les variations de template.
 */
function isGuideArticle(templateVariant: string | null, slug: string): boolean {
  if (slug.startsWith("guide-") || slug.startsWith("guide_")) return true;
  if (!templateVariant) return false;
  const lower = templateVariant.toLowerCase();
  return GUIDE_TEMPLATE_VARIANT_PATTERNS.some((p) => lower.includes(p));
}

/**
 * Heuristique parsing du body pour extraire les étapes.
 *
 * Patterns reconnus (ordre de priorité) :
 *  1. `## Étape N : Titre` / `## Step N: Title` (markdown headings)
 *  2. `Étape N : Titre` / `Step N: Title` en début de ligne
 *  3. `N. Titre` ou `N) Titre` (énumération numérique)
 *
 * Chaque étape capture le titre + le texte qui suit jusqu'au prochain marqueur.
 * Retourne tableau vide si aucun pattern matché (fallback Article JSON-LD).
 */
function parseStepsFromBody(body: string): ReadonlyArray<GuideStep> {
  if (!body || body.length < 50) return [];

  // Pattern 1+2 : "Étape N" / "Step N"
  const etapeRegex =
    /(?:^|\n)\s*#{0,3}\s*(?:Étape|Step)\s+(\d+)\s*[:.\-—]\s*(.+?)(?=\n\s*#{0,3}\s*(?:Étape|Step)\s+\d+|\n\n|$)/gis;
  const etapeMatches = [...body.matchAll(etapeRegex)];
  if (etapeMatches.length >= 2) {
    return etapeMatches.map((m, idx) => {
      const fullChunk = m[2] ?? "";
      const lines = fullChunk.split("\n");
      const name = (lines[0] ?? "").trim().slice(0, 110);
      const text = lines.slice(1).join("\n").trim().slice(0, 1200) || name;
      return {
        position: parseInt(m[1] ?? `${idx + 1}`, 10) || idx + 1,
        name: name || `Étape ${idx + 1}`,
        text,
      };
    });
  }

  // Pattern 3 : "N. Titre" / "N) Titre" (besoin ≥ 3 occurrences pour être sûr)
  const numRegex = /(?:^|\n)\s*(\d+)[.)]\s+(.+?)(?=\n\s*\d+[.)]|\n\n|$)/gs;
  const numMatches = [...body.matchAll(numRegex)];
  if (numMatches.length >= 3) {
    return numMatches.slice(0, 12).map((m, idx) => {
      const fullChunk = m[2] ?? "";
      const text = fullChunk.trim().slice(0, 1200);
      const name =
        text
          .split(/[.!?\n]/)[0]
          ?.trim()
          .slice(0, 110) || `Étape ${idx + 1}`;
      return {
        position: parseInt(m[1] ?? `${idx + 1}`, 10) || idx + 1,
        name,
        text,
      };
    });
  }

  return [];
}

function estimateReadingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export async function loadGuideForView(
  slug: string,
  locale: Locale,
): Promise<GuideArticleView | null> {
  if (locale !== "fr") {
    // V1 doctrine : contenus generated FR-only. Guides EN reportés.
    return null;
  }

  const translation = await prisma.articleTranslation
    .findFirst({
      where: { slug, locale },
      include: { article: true },
    })
    .catch(() => null);

  if (!translation || translation.article.status !== "published") return null;

  if (!isGuideArticle(translation.article.templateVariant, translation.slug)) {
    return null;
  }

  const body = translation.body || translation.bodyText || "";
  const steps = parseStepsFromBody(body);

  // Chantier templates 2026-06-21 — sources citées (visibles + nofollow).
  const rawCitations = await prisma.contentCitation
    .findMany({
      where: { articleId: translation.article.id },
      include: { externalReference: { select: { url: true, title: true } } },
    })
    .catch(() => []);

  return {
    slug: translation.slug,
    title: translation.title,
    excerpt: translation.metaDescription ?? "",
    body,
    publishedAt: translation.article.publishedAt ?? translation.article.createdAt,
    updatedAt: translation.updatedAt,
    tier: translation.article.indexationTier,
    steps,
    hasStructuredSteps: steps.length >= 2,
    readingTimeMinutes: estimateReadingTime(body),
    // Chantier templates 2026-06-21 — FAQ (jamais rendue) + sources visibles.
    faqItems: parseFaqItems(translation.article.faqJson),
    citations: rawCitations.map((c) => ({
      name: c.externalReference.title,
      url: c.externalReference.url,
    })),
    // Chantier templates 2026-06-21 — héros Unsplash (avant : aucune image).
    featuredImage: translation.article.featuredImage ?? null,
    featuredImageAlt: translation.article.featuredImageAlt ?? null,
    photographerName: translation.article.featuredImagePhotographerName ?? null,
    photographerUrl: translation.article.featuredImagePhotographerUrl ?? null,
  };
}

/** Vue résumée d'un guide pour le hub `/guides`. */
export interface GuideSummaryView {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly publishedAt: Date;
  readonly updatedAt: Date;
  readonly readingTimeMinutes: number;
}

/**
 * Liste tous les guides piliers publiés (tier_1_indexable + tier_2 follow),
 * triés par `publishedAt DESC`. Lit `Article.templateVariant` matchant
 * `guide-pilier` / `guide_pilier` (legacy prefix `_` accepté) OU slug
 * commençant par `guide-` / `guide_`.
 *
 * Build-time safe : si Prisma stub.invalid (build GH Actions) ou DB down,
 * retourne `[]` — le hub affichera son empty state premium.
 *
 * FR uniquement V1 (doctrine v1.2 — contenus content-gen FR-only).
 */
export async function loadGuidesIndexForView(
  locale: Locale,
  options: { readonly limit?: number } = {},
): Promise<ReadonlyArray<GuideSummaryView>> {
  if (locale !== "fr") return [];
  const limit = Math.min(options.limit ?? 50, 200);

  try {
    const rows = await prisma.article.findMany({
      where: {
        status: "published",
        OR: [
          { templateVariant: { contains: "guide", mode: "insensitive" } },
          { translations: { some: { locale: "fr", slug: { startsWith: "guide-" } } } },
        ],
      },
      include: {
        translations: { where: { locale: "fr" }, take: 1 },
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      take: limit,
    });

    const views: GuideSummaryView[] = [];
    for (const a of rows) {
      const t = a.translations[0];
      if (!t) continue;
      if (!isGuideArticle(a.templateVariant, t.slug)) continue;
      const bodyForReadingTime = t.body || t.bodyText || "";
      views.push({
        slug: t.slug,
        title: t.title,
        excerpt: t.metaDescription ?? "",
        publishedAt: a.publishedAt ?? a.createdAt,
        updatedAt: t.updatedAt,
        readingTimeMinutes: estimateReadingTime(bodyForReadingTime),
      });
    }
    return views;
  } catch {
    // Build SSG sans DB (stub.invalid) ou DB down — empty state premium.
    return [];
  }
}
