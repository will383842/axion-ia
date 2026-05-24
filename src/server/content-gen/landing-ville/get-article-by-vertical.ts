/**
 * Fetcher Article landing-ville × verticale (Sprint v7 Phase 5 commit 2).
 *
 * Résout l'Article publié pour une combinaison (villeSlug, verticale, locale).
 * Convention : l'Article a été généré par le worker à partir d'un
 * `ContentGenJob` avec `anchorVilleSlug = villeSlug`, `contentType = landing_ville`,
 * `templateVariant = verticale`. La FK `Article.generatedByJobId` permet le join.
 *
 * Pattern double-query (Prisma : pas de @relation déclarée FK→PK pour
 * `generatedByJobId` car FK soft / cuid String vs Uuid) :
 *   1. Trouve le dernier ContentGenJob.published matchant la triple clé
 *   2. Récupère l'Article correspondant + translation locale
 *
 * Returns null si :
 *   - aucun job publié pour cette combinaison
 *   - article existe mais pas de translation pour la locale demandée
 *   - article status ≠ published (en review / draft / archived)
 */

import { prisma } from "@/lib/prisma";
import type { LandingVilleVerticalSlug } from "@/server/content-gen/generators/landing-ville-shared";
import type { Locale } from "@/i18n/routing";

export interface LandingVilleArticleByVerticalResult {
  readonly articleId: string;
  readonly slug: string;
  readonly title: string;
  readonly metaTitle: string | null;
  readonly metaDescription: string | null;
  readonly excerpt: string | null;
  readonly body: string;
  readonly bodyText: string | null;
  readonly publishedAt: Date | null;
  readonly readingTime: number | null;
  readonly directAnswer: string | null;
  readonly faqJson: unknown;
  readonly indexationTier: string;
  readonly qualityScore: number | null;
  readonly featuredImage: string | null;
  readonly kbChunkIds: ReadonlyArray<string>;
}

export async function getLandingVilleArticleByVertical(
  villeSlug: string,
  verticale: LandingVilleVerticalSlug,
  locale: Locale,
): Promise<LandingVilleArticleByVerticalResult | null> {
  // Build-time stub (cf. AGENTS.md § Build externalisé) — short-circuit pour
  // éviter call DB durant SSG GH Actions (DATABASE_URL=stub.invalid).
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return null;

  const job = await prisma.contentGenJob.findFirst({
    where: {
      anchorVilleSlug: villeSlug,
      contentType: "landing_ville",
      // Le templateVariant stocké côté job = vertical slug (les 5 generators
      // Phase 5 commit 1 dispatch via input.templateVariant).
      inputPayload: { path: ["templateVariant"], equals: verticale },
      status: "published",
    },
    orderBy: { completedAt: "desc" },
    select: { id: true },
  });

  // Fallback : certains generators legacy mettent templateVariant directement
  // sur la row ContentGenJob (champ scalaire si présent dans le schema futur).
  // Pour V1 le filtre inputPayload JSON suffit. Si non trouvé, return null.
  if (!job) return null;

  const article = await prisma.article.findFirst({
    where: {
      generatedByJobId: job.id,
      status: "published",
    },
    include: {
      translations: {
        where: { locale },
        take: 1,
      },
    },
  });

  if (!article) return null;
  const translation = article.translations[0];
  if (!translation) return null;

  return {
    articleId: article.id,
    slug: translation.slug,
    title: translation.title,
    metaTitle: translation.metaTitle,
    metaDescription: translation.metaDescription,
    excerpt: translation.excerpt,
    body: translation.body,
    bodyText: translation.bodyText,
    publishedAt: article.publishedAt,
    readingTime: article.readingTime,
    directAnswer: article.directAnswer,
    faqJson: article.faqJson,
    indexationTier: article.indexationTier,
    qualityScore: article.qualityScore,
    featuredImage: article.featuredImage,
    kbChunkIds: article.kbChunkIds,
  };
}
