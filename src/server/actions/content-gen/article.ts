/**
 * Content Generator — Article CRUD admin (Fix P0-9/10/11 audit opérationnel
 * 2026-05-14).
 *
 * § 14 master prompt — workflow post-publication : éditer, demote (tier-1 →
 * tier-2), archive, restore, delete, rollback. Toutes les opérations passent
 * par `requireAdmin()`, revalident les paths impactés + ping IndexNow
 * (signalement Bing/Yandex pour les pages tier-1 modifiées ou supprimées).
 */

"use server";

import { Queue } from "bullmq";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { IndexationTier, PublishStatus } from "../../../../prisma/generated/client";
import { sanitizeContentGenHtml } from "@/server/content-gen/shared/html-sanitizer";
import { requireAdmin } from "./_auth";

function adminBase(): string {
  return `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen`;
}

let indexNowQueue: Queue | null = null;
function getIndexNowQueue(): Queue | null {
  if (indexNowQueue) return indexNowQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  indexNowQueue = new Queue("content-indexnow", { connection: { url: redisUrl } });
  return indexNowQueue;
}

/**
 * Ping IndexNow pour signaler à Bing/Yandex/Seznam un changement sur une URL
 * publique. Fire-and-forget — n'échoue pas si Redis absent.
 */
async function pingIndexNow(slug: string, isNews: boolean): Promise<void> {
  const queue = getIndexNowQueue();
  if (!queue) return;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return;
  const path = isNews ? `/fr/actualites/${slug}` : `/fr/blog/${slug}`;
  try {
    await queue.add(
      "ping",
      { urls: [`${siteUrl}${path}`], origin: "manual" as const },
      { jobId: `indexnow-${slug}-${Date.now()}` },
    );
  } catch {
    // best-effort
  }
}

// ============================================================
// Lecture
// ============================================================

export interface ArticleDetail {
  readonly id: string;
  readonly status: PublishStatus;
  readonly indexationTier: IndexationTier;
  readonly publishedAt: Date | null;
  readonly promotedAt: Date | null;
  readonly qualityScore: number | null;
  readonly seoScore: number | null;
  readonly isNews: boolean;
  readonly translation: {
    readonly id: string;
    readonly title: string;
    readonly slug: string;
    readonly excerpt: string | null;
    readonly body: string;
    readonly metaTitle: string | null;
    readonly metaDescription: string | null;
  } | null;
}

export async function getArticleDetail(id: string): Promise<ArticleDetail | null> {
  await requireAdmin();
  const a = await prisma.article.findUnique({
    where: { id },
    include: {
      translations: { where: { locale: "fr" }, take: 1 },
    },
  });
  if (!a) return null;
  const t = a.translations[0];
  return {
    id: a.id,
    status: a.status,
    indexationTier: a.indexationTier,
    publishedAt: a.publishedAt,
    promotedAt: a.promotedAt,
    qualityScore: a.qualityScore,
    seoScore: a.seoScore,
    isNews: a.isNews,
    translation: t
      ? {
          id: t.id,
          title: t.title,
          slug: t.slug,
          excerpt: t.excerpt,
          body: t.body,
          metaTitle: t.metaTitle,
          metaDescription: t.metaDescription,
        }
      : null,
  };
}

// ============================================================
// Modification (P0-9 M1 / P6)
// ============================================================

export interface UpdateArticleInput {
  readonly articleId: string;
  readonly title: string;
  readonly slug?: string; // changement slug = redirect 301 V2
  readonly excerpt?: string;
  readonly body: string; // HTML (sanitized)
  readonly metaTitle?: string;
  readonly metaDescription?: string;
}

export async function updateArticle(input: UpdateArticleInput): Promise<void> {
  await requireAdmin();
  if (input.title.length < 3 || input.title.length > 255) throw new Error("title_length");
  if (input.body.length < 50) throw new Error("body_too_short");
  if (input.metaTitle && input.metaTitle.length > 70) throw new Error("meta_title_length");
  if (input.metaDescription && input.metaDescription.length > 160)
    throw new Error("meta_description_length");

  // Sanitize HTML pour éviter XSS persisté (même règle que content-publish-worker).
  const cleanBody = sanitizeContentGenHtml(input.body);

  const article = await prisma.article.findUnique({
    where: { id: input.articleId },
    include: { translations: { where: { locale: "fr" }, take: 1 } },
  });
  if (!article) throw new Error("article_not_found");
  const t = article.translations[0];
  if (!t) throw new Error("translation_fr_not_found");

  const newSlug = input.slug && input.slug.length > 0 ? input.slug : t.slug;
  await prisma.$transaction([
    prisma.articleTranslation.update({
      where: { id: t.id },
      data: {
        title: input.title,
        slug: newSlug,
        body: cleanBody,
        excerpt: input.excerpt ?? null,
        metaTitle: input.metaTitle ?? null,
        metaDescription: input.metaDescription ?? null,
      },
    }),
    prisma.article.update({
      where: { id: input.articleId },
      data: { updatedAt: new Date() },
    }),
  ]);

  // Revalidate paths impactés + IndexNow ping si tier-1 indexable
  revalidatePath(`/fr/blog/${t.slug}`);
  if (newSlug !== t.slug) revalidatePath(`/fr/blog/${newSlug}`);
  if (article.isNews) {
    revalidatePath(`/fr/actualites/${t.slug}`);
    if (newSlug !== t.slug) revalidatePath(`/fr/actualites/${newSlug}`);
  }
  revalidatePath("/sitemap.xml");
  revalidatePath(`${adminBase()}/publications`);

  if (article.status === "published" && article.indexationTier === "tier_1_indexable") {
    await pingIndexNow(newSlug, article.isNews);
  }
}

