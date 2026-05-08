// Server Actions admin /centre-aide (M9 Tier 2 section 6 — dernier T2).
//
// Multilingue option (b) — HelpArticleTranslation separee. Flag isTutorial
// pour Schema.org HowTo (publication doctrine §16). Pattern identique Blog
// mais sans tags ni author (centre aide = doc produit, pas signature).

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import type { PublishStatus } from "../../../prisma/generated/client";

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
// list / detail
// ============================================================

const listSchema = z.object({
  status: z.enum(["draft", "published", "archived", "all"]).default("all"),
  isTutorial: z.enum(["yes", "no", "all"]).default("all"),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});
export type ListHelpArticlesInput = z.infer<typeof listSchema>;

export async function listHelpArticlesAction(input: Partial<ListHelpArticlesInput> = {}) {
  await requireAdminRead();
  const parsed = listSchema.parse(input);
  const where: Record<string, unknown> = {};
  if (parsed.status !== "all") where.status = parsed.status;
  if (parsed.isTutorial !== "all") where.isTutorial = parsed.isTutorial === "yes";
  if (parsed.search && parsed.search.length >= 2) {
    where.translations = {
      some: { title: { contains: parsed.search, mode: "insensitive" } },
    };
  }

  const [total, items] = await Promise.all([
    prisma.helpArticle.count({ where }),
    prisma.helpArticle.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      skip: (parsed.page - 1) * parsed.pageSize,
      take: parsed.pageSize,
      select: {
        id: true,
        isTutorial: true,
        status: true,
        publishedAt: true,
        category: { select: { nameFr: true, slug: true } },
        translations: {
          where: { locale: "fr" },
          select: { title: true, slug: true },
        },
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

export async function getHelpArticleDetailAction(id: string) {
  await requireAdminRead();
  return prisma.helpArticle.findUnique({
    where: { id },
    include: {
      translations: { orderBy: { locale: "asc" } },
      category: { select: { id: true, slug: true, nameFr: true } },
    },
  });
}

export async function listHelpCategoriesAction() {
  await requireAdminRead();
  return prisma.category.findMany({
    where: { module: null, status: "published", slug: { startsWith: "aide-" } },
    select: { id: true, slug: true, nameFr: true },
    orderBy: { displayOrder: "asc" },
  });
}

// ============================================================
// upsert
// ============================================================

const slugSchema = z
  .string()
  .min(3)
  .max(255)
  .regex(/^[a-z0-9-]+$/);

const translationSchema = z.object({
  locale: z.enum(["fr", "en"]),
  title: z.string().min(3).max(255),
  slug: slugSchema,
  excerpt: z.string().max(500).optional(),
  body: z.string().min(10),
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(160).optional(),
});

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  isTutorial: z.coerce.boolean().default(false),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  publishedAt: z.string().optional(),
  fr: translationSchema,
  en: translationSchema,
});
export type UpsertHelpArticleState =
  | { ok: true; id: string; created: boolean }
  | { ok: false; error: string };

export async function upsertHelpArticleAction(
  _prev: UpsertHelpArticleState,
  formData: FormData,
): Promise<UpsertHelpArticleState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }

  const parsed = upsertSchema.safeParse({
    id: formData.get("id") || undefined,
    categoryId: formData.get("categoryId") || null,
    isTutorial: formData.get("isTutorial") === "on",
    status: formData.get("status") || "draft",
    publishedAt: formData.get("publishedAt") || undefined,
    fr: {
      locale: "fr",
      title: formData.get("fr_title"),
      slug: formData.get("fr_slug"),
      excerpt: formData.get("fr_excerpt") || undefined,
      body: formData.get("fr_body"),
      metaTitle: formData.get("fr_metaTitle") || undefined,
      metaDescription: formData.get("fr_metaDescription") || undefined,
    },
    en: {
      locale: "en",
      title: formData.get("en_title"),
      slug: formData.get("en_slug"),
      excerpt: formData.get("en_excerpt") || undefined,
      body: formData.get("en_body"),
      metaTitle: formData.get("en_metaTitle") || undefined,
      metaDescription: formData.get("en_metaDescription") || undefined,
    },
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }

  const haData = {
    categoryId: parsed.data.categoryId ?? null,
    isTutorial: parsed.data.isTutorial,
    status: parsed.data.status as PublishStatus,
    publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null,
  };

  try {
    const created = !parsed.data.id;
    const ha = await prisma.$transaction(async (tx) => {
      const a = parsed.data.id
        ? await tx.helpArticle.update({ where: { id: parsed.data.id }, data: haData })
        : await tx.helpArticle.create({ data: haData });
      for (const tr of [parsed.data.fr, parsed.data.en]) {
        await tx.helpArticleTranslation.upsert({
          where: { helpArticleId_locale: { helpArticleId: a.id, locale: tr.locale } },
          create: {
            helpArticleId: a.id,
            locale: tr.locale,
            title: tr.title,
            slug: tr.slug,
            excerpt: tr.excerpt ?? null,
            body: tr.body,
            metaTitle: tr.metaTitle ?? null,
            metaDescription: tr.metaDescription ?? null,
          },
          update: {
            title: tr.title,
            slug: tr.slug,
            excerpt: tr.excerpt ?? null,
            body: tr.body,
            metaTitle: tr.metaTitle ?? null,
            metaDescription: tr.metaDescription ?? null,
          },
        });
      }
      await tx.activityLog.create({
        data: {
          adminUserId: session.userId,
          action: created ? "help_article.created" : "help_article.updated",
          targetType: "help_article",
          targetId: a.id,
          changes: { status: parsed.data.status, isTutorial: parsed.data.isTutorial },
          ipAddress: await getClientIp(),
        },
      });
      return a;
    });

    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9"}/help`);
    revalidatePath("/fr/centre-aide");
    revalidatePath("/en/help-center");
    return { ok: true, id: ha.id, created };
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

export type ArchiveHelpArticleState = { ok: true } | { ok: false; error: string };

export async function archiveHelpArticleAction(
  _prev: ArchiveHelpArticleState,
  formData: FormData,
): Promise<ArchiveHelpArticleState> {
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
  await prisma.$transaction([
    prisma.helpArticle.update({ where: { id }, data: { status: "archived" } }),
    prisma.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: "help_article.archived",
        targetType: "help_article",
        targetId: id,
        ipAddress: await getClientIp(),
      },
    }),
  ]);
  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9"}/help`);
  return { ok: true };
}
