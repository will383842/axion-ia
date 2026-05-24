// Server Actions admin /testimonials (M9 Tier 2 section 2).
//
// Testimonials : champs *_fr/*_en directement (option a multilingue
// CLAUDE.md §13). Slug global unique → page individuelle indexable
// /temoignages/[slug] (decision Will 2026-05-08 : route gardee en
// composant carousel pour V1, pas de detail page → slug reste pour AEO).
// Status TestimonialStatus enum (pending/published/refused/archived) —
// pending pour les soumissions externes (a moderate avant publish).

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { adminPath } from "@/lib/admin-path";
import type { TestimonialStatus, ModuleKind } from "../../../prisma/generated/client";

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
  status: z.enum(["pending", "published", "refused", "archived", "all"]).default("all"),
  module: z.enum(["intervention", "implementation", "audit", "all"]).default("all"),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(50),
});
export type ListTestimonialsInput = z.infer<typeof listSchema>;

export async function listTestimonialsAction(input: Partial<ListTestimonialsInput> = {}) {
  await requireAdminRead();
  const parsed = listSchema.parse(input);
  const where: Record<string, unknown> = {};
  if (parsed.status !== "all") where.status = parsed.status;
  if (parsed.module !== "all") where.module = parsed.module;
  if (parsed.search && parsed.search.length >= 2) {
    where.OR = [
      { firstName: { contains: parsed.search, mode: "insensitive" } },
      { lastName: { contains: parsed.search, mode: "insensitive" } },
      { company: { contains: parsed.search, mode: "insensitive" } },
      { slug: { contains: parsed.search, mode: "insensitive" } },
    ];
  }
  const [total, items] = await Promise.all([
    prisma.testimonial.count({ where }),
    prisma.testimonial.findMany({
      where,
      orderBy: [{ status: "asc" }, { displayOrder: "asc" }, { updatedAt: "desc" }],
      skip: (parsed.page - 1) * parsed.pageSize,
      take: parsed.pageSize,
      select: {
        id: true,
        slug: true,
        status: true,
        firstName: true,
        lastName: true,
        company: true,
        sector: true,
        rating: true,
        module: true,
        resultHighlight: true,
        displayOrder: true,
        updatedAt: true,
        // Sprint v7 Phase 15 (F5) : permet au listing d'afficher le badge
        // "Authentifié" pour les testimonials réels (realMeta.isReal).
        displayPages: true,
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

export async function getTestimonialDetailAction(id: string) {
  await requireAdminRead();
  return prisma.testimonial.findUnique({ where: { id } });
}

// ============================================================
// upsert
// ============================================================

const slugSchema = z
  .string()
  .min(3)
  .max(160)
  .regex(/^[a-z0-9-]+$/, "Slug : minuscules + chiffres + tirets uniquement.");

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  slug: slugSchema,
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.string().max(100).optional(),
  company: z.string().max(255).optional(),
  sector: z.string().max(100).optional(),
  companySize: z.string().max(20).optional(),
  shortQuoteFr: z.string().min(10).max(500),
  shortQuoteEn: z.string().min(10).max(500),
  fullQuoteFr: z.string().max(2000).optional(),
  fullQuoteEn: z.string().max(2000).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  photoUrl: z.string().url().optional().or(z.literal("")),
  videoUrl: z.string().url().optional().or(z.literal("")),
  module: z.enum(["intervention", "implementation", "audit"]).optional(),
  resultHighlight: z.string().max(255).optional(),
  displayOrder: z.coerce.number().int().min(0).default(0),
  status: z.enum(["pending", "published", "refused", "archived"]).default("pending"),
});
export type UpsertTestimonialState =
  | { ok: true; id: string; created: boolean }
  | { ok: false; error: string };

export async function upsertTestimonialAction(
  _prev: UpsertTestimonialState,
  formData: FormData,
): Promise<UpsertTestimonialState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }

  const parsed = upsertSchema.safeParse({
    id: formData.get("id") || undefined,
    slug: formData.get("slug"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    role: formData.get("role") || undefined,
    company: formData.get("company") || undefined,
    sector: formData.get("sector") || undefined,
    companySize: formData.get("companySize") || undefined,
    shortQuoteFr: formData.get("shortQuoteFr"),
    shortQuoteEn: formData.get("shortQuoteEn"),
    fullQuoteFr: formData.get("fullQuoteFr") || undefined,
    fullQuoteEn: formData.get("fullQuoteEn") || undefined,
    rating: formData.get("rating") || undefined,
    photoUrl: formData.get("photoUrl") || "",
    videoUrl: formData.get("videoUrl") || "",
    module: formData.get("module") || undefined,
    resultHighlight: formData.get("resultHighlight") || undefined,
    displayOrder: formData.get("displayOrder") || 0,
    status: formData.get("status") || "pending",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }

  const data = {
    slug: parsed.data.slug,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    role: parsed.data.role ?? null,
    company: parsed.data.company ?? null,
    sector: parsed.data.sector ?? null,
    companySize: parsed.data.companySize ?? null,
    shortQuoteFr: parsed.data.shortQuoteFr,
    shortQuoteEn: parsed.data.shortQuoteEn,
    fullQuoteFr: parsed.data.fullQuoteFr ?? null,
    fullQuoteEn: parsed.data.fullQuoteEn ?? null,
    rating: parsed.data.rating ?? null,
    photoUrl: parsed.data.photoUrl || null,
    videoUrl: parsed.data.videoUrl || null,
    module: (parsed.data.module ?? null) as ModuleKind | null,
    resultHighlight: parsed.data.resultHighlight ?? null,
    displayOrder: parsed.data.displayOrder,
    status: parsed.data.status as TestimonialStatus,
  };

  try {
    const created = !parsed.data.id;
    const t = parsed.data.id
      ? await prisma.testimonial.update({ where: { id: parsed.data.id }, data })
      : await prisma.testimonial.create({ data });
    await prisma.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: created ? "testimonial.created" : "testimonial.updated",
        targetType: "testimonial",
        targetId: t.id,
        ipAddress: await getClientIp(),
      },
    });
    revalidatePath(adminPath("fr", "testimonials"));
    revalidatePath("/fr");
    revalidatePath("/en");
    return { ok: true, id: t.id, created };
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

export type ArchiveTestimonialState = { ok: true } | { ok: false; error: string };

export async function archiveTestimonialAction(
  _prev: ArchiveTestimonialState,
  formData: FormData,
): Promise<ArchiveTestimonialState> {
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
    prisma.testimonial.update({ where: { id }, data: { status: "archived" } }),
    prisma.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: "testimonial.archived",
        targetType: "testimonial",
        targetId: id,
        ipAddress: await getClientIp(),
      },
    }),
  ]);
  revalidatePath(adminPath("fr", "testimonials"));
  return { ok: true };
}