// ============================================================
// Demote tier-1 → tier-2 (P0-10 D2)
// ============================================================

export async function demoteArticle(articleId: string): Promise<void> {
  await requireAdmin();
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { translations: { where: { locale: "fr" }, take: 1 } },
  });
  if (!article) throw new Error("article_not_found");
  if (article.indexationTier !== "tier_1_indexable") {
    throw new Error("article_not_tier_1");
  }

  await prisma.article.update({
    where: { id: articleId },
    data: {
      indexationTier: "tier_2_noindex_follow",
      promotedAt: null,
    },
  });

  const t = article.translations[0];
  if (t) {
    revalidatePath(`/fr/blog/${t.slug}`);
    if (article.isNews) revalidatePath(`/fr/actualites/${t.slug}`);
    revalidatePath("/sitemap.xml");
    // IndexNow signal "URL_DELETED" via simple ping (Bing détectera noindex à
    // la prochaine visite). Pas de delta sémantique au-delà du re-ping.
    await pingIndexNow(t.slug, article.isNews);
  }
  revalidatePath(`${adminBase()}/publications`);
}

// ============================================================
// Archive manuel (P0-11 D5)
// ============================================================

export async function archiveArticle(articleId: string): Promise<void> {
  await requireAdmin();
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { translations: { where: { locale: "fr" }, take: 1 } },
  });
  if (!article) throw new Error("article_not_found");
  if (article.status === "archived") return; // idempotent

  await prisma.article.update({
    where: { id: articleId },
    data: {
      status: "archived",
      indexationTier: "tier_3_noindex_nofollow", // archived → noindex+nofollow
    },
  });

  const t = article.translations[0];
  if (t) {
    revalidatePath(`/fr/blog/${t.slug}`);
    if (article.isNews) revalidatePath(`/fr/actualites/${t.slug}`);
    revalidatePath("/sitemap.xml");
    await pingIndexNow(t.slug, article.isNews);
  }
  revalidatePath(`${adminBase()}/publications`);
}

// ============================================================
// Restore archived (P1-9 R5)
// ============================================================

export async function unarchiveArticle(articleId: string): Promise<void> {
  await requireAdmin();
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { translations: { where: { locale: "fr" }, take: 1 } },
  });
  if (!article) throw new Error("article_not_found");
  if (article.status !== "archived") throw new Error("article_not_archived");

  await prisma.article.update({
    where: { id: articleId },
    data: {
      status: "published",
      indexationTier: "tier_2_noindex_follow", // restore en tier-2 par sécurité
    },
  });

  const t = article.translations[0];
  if (t) {
    revalidatePath(`/fr/blog/${t.slug}`);
    if (article.isNews) revalidatePath(`/fr/actualites/${t.slug}`);
    revalidatePath("/sitemap.xml");
  }
  revalidatePath(`${adminBase()}/publications`);
}

// ============================================================
// Suppression définitive (P0/D6 — destructif, double-confirm UI)
// ============================================================

export async function deleteArticle(articleId: string, confirmation: string): Promise<void> {
  await requireAdmin();
  // Anti-clic accidentel : impose une chaîne de confirmation côté UI.
  if (confirmation !== "DELETE") throw new Error("confirmation_required");

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { translations: { where: { locale: "fr" }, take: 1 } },
  });
  if (!article) throw new Error("article_not_found");

  // Cascade Prisma : ArticleTranslation supprimée (onDelete: Cascade).
  // FAQ.parentArticleId → SetNull (préserve les Q/R post-process).
  // ContentCitation.articleId → SetNull.
  // ContentGenJob.outputBlogPostId reste (audit trail).
  await prisma.article.delete({ where: { id: articleId } });

  const t = article.translations[0];
  if (t) {
    revalidatePath(`/fr/blog/${t.slug}`);
    if (article.isNews) revalidatePath(`/fr/actualites/${t.slug}`);
    revalidatePath("/sitemap.xml");
    await pingIndexNow(t.slug, article.isNews);
  }
  revalidatePath(`${adminBase()}/publications`);
}

// ============================================================
// Rollback (P1-8 R1) — V1 = unpublish + revert tier
// ============================================================

/**
 * Rollback Article publié : repasse en `draft` + `tier_3` (caché des sitemaps
 * + robots noindex). Pas de versioning history V1 (table ContentPublication
 * snapshot reportée V2). Will pourra re-générer le contenu ou éditer.
 *
 * Pour conserver l'historique de publication, on garde `publishedAt`
 * inchangé (sert d'audit trail) mais `status='draft'` + `tier_3`.
 */
export async function rollbackArticle(articleId: string): Promise<void> {
  await requireAdmin();
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { translations: { where: { locale: "fr" }, take: 1 } },
  });
  if (!article) throw new Error("article_not_found");
  if (article.status !== "published") throw new Error("article_not_published");

  await prisma.article.update({
    where: { id: articleId },
    data: {
      status: "draft",
      indexationTier: "tier_3_noindex_nofollow",
      promotedAt: null,
    },
  });

  const t = article.translations[0];
  if (t) {
    revalidatePath(`/fr/blog/${t.slug}`);
    if (article.isNews) revalidatePath(`/fr/actualites/${t.slug}`);
    revalidatePath("/sitemap.xml");
    await pingIndexNow(t.slug, article.isNews);
  }
  revalidatePath(`${adminBase()}/publications`);
}
