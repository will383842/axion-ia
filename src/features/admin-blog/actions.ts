// Server Actions admin /blog (M9 Tier 2 section 4 — ordre canon CLAUDE.md §14).
//
// Architecture multilingue option (b) — table ArticleTranslation séparée
// (CLAUDE.md §13 + addendum v4) : 1 Article structurel + N ArticleTranslation
// (locale + slug + title + body + excerpt + meta). Slug unique par locale.
//
// Tiptap editor cote client (body riche HTML). IndexNow ping a la publication
// (V1 placeholder — branchement complet en M9 v2 quand IndexNow valide la
// nouvelle URL).

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { adminPath } from "@/lib/admin-path";
import { pingIndexNow } from "@/lib/indexnow";
import { enqueueIndexingForUrls } from "@/server/content-gen/indexing/enqueue";
import type { Locale, PublishStatus } from "../../../prisma/generated/client";

async function requireAdminWrite() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin" && role !== "editor") {
    throw new Error("forbidden");
  }
  return { userId: session.user.id, role };
}
async function requireAdminRead() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  return session.user.id;
}

// ============================================================
// list
// ============================================================

const listSchema = z.object({
  status: z.enum(["draft", "published", "archived", "all"]).default("all"),
  authorSlug: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  tagSlug: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});
export type ListArticlesInput = z.infer<typeof listSchema>;

export async function listArticlesAction(input: Partial<ListArticlesInput> = {}) {
  await requireAdminRead();
  const parsed = listSchema.parse(input);
  const where: Record<string, unknown> = {};
  if (parsed.status !== "all") where.status = parsed.status;
  if (parsed.categoryId) where.categoryId = parsed.categoryId;
  if (parsed.authorSlug) where.author = { slug: parsed.authorSlug };
  if (parsed.tagSlug) where.tags = { some: { tag: { slug: parsed.tagSlug } } };
  if (parsed.search && parsed.search.length >= 2) {
    where.translations = {
      some: { title: { contains: parsed.search, mode: "insensitive" } },
    };
  }

  const [total, items] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      skip: (parsed.page - 1) * parsed.pageSize,
      take: parsed.pageSize,
      select: {
        id: true,
        status: true,
        publishedAt: true,
        readingTime: true,
        viewsCount: true,
        author: { select: { name: true, slug: true } },
        category: { select: { nameFr: true, slug: true } },
        translations: {
          where: { locale: "fr" },
          select: { title: true, slug: true },
        },
        _count: { select: { tags: true } },
        updatedAt: true,
      },
    }),
  ]);
  return {
    items,
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
    totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)),
  };
}

export async function getArticleDetailAction(id: string) {
  await requireAdminRead();
  return prisma.article.findUnique({
    where: { id },
    include: {
      translations: { orderBy: { locale: "asc" } },
      tags: { include: { tag: true } },
      author: { select: { id: true, slug: true, name: true } },
      category: { select: { id: true, slug: true, nameFr: true } },
    },
  });
}

/** Selects helpers — pour les selects authors/categories/tags du form. */
export async function listAuthorsAction() {
  await requireAdminRead();
  return prisma.author.findMany({
    select: { id: true, slug: true, name: true },
    orderBy: { name: "asc" },
  });
}
export async function listBlogCategoriesAction() {
  await requireAdminRead();
  return prisma.category.findMany({
    where: { module: null, status: "published" },
    select: { id: true, slug: true, nameFr: true },
    orderBy: { displayOrder: "asc" },
  });
}
export async function listAllTagsAction() {
  await requireAdminRead();
  return prisma.articleTag.findMany({
    select: { id: true, slug: true, nameFr: true },
    orderBy: { nameFr: "asc" },
  });
}

// ============================================================
// upsert
// ============================================================

const slugRegex = /^[a-z0-9-]+$/;
const slugSchema = z.string().min(3).max(255).regex(slugRegex);

// Sprint 24 / C4 : Tiptap fournit 3 sources (HTML rendu / JSON canon / text plain).
// JSON arrive en string serialise — on le re-parse server-side puis on persiste.
const tiptapJsonString = z
  .string()
  .optional()
  .transform((v) => {
    if (!v) return null;
    try {
      return JSON.parse(v) as unknown;
    } catch {
      return null;
    }
  });

const translationSchema = z.object({
  locale: z.enum(["fr", "en"]),
  title: z.string().min(3).max(255),
  slug: slugSchema,
  excerpt: z.string().max(500).optional(),
  body: z.string().min(10), // HTML brut Tiptap
  bodyJson: tiptapJsonString,
  bodyText: z.string().optional(),
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(160).optional(),
  ogImage: z.string().url().optional().or(z.literal("")),
});

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  authorId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  featuredImage: z.string().url().optional().or(z.literal("")),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  publishedAt: z.string().optional(), // ISO date — peut etre future (programmer)
  readingTime: z.coerce.number().int().min(0).optional(),
  commentsEnabled: z.coerce.boolean().default(false),
  fr: translationSchema,
  en: translationSchema,
  tagIds: z.array(z.string().uuid()).default([]),
});
export type UpsertArticleState =
  { ok: true; id: string; created: boolean } | { ok: false; error: string };

