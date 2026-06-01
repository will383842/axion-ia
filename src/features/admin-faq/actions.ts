// Server Actions admin /faq (M9 Tier 2 section 1).
//
// FAQ : champs *_fr/*_en directement sur la ligne (option a multilingue
// CLAUDE.md §13). Slug global unique. Categorisation via enum FAQCategory
// (general/interventions/implementation/audit/pricing/process). Schema.org
// FAQPage rendu publique sur /fr/faq + /en/faq.

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { adminPath } from "@/lib/admin-path";
import { SITE_URL } from "@/lib/seo";
import { pingIndexNow } from "@/lib/indexnow";
import type { FAQCategory, PublishStatus } from "../../../prisma/generated/client";

/**
 * Fix audit FAQ 2026-05-31 (axes G1/G3) : l'admin FAQ ne pingait jamais IndexNow
 * (ni à la publication, ni à l'archivage). On câble ici le lifecycle :
 * publish → ping (Bing/Yandex re-crawl) ; archivage → ping (le re-crawl découvre
 * le retrait, la page archivée renvoyant notFound). Fire-and-forget, jamais
 * bloquant. FR uniquement (EN désactivé).
 *
 * On utilise `pingIndexNow` (@/lib/indexnow, helper IndexNow générique) plutôt
 * que le helper du pipeline de génération, pour respecter le cloisonnement
 * architectural (isolation-check CI).
 */
function pingFaqIndexing(slug: string, event: "publish" | "delete"): void {
  pingIndexNow([`${SITE_URL}/fr/faq/${slug}`], `faq:${event}`);
}

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
// listFAQs
// ============================================================

const listSchema = z.object({
  category: z
    .enum(["general", "interventions", "implementation", "audit", "pricing", "process", "all"])
    .default("all"),
  status: z.enum(["draft", "published", "archived", "all"]).default("all"),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(50),
});
export type ListFAQsInput = z.infer<typeof listSchema>;

export interface FAQListItem {
  id: string;
  slug: string;
  category: FAQCategory;
  status: PublishStatus;
  questionFr: string;
  questionEn: string;
  displayOrder: number;
  viewCount: number;
  helpfulCount: number;
  updatedAt: Date;
}

