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

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { IndexationTier, PublishStatus } from "../../../../prisma/generated/client";
import { sanitizeContentGenHtml } from "@/server/content-gen/shared/html-sanitizer";
import { logActivity } from "@/server/content-gen/shared/activity-log";
import {
  enqueueIndexingForTier1,
  enqueueIndexingForUrls,
  type IndexingLifecycleEvent,
} from "@/server/content-gen/indexing/enqueue";
import { buildArticleUrl } from "@/server/content-gen/indexing/url-builder";
// Note : audit indexation 2026-05-15 P0-5 — `recordArticleSlugChange` helper
// existe (slug-history.ts) pour les callers qui n'ont pas accès à une tx
// Prisma (futur admin-case-studies/admin-help). Ici on utilise directement
// `tx.articleSlugHistory.create` dans la transaction `updateArticle` ci-dessous
// pour atomicité avec l'update slug.
import { requireAdmin } from "./_auth";

// Sprint Final P1-3 — Zod runtime validation des inputs Server Actions.
const ArticleIdSchema = z.string().min(1).max(64);
// P0-11 — thumbs feedback input schema
const SubmitFeedbackInputSchema = z
  .object({
    articleId: z.string().cuid(),
    type: z.enum(["thumbs_up", "thumbs_down"]),
    comment: z.string().max(500).optional(),
  })
  .strict();
const UpdateArticleInputSchema = z
  .object({
    articleId: ArticleIdSchema,
    title: z.string().min(3).max(255),
    slug: z
      .string()
      .max(255)
      .regex(/^[a-z0-9-]*$/, "slug doit être [a-z0-9-]")
      .optional(),
    excerpt: z.string().max(2000).optional(),
    body: z.string().min(50).max(500_000),
    metaTitle: z.string().max(70).optional(),
    metaDescription: z.string().max(160).optional(),
  })
  .strict();
const DeleteArticleConfirmationSchema = z.literal("DELETE");

function adminBase(): string {
  return `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen`;
}

/**
 * P1-10 (audit re-run 2026-05-15 AGENT 4) — délègue à `enqueueIndexingForTier1`
 * (SSOT dispatcher Sprint 9 V2). Avant : shadow local `pingIndexNow` + Queue
 * BullMQ direct → 6 implémentations IndexNow distinctes, divergence URL
 * builder, pas de Google Indexing API en parallèle, jobId timestamp non
 * idempotent.
 *
 * Maintenant : tous les admin actions (update/demote/archive/delete/rollback)
 * passent par le SSOT qui couvre :
 *   - URL via `buildArticleUrl()` SSOT
 *   - IndexNow enqueue si INDEXNOW_KEY set
 *   - Google Indexing API enqueue si GOOGLE_INDEXING_API_ENABLED=true
 *   - jobId déterministe (`indexnow-${articleId}` + `google-indexing-${articleId}`)
 *     → BullMQ dédoublonne automatiquement si re-enqueued rapidement
 *
 * Fire-and-forget, n'échoue jamais (déjà géré dans `enqueueIndexingForTier1`).
 */
async function pingIndexing(
  articleId: string,
  slug: string,
  isNews: boolean,
  lifecycleEvent: IndexingLifecycleEvent = "update",
): Promise<void> {
  try {
    await enqueueIndexingForTier1({
      articleId,
      slug,
      isNews,
      origin: "manual",
      lifecycleEvent,
    });
  } catch {
    // best-effort — le helper ne devrait pas throw, mais double-guard.
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
  // Sprint Final P1-3 — Zod runtime validation.
  ArticleIdSchema.parse(id);
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
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation (structurel) avant les checks métier.
  UpdateArticleInputSchema.parse(input);
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
  const slugChanged = newSlug !== t.slug;
  await prisma.$transaction(async (tx) => {
    // Audit indexation 2026-05-15 P0-5 — créer l'historique slug AVANT update
    // pour préserver l'ancien slug (rename perte SEO zéro). FR-only V1.
    if (slugChanged) {
      await tx.articleSlugHistory.create({
        data: {
          articleId: input.articleId,
          oldSlug: t.slug,
          oldLocale: "fr",
          reason: `rename_via_updateArticle:${session.userId}`,
        },
      });
    }
    await tx.articleTranslation.update({
      where: { id: t.id },
      data: {
        title: input.title,
        slug: newSlug,
        body: cleanBody,
        excerpt: input.excerpt ?? null,
        metaTitle: input.metaTitle ?? null,
        metaDescription: input.metaDescription ?? null,
      },
    });
    await tx.article.update({
      where: { id: input.articleId },
      data: { updatedAt: new Date() },
    });
  });

  // Revalidate paths impactés + IndexNow ping si tier-1 indexable
  revalidatePath(`/fr/blog/${t.slug}`);
  if (slugChanged) revalidatePath(`/fr/blog/${newSlug}`);
  if (article.isNews) {
    revalidatePath(`/fr/actualites/${t.slug}`);
    if (slugChanged) revalidatePath(`/fr/actualites/${newSlug}`);
  }
  revalidatePath("/sitemap.xml");
  revalidatePath(`${adminBase()}/publications`);

  if (article.status === "published" && article.indexationTier === "tier_1_indexable") {
    // Audit indexation 2026-05-15 P0-5/P0-6 — ping nouveau URL en `update` +
    // ancien URL en `delete` si rename (signal Google URL_DELETED → désindexe
    // l'ancien slug en ~24h tout en faisant remonter le nouveau via redirect 301).
    await pingIndexing(article.id, newSlug, article.isNews, "update");
    if (slugChanged) {
      const oldUrl = buildArticleUrl({ slug: t.slug, isNews: article.isNews, locale: "fr" });
      try {
        await enqueueIndexingForUrls({
          entityId: `${article.id}-old`,
          urls: [oldUrl],
          origin: "manual",
          lifecycleEvent: "delete",
        });
      } catch {
        // best-effort
      }
    }
  }
  await logActivity({
    session,
    action: "content-gen.article.update",
    targetType: "Article",
    targetId: input.articleId,
    changes: {
      titleChanged: input.title !== t.title,
      slugChanged: newSlug !== t.slug,
      bodyLen: cleanBody.length,
    },
  });
}

// ============================================================
// Demote tier-1 → tier-2 (P0-10 D2)
// ============================================================

export async function demoteArticle(articleId: string): Promise<void> {
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  ArticleIdSchema.parse(articleId);
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
    // Audit indexation 2026-05-15 P0-6 — demote tier-1 → tier-2 = page sort du
    // sitemap indexable. Signal Google `URL_DELETED` pour désindexation rapide
    // (~24h vs ~6 mois en attente naturelle).
    await pingIndexing(article.id, t.slug, article.isNews, "delete");
  }
  revalidatePath(`${adminBase()}/publications`);
  await logActivity({
    session,
    action: "content-gen.article.demote",
    targetType: "Article",
    targetId: articleId,
    changes: { transition: "tier_1→tier_2" },
  });
}