export async function upsertArticleAction(
  _prev: UpsertArticleState,
  formData: FormData,
): Promise<UpsertArticleState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }

  const tagIdsRaw = formData.getAll("tagIds");
  const tagIds = tagIdsRaw.filter((v): v is string => typeof v === "string");

  const parsed = upsertSchema.safeParse({
    id: formData.get("id") || undefined,
    authorId: formData.get("authorId") || null,
    categoryId: formData.get("categoryId") || null,
    featuredImage: formData.get("featuredImage") || "",
    status: formData.get("status") || "draft",
    publishedAt: formData.get("publishedAt") || undefined,
    readingTime: formData.get("readingTime") || undefined,
    commentsEnabled: formData.get("commentsEnabled") === "on",
    tagIds,
    fr: {
      locale: "fr",
      title: formData.get("fr_title"),
      slug: formData.get("fr_slug"),
      excerpt: formData.get("fr_excerpt") || undefined,
      body: formData.get("fr_body_html"),
      bodyJson: formData.get("fr_body_json") || undefined,
      bodyText: formData.get("fr_body_text") || undefined,
      metaTitle: formData.get("fr_metaTitle") || undefined,
      metaDescription: formData.get("fr_metaDescription") || undefined,
      ogImage: formData.get("fr_ogImage") || "",
    },
    en: {
      locale: "en",
      title: formData.get("en_title"),
      slug: formData.get("en_slug"),
      excerpt: formData.get("en_excerpt") || undefined,
      body: formData.get("en_body_html"),
      bodyJson: formData.get("en_body_json") || undefined,
      bodyText: formData.get("en_body_text") || undefined,
      metaTitle: formData.get("en_metaTitle") || undefined,
      metaDescription: formData.get("en_metaDescription") || undefined,
      ogImage: formData.get("en_ogImage") || "",
    },
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }

  const articleData = {
    authorId: parsed.data.authorId ?? null,
    categoryId: parsed.data.categoryId ?? null,
    featuredImage: parsed.data.featuredImage || null,
    status: parsed.data.status as PublishStatus,
    publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null,
    readingTime: parsed.data.readingTime ?? null,
    commentsEnabled: parsed.data.commentsEnabled,
  };

  try {
    const created = !parsed.data.id;
    // Audit indexation 2026-05-15 P0-5 — capturer les anciens slugs AVANT upsert
    // pour pouvoir détecter un rename et créer ArticleSlugHistory + ping IndexNow.
    const oldSlugs: { fr?: string; en?: string } = {};
    if (parsed.data.id) {
      const existing = await prisma.articleTranslation.findMany({
        where: { articleId: parsed.data.id },
        select: { locale: true, slug: true },
      });
      for (const e of existing) {
        if (e.locale === "fr") oldSlugs.fr = e.slug;
        if (e.locale === "en") oldSlugs.en = e.slug;
      }
    }
    const article = await prisma.$transaction(async (tx) => {
      const a = parsed.data.id
        ? await tx.article.update({ where: { id: parsed.data.id }, data: articleData })
        : await tx.article.create({ data: articleData });

      // Audit indexation 2026-05-15 P0-5 — créer slug history avant l'upsert
      // de la translation, par locale, si rename détecté.
      const renames: Array<{ locale: Locale; oldSlug: string }> = [];
      if (oldSlugs.fr && oldSlugs.fr !== parsed.data.fr.slug) {
        renames.push({ locale: "fr" as Locale, oldSlug: oldSlugs.fr });
      }
      if (oldSlugs.en && oldSlugs.en !== parsed.data.en.slug) {
        renames.push({ locale: "en" as Locale, oldSlug: oldSlugs.en });
      }
      for (const r of renames) {
        await tx.articleSlugHistory.create({
          data: {
            articleId: a.id,
            oldSlug: r.oldSlug,
            oldLocale: r.locale,
            reason: `rename_via_admin_blog:${session.userId}`,
          },
        });
      }

      // Upsert translations (1 par locale)
      for (const tr of [parsed.data.fr, parsed.data.en]) {
        await tx.articleTranslation.upsert({
          where: { articleId_locale: { articleId: a.id, locale: tr.locale } },
          create: {
            articleId: a.id,
            locale: tr.locale,
            title: tr.title,
            slug: tr.slug,
            excerpt: tr.excerpt ?? null,
            body: tr.body,
            ...(tr.bodyJson !== null ? { bodyJson: tr.bodyJson as object } : {}),
            bodyText: tr.bodyText ?? null,
            metaTitle: tr.metaTitle ?? null,
            metaDescription: tr.metaDescription ?? null,
            ogImage: tr.ogImage || null,
          },
          update: {
            title: tr.title,
            slug: tr.slug,
            excerpt: tr.excerpt ?? null,
            body: tr.body,
            ...(tr.bodyJson !== null ? { bodyJson: tr.bodyJson as object } : {}),
            bodyText: tr.bodyText ?? null,
            metaTitle: tr.metaTitle ?? null,
            metaDescription: tr.metaDescription ?? null,
            ogImage: tr.ogImage || null,
          },
        });
      }

      // Tags : delete tous puis recreate (simple V1, pas de diff fin)
      await tx.articleTagOnArticle.deleteMany({ where: { articleId: a.id } });
      if (parsed.data.tagIds.length > 0) {
        await tx.articleTagOnArticle.createMany({
          data: parsed.data.tagIds.map((tagId) => ({ articleId: a.id, tagId })),
        });
      }

      await tx.activityLog.create({
        data: {
          adminUserId: session.userId,
          action: created ? "article.created" : "article.updated",
          targetType: "article",
          targetId: a.id,
          changes: { status: parsed.data.status },
          ipAddress: await getClientIp(),
        },
      });
      return a;
    });

    revalidatePath(adminPath("fr", "blog"));
    revalidatePath("/fr/blog");
    revalidatePath("/en/blog");
    revalidatePath(`/fr/blog/${parsed.data.fr.slug}`);
    revalidatePath(`/en/blog/${parsed.data.en.slug}`);

    // IndexNow notify (Bing+Yandex+...) à la publication. 2026-05-13 :
    // migré vers helper centralisé `pingIndexNow` qui appelle directement
    // api.indexnow.org (vs ancien round-trip fetch vers /api/indexnow qui
    // envoyait `{ urls }` au lieu de `{ urlList }` → 400 silencieux).
    if (parsed.data.status === "published") {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
      pingIndexNow(
        [`${baseUrl}/fr/blog/${parsed.data.fr.slug}`, `${baseUrl}/en/blog/${parsed.data.en.slug}`],
        `admin-blog:${article.id}`,
      );

      // Audit indexation 2026-05-15 P0-5/P0-6 — si slug a changé, signaler
      // l'ancien URL à Google en `URL_DELETED` + ping IndexNow (Bing/Yandex)
      // pour désindexation rapide en parallèle du redirect 301 que les pages
      // publiques rendent via lookup ArticleSlugHistory.
      const oldUrls: string[] = [];
      if (oldSlugs.fr && oldSlugs.fr !== parsed.data.fr.slug) {
        oldUrls.push(`${baseUrl}/fr/blog/${oldSlugs.fr}`);
      }
      if (oldSlugs.en && oldSlugs.en !== parsed.data.en.slug) {
        oldUrls.push(`${baseUrl}/en/blog/${oldSlugs.en}`);
      }
      if (oldUrls.length > 0) {
        try {
          await enqueueIndexingForUrls({
            entityId: `${article.id}-old`,
            urls: oldUrls,
            origin: "manual",
            lifecycleEvent: "delete",
          });
        } catch {
          // best-effort
        }
      }
    }

    return { ok: true, id: article.id, created };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "internal";
    if (msg.includes("Unique") || msg.includes("unique")) {
      return { ok: false, error: "Slug déjà utilisé pour cette langue." };
    }
    return { ok: false, error: "Erreur interne." };
  }
}