export async function listFAQsAction(input: Partial<ListFAQsInput> = {}) {
  await requireAdminRead();
  const parsed = listSchema.parse(input);
  const where: Record<string, unknown> = {};
  if (parsed.category !== "all") where.category = parsed.category;
  if (parsed.status !== "all") where.status = parsed.status;
  if (parsed.search && parsed.search.length >= 2) {
    where.OR = [
      { questionFr: { contains: parsed.search, mode: "insensitive" } },
      { questionEn: { contains: parsed.search, mode: "insensitive" } },
      { slug: { contains: parsed.search, mode: "insensitive" } },
    ];
  }
  const [total, items] = await Promise.all([
    prisma.fAQ.count({ where }),
    prisma.fAQ.findMany({
      where,
      orderBy: [{ category: "asc" }, { displayOrder: "asc" }, { updatedAt: "desc" }],
      skip: (parsed.page - 1) * parsed.pageSize,
      take: parsed.pageSize,
      select: {
        id: true,
        slug: true,
        category: true,
        status: true,
        questionFr: true,
        questionEn: true,
        displayOrder: true,
        viewCount: true,
        helpfulCount: true,
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

// ============================================================
// getFAQDetail
// ============================================================

export async function getFAQDetailAction(id: string) {
  await requireAdminRead();
  return prisma.fAQ.findUnique({ where: { id } });
}

// ============================================================
// upsertFAQ — create + edit
// ============================================================

const slugSchema = z
  .string()
  .min(3, "Slug min 3 chars.")
  .max(180)
  .regex(/^[a-z0-9-]+$/, "Slug : minuscules + chiffres + tirets uniquement.");

const upsertSchema = z.object({
  id: z.string().uuid().optional(), // optionnel = create
  slug: slugSchema,
  category: z.enum(["general", "interventions", "implementation", "audit", "pricing", "process"]),
  questionFr: z.string().min(5).max(500),
  questionEn: z.string().min(5).max(500),
  answerFr: z.string().min(10),
  answerEn: z.string().min(10),
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(160).optional(),
  displayOrder: z.coerce.number().int().min(0).default(0),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});
export type UpsertFAQState =
  | { ok: true; id: string; created: boolean }
  | { ok: false; error: string };

export async function upsertFAQAction(
  _prev: UpsertFAQState,
  formData: FormData,
): Promise<UpsertFAQState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }
  const parsed = upsertSchema.safeParse({
    id: formData.get("id") || undefined,
    slug: formData.get("slug"),
    category: formData.get("category"),
    questionFr: formData.get("questionFr"),
    questionEn: formData.get("questionEn"),
    answerFr: formData.get("answerFr"),
    answerEn: formData.get("answerEn"),
    metaTitle: formData.get("metaTitle") || undefined,
    metaDescription: formData.get("metaDescription") || undefined,
    displayOrder: formData.get("displayOrder") || 0,
    status: formData.get("status") || "draft",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }

  const ip = await getClientIp();
  const data = {
    slug: parsed.data.slug,
    category: parsed.data.category,
    questionFr: parsed.data.questionFr,
    questionEn: parsed.data.questionEn,
    answerFr: parsed.data.answerFr,
    answerEn: parsed.data.answerEn,
    metaTitle: parsed.data.metaTitle ?? null,
    metaDescription: parsed.data.metaDescription ?? null,
    displayOrder: parsed.data.displayOrder,
    status: parsed.data.status,
  };

  try {
    const created = !parsed.data.id;
    const faq = parsed.data.id
      ? await prisma.fAQ.update({ where: { id: parsed.data.id }, data })
      : await prisma.fAQ.create({ data });
    await prisma.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: created ? "faq.created" : "faq.updated",
        targetType: "faq",
        targetId: faq.id,
        ipAddress: ip,
      },
    });
    revalidatePath(adminPath("fr", "faq"));
    revalidatePath("/fr/faq");
    revalidatePath("/en/faq");
    revalidatePath(`/fr/faq/${parsed.data.slug}`);
    // Lifecycle indexation (fix audit FAQ 2026-05-31) : publié → ping publish,
    // archivé via upsert → ping delete (URL_DELETED).
    if (parsed.data.status === "published") {
      pingFaqIndexing(parsed.data.slug, "publish");
    } else if (parsed.data.status === "archived") {
      pingFaqIndexing(parsed.data.slug, "delete");
    }
    return { ok: true, id: faq.id, created };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "internal";
    if (msg.includes("Unique") || msg.includes("unique")) {
      return { ok: false, error: "Slug déjà utilisé." };
    }
    return { ok: false, error: "Erreur interne." };
  }
}

// ============================================================
// deleteFAQ — soft archive (status='archived')
// ============================================================

const deleteSchema = z.object({ id: z.string().uuid() });
export type DeleteFAQState = { ok: true } | { ok: false; error: string };

export async function archiveFAQAction(
  _prev: DeleteFAQState,
  formData: FormData,
): Promise<DeleteFAQState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }
  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "ID invalide." };

  const [archived] = await prisma.$transaction([
    prisma.fAQ.update({ where: { id: parsed.data.id }, data: { status: "archived" } }),
    prisma.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: "faq.archived",
        targetType: "faq",
        targetId: parsed.data.id,
        ipAddress: await getClientIp(),
      },
    }),
  ]);
  revalidatePath(adminPath("fr", "faq"));
  revalidatePath("/fr/faq");
  revalidatePath("/en/faq");
  // Dé-indexation propre (fix audit FAQ 2026-05-31, axe G3) : URL_DELETED.
  if (archived?.slug) {
    revalidatePath(`/fr/faq/${archived.slug}`);
    pingFaqIndexing(archived.slug, "delete");
  }
  return { ok: true };
}
