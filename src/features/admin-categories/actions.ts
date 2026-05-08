// Server Actions admin /categories (M9 Tier 2 section 3).
//
// Categories : champs *_fr/*_en (option a multilingue CLAUDE.md §13).
// Hierarchique via parentId self-reference (niveau 1 = top, niveau 2 = sous-cat).
// Module enum optionnel (intervention/implementation/audit) pour distinguer
// les categories transverses des categories blog.

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import type { ModuleKind, PublishStatus } from "../../../prisma/generated/client";

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
// list / detail / parents
// ============================================================

const listSchema = z.object({
  module: z.enum(["intervention", "implementation", "audit", "blog", "all"]).default("all"),
  status: z.enum(["draft", "published", "archived", "all"]).default("all"),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(50),
});
export type ListCategoriesInput = z.infer<typeof listSchema>;

export async function listCategoriesAction(input: Partial<ListCategoriesInput> = {}) {
  await requireAdminRead();
  const parsed = listSchema.parse(input);
  const where: Record<string, unknown> = {};
  if (parsed.module === "blog") {
    where.module = null;
  } else if (parsed.module !== "all") {
    where.module = parsed.module;
  }
  if (parsed.status !== "all") where.status = parsed.status;
  if (parsed.search && parsed.search.length >= 2) {
    where.OR = [
      { nameFr: { contains: parsed.search, mode: "insensitive" } },
      { nameEn: { contains: parsed.search, mode: "insensitive" } },
      { slug: { contains: parsed.search, mode: "insensitive" } },
    ];
  }
  const [total, items] = await Promise.all([
    prisma.category.count({ where }),
    prisma.category.findMany({
      where,
      orderBy: [{ module: "asc" }, { displayOrder: "asc" }, { nameFr: "asc" }],
      skip: (parsed.page - 1) * parsed.pageSize,
      take: parsed.pageSize,
      select: {
        id: true,
        slug: true,
        nameFr: true,
        nameEn: true,
        module: true,
        status: true,
        displayOrder: true,
        parentId: true,
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

export async function getCategoryDetailAction(id: string) {
  await requireAdminRead();
  return prisma.category.findUnique({ where: { id } });
}

/** Liste des parents possibles pour le select (toutes categories sauf elle-meme). */
export async function listPotentialParentsAction(excludeId?: string) {
  await requireAdminRead();
  return prisma.category.findMany({
    where: excludeId ? { id: { not: excludeId }, parentId: null } : { parentId: null },
    select: { id: true, slug: true, nameFr: true, module: true },
    orderBy: { nameFr: "asc" },
  });
}

// ============================================================
// upsert
// ============================================================

const slugSchema = z
  .string()
  .min(2)
  .max(160)
  .regex(/^[a-z0-9-]+$/, "Slug : minuscules + chiffres + tirets uniquement.");

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  slug: slugSchema,
  nameFr: z.string().min(1).max(255),
  nameEn: z.string().min(1).max(255),
  descriptionFr: z.string().optional(),
  descriptionEn: z.string().optional(),
  parentId: z.string().uuid().nullable().optional(),
  module: z.enum(["intervention", "implementation", "audit"]).optional(),
  icon: z.string().max(80).optional(),
  colorAccent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Format hex #RRGGBB")
    .optional()
    .or(z.literal("")),
  displayOrder: z.coerce.number().int().min(0).default(0),
  status: z.enum(["draft", "published", "archived"]).default("published"),
  seoTitleFr: z.string().max(70).optional(),
  seoTitleEn: z.string().max(70).optional(),
  seoDescFr: z.string().max(160).optional(),
  seoDescEn: z.string().max(160).optional(),
  pageContentFr: z.string().optional(),
  pageContentEn: z.string().optional(),
});
export type UpsertCategoryState =
  | { ok: true; id: string; created: boolean }
  | { ok: false; error: string };

export async function upsertCategoryAction(
  _prev: UpsertCategoryState,
  formData: FormData,
): Promise<UpsertCategoryState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }
  const parentRaw = formData.get("parentId");
  const parentId = typeof parentRaw === "string" && parentRaw.length > 0 ? parentRaw : null;

  const parsed = upsertSchema.safeParse({
    id: formData.get("id") || undefined,
    slug: formData.get("slug"),
    nameFr: formData.get("nameFr"),
    nameEn: formData.get("nameEn"),
    descriptionFr: formData.get("descriptionFr") || undefined,
    descriptionEn: formData.get("descriptionEn") || undefined,
    parentId,
    module: formData.get("module") || undefined,
    icon: formData.get("icon") || undefined,
    colorAccent: formData.get("colorAccent") || "",
    displayOrder: formData.get("displayOrder") || 0,
    status: formData.get("status") || "published",
    seoTitleFr: formData.get("seoTitleFr") || undefined,
    seoTitleEn: formData.get("seoTitleEn") || undefined,
    seoDescFr: formData.get("seoDescFr") || undefined,
    seoDescEn: formData.get("seoDescEn") || undefined,
    pageContentFr: formData.get("pageContentFr") || undefined,
    pageContentEn: formData.get("pageContentEn") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }

  const data = {
    slug: parsed.data.slug,
    nameFr: parsed.data.nameFr,
    nameEn: parsed.data.nameEn,
    descriptionFr: parsed.data.descriptionFr ?? null,
    descriptionEn: parsed.data.descriptionEn ?? null,
    parentId: parsed.data.parentId ?? null,
    module: (parsed.data.module ?? null) as ModuleKind | null,
    icon: parsed.data.icon ?? null,
    colorAccent: parsed.data.colorAccent || null,
    displayOrder: parsed.data.displayOrder,
    status: parsed.data.status as PublishStatus,
    seoTitleFr: parsed.data.seoTitleFr ?? null,
    seoTitleEn: parsed.data.seoTitleEn ?? null,
    seoDescFr: parsed.data.seoDescFr ?? null,
    seoDescEn: parsed.data.seoDescEn ?? null,
    pageContentFr: parsed.data.pageContentFr ?? null,
    pageContentEn: parsed.data.pageContentEn ?? null,
  };

  try {
    const created = !parsed.data.id;
    const cat = parsed.data.id
      ? await prisma.category.update({ where: { id: parsed.data.id }, data })
      : await prisma.category.create({ data });
    await prisma.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: created ? "category.created" : "category.updated",
        targetType: "category",
        targetId: cat.id,
        ipAddress: await getClientIp(),
      },
    });
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9"}/categories`);
    return { ok: true, id: cat.id, created };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "internal";
    if (msg.includes("Unique") || msg.includes("unique")) {
      return { ok: false, error: "Slug déjà utilisé." };
    }
    return { ok: false, error: "Erreur interne." };
  }
}

// ============================================================
// archive
// ============================================================

export type ArchiveCategoryState = { ok: true } | { ok: false; error: string };

export async function archiveCategoryAction(
  _prev: ArchiveCategoryState,
  formData: FormData,
): Promise<ArchiveCategoryState> {
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
  // Empeche l'archivage si la categorie a des enfants (sous-categories actives)
  const childCount = await prisma.category.count({
    where: { parentId: id, status: { not: "archived" } },
  });
  if (childCount > 0) {
    return {
      ok: false,
      error: `Impossible : ${childCount} sous-catégorie(s) active(s). Archivez-les d'abord.`,
    };
  }
  await prisma.$transaction([
    prisma.category.update({ where: { id }, data: { status: "archived" } }),
    prisma.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: "category.archived",
        targetType: "category",
        targetId: id,
        ipAddress: await getClientIp(),
      },
    }),
  ]);
  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9"}/categories`);
  return { ok: true };
}