// ============================================================
// archive
// ============================================================

export type ArchiveArticleState = { ok: true } | { ok: false; error: string };

export async function archiveArticleAction(
  _prev: ArchiveArticleState,
  formData: FormData,
): Promise<ArchiveArticleState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }
  const id = formData.get("id");
  if (typeof id !== "string" || !z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "ID invalide." };
  }

  // Audit indexation 2026-05-15 P0-8 — capturer slugs FR + EN AVANT archive
  // pour pinger IndexNow URL_DELETED + Google URL_DELETED (signal Google ~24h
  // vs 6 mois en 404 silent).
  const translations = await prisma.articleTranslation.findMany({
    where: { articleId: id },
    select: { locale: true, slug: true },
  });

  await prisma.$transaction([
    prisma.article.update({ where: { id }, data: { status: "archived" } }),
    prisma.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: "article.archived",
        targetType: "article",
        targetId: id,
        ipAddress: await getClientIp(),
      },
    }),
  ]);
  revalidatePath(adminPath("fr", "blog"));
  revalidatePath("/fr/blog");
  revalidatePath("/en/blog");

  // Audit indexation 2026-05-15 P0-8 — ping IndexNow + Google `URL_DELETED`
  // pour chaque URL devenue archivée. Sans ce ping, Bing/Yandex continuaient à
  // crawler ~30j avant détection naturelle.
  if (translations.length > 0) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
    const urls = translations.map((t) => `${baseUrl}/${t.locale}/blog/${t.slug}`);
    try {
      await enqueueIndexingForUrls({
        entityId: id,
        urls,
        origin: "manual",
        lifecycleEvent: "delete",
      });
    } catch {
      // best-effort
    }
  }

  return { ok: true };
}