// ============================================================
// Archive manuel (P0-11 D5)
// ============================================================

export async function archiveArticle(articleId: string): Promise<void> {
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  ArticleIdSchema.parse(articleId);
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
    // Audit indexation 2026-05-15 P0-6 — archive → URL retirée du sitemap +
    // status=archived → 410 Gone côté route handler. Signal Google `URL_DELETED`.
    await pingIndexing(article.id, t.slug, article.isNews, "delete");
  }
  revalidatePath(`${adminBase()}/publications`);
  await logActivity({
    session,
    action: "content-gen.article.archive",
    targetType: "Article",
    targetId: articleId,
    changes: { transition: "published→archived+tier_3" },
  });
}

// ============================================================
// Restore archived (P1-9 R5)
// ============================================================

export async function unarchiveArticle(articleId: string): Promise<void> {
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  ArticleIdSchema.parse(articleId);
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
  await logActivity({
    session,
    action: "content-gen.article.unarchive",
    targetType: "Article",
    targetId: articleId,
    changes: { transition: "archived→published+tier_2" },
  });
}

// ============================================================
// Suppression définitive (P0/D6 — destructif, double-confirm UI)
// ============================================================

export async function deleteArticle(articleId: string, confirmation: string): Promise<void> {
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  ArticleIdSchema.parse(articleId);
  DeleteArticleConfirmationSchema.parse(confirmation);
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
    // Audit indexation 2026-05-15 P0-6 — delete = disparition définitive. Signal
    // Google `URL_DELETED` pour désindexation rapide (la table DB est purgée,
    // la page renvoie 404 ; les pages archived renvoient 410, cf. P0-7).
    await pingIndexing(article.id, t.slug, article.isNews, "delete");
  }
  revalidatePath(`${adminBase()}/publications`);
  await logActivity({
    session,
    action: "content-gen.article.delete",
    targetType: "Article",
    targetId: articleId,
    changes: { destructive: true, isNews: article.isNews },
  });
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
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  ArticleIdSchema.parse(articleId);
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
    // Audit indexation 2026-05-15 P0-6 — rollback published→draft+tier_3 = page
    // sort du sitemap indexable. Signal Google `URL_DELETED`.
    await pingIndexing(article.id, t.slug, article.isNews, "delete");
  }
  revalidatePath(`${adminBase()}/publications`);
  await logActivity({
    session,
    action: "content-gen.article.rollback",
    targetType: "Article",
    targetId: articleId,
    changes: { transition: "published→draft+tier_3" },
  });
}

// ============================================================
// Thumbs feedback (P0-11 — D-P5-8, V5-08)
// ============================================================

export interface SubmitFeedbackInput {
  readonly articleId: string;
  readonly type: "thumbs_up" | "thumbs_down";
  readonly comment?: string;
}

export interface SubmitFeedbackResult {
  readonly created: boolean;
  readonly message: string;
}

/**
 * Enregistre un feedback thumbs up/down sur un article publié.
 *
 * Protection doublon : 1 feedback par (articleId × userId). Si un feedback
 * existe déjà pour ce binôme, on throw `feedback_already_submitted` pour que
 * l'UI puisse afficher un état "déjà voté".
 *
 * Le `userId` est l'email admin (session.userId = cuid DB ; session.email pour
 * lisibilité dans l'audit log). On stocke session.userId en colonne `user_id`
 * pour rester cohérent avec le schéma existant (VARCHAR 255).
 */
export async function submitArticleFeedback(
  input: SubmitFeedbackInput,
): Promise<SubmitFeedbackResult> {
  const session = await requireAdmin();
  // P0-11 — Zod runtime validation.
  SubmitFeedbackInputSchema.parse(input);

  // Protection doublon : vérifie si un feedback existe déjà pour cet articleId + userId.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await (prisma as any).articleFeedback.findFirst({
    where: { articleId: input.articleId, userId: session.userId },
    select: { id: true },
  });
  if (existing) {
    throw new Error("feedback_already_submitted");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).articleFeedback.create({
    data: {
      articleId: input.articleId,
      userId: session.userId,
      type: input.type,
      comment: input.comment ?? null,
    },
  });

  await logActivity({
    session,
    action: "content-gen.article.feedback",
    targetType: "Article",
    targetId: input.articleId,
    changes: { type: input.type, hasComment: Boolean(input.comment) },
  });

  return { created: true, message: "feedback_recorded" };
}
