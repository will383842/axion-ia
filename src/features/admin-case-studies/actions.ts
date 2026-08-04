// Server Actions admin /cas-concrets (M9 Tier 2 section 5).
//
// Multilingue option (b) — CaseStudyTranslation separee. Structure :
//   - CaseStudy : sector, companySizeRange, region, modulesUsed JSON,
//     resultsQuantified JSON [{label, value, unit}], durationWeeks,
//     roiWeeks, status, publishedAt
//   - CaseStudyTranslation : locale, title, slug, problem, solution,
//     metaTitle, metaDescription

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { adminPath } from "@/lib/admin-path";
import { pingIndexNow } from "@/lib/indexnow";
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
// list / detail / helpers
// ============================================================

const listSchema = z.object({
  status: z.enum(["draft", "published", "archived", "all"]).default("all"),
  sector: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});
export type ListCaseStudiesInput = z.infer<typeof listSchema>;

export async function listCaseStudiesAction(input: Partial<ListCaseStudiesInput> = {}) {
  await requireAdminRead();
  const parsed = listSchema.parse(input);
  const where: Record<string, unknown> = {};
  if (parsed.status !== "all") where.status = parsed.status;
  if (parsed.sector) where.sector = parsed.sector;
  if (parsed.search && parsed.search.length >= 2) {
    where.translations = {
      some: { title: { contains: parsed.search, mode: "insensitive" } },
    };
  }

  const [total, items] = await Promise.all([
    prisma.caseStudy.count({ where }),
    prisma.caseStudy.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      skip: (parsed.page - 1) * parsed.pageSize,
      take: parsed.pageSize,
      select: {
        id: true,
        sector: true,
        companySizeRange: true,
        region: true,
        durationWeeks: true,
        roiWeeks: true,
        status: true,
        publishedAt: true,
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

export async function getCaseStudyDetailAction(id: string) {
  await requireAdminRead();
  return prisma.caseStudy.findUnique({
    where: { id },
    include: {
      translations: { orderBy: { locale: "asc" } },
    },
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

// Sprint 24 / C4 : Tiptap fournit 3 sources (HTML rendu / JSON canon / text plain)
// pour problem ET solution.
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
  problem: z.string().min(20),
  problemJson: tiptapJsonString,
  problemText: z.string().optional(),
  solution: z.string().min(20),
  solutionJson: tiptapJsonString,
  solutionText: z.string().optional(),
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(160).optional(),
});

const moduleArraySchema = z.array(z.enum(["intervention", "implementation", "audit"]));

const resultEntrySchema = z.object({
  label: z.string().min(1).max(100),
  value: z.union([z.string(), z.number()]),
  unit: z.string().max(40).optional(),
});

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  sector: z.string().min(2).max(100),
  companySizeRange: z.string().min(2).max(40),
  region: z.string().max(100).optional(),
  modulesUsed: moduleArraySchema.default([]),
  resultsQuantified: z.array(resultEntrySchema).default([]),
  durationWeeks: z.coerce.number().int().min(0).optional(),
  roiWeeks: z.coerce.number().int().min(0).optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  publishedAt: z.string().optional(),
  fr: translationSchema,
  en: translationSchema,
});
export type UpsertCaseStudyState =
  { ok: true; id: string; created: boolean } | { ok: false; error: string };

export async function upsertCaseStudyAction(
  _prev: UpsertCaseStudyState,
  formData: FormData,
): Promise<UpsertCaseStudyState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }

  // Parse JSON fields posted as strings
  let resultsQuantified: unknown = [];
  try {
    const raw = formData.get("resultsQuantified");
    if (typeof raw === "string" && raw.trim()) {
      resultsQuantified = JSON.parse(raw);
    }
  } catch {
    return { ok: false, error: "JSON resultsQuantified invalide." };
  }

  const modulesRaw = formData.getAll("modulesUsed");
  const modulesUsed = modulesRaw.filter((v): v is string => typeof v === "string");

  const parsed = upsertSchema.safeParse({
    id: formData.get("id") || undefined,
    sector: formData.get("sector"),
    companySizeRange: formData.get("companySizeRange"),
    region: formData.get("region") || undefined,
    modulesUsed,
    resultsQuantified,
    durationWeeks: formData.get("durationWeeks") || undefined,
    roiWeeks: formData.get("roiWeeks") || undefined,
    status: formData.get("status") || "draft",
    publishedAt: formData.get("publishedAt") || undefined,
    fr: {
      locale: "fr",
      title: formData.get("fr_title"),
      slug: formData.get("fr_slug"),
      problem: formData.get("fr_problem_html"),
      problemJson: formData.get("fr_problem_json") || undefined,
      problemText: formData.get("fr_problem_text") || undefined,
      solution: formData.get("fr_solution_html"),
      solutionJson: formData.get("fr_solution_json") || undefined,
      solutionText: formData.get("fr_solution_text") || undefined,
      metaTitle: formData.get("fr_metaTitle") || undefined,
      metaDescription: formData.get("fr_metaDescription") || undefined,
    },
    en: {
      locale: "en",
      title: formData.get("en_title"),
      slug: formData.get("en_slug"),
      problem: formData.get("en_problem_html"),
      problemJson: formData.get("en_problem_json") || undefined,
      problemText: formData.get("en_problem_text") || undefined,
      solution: formData.get("en_solution_html"),
      solutionJson: formData.get("en_solution_json") || undefined,
      solutionText: formData.get("en_solution_text") || undefined,
      metaTitle: formData.get("en_metaTitle") || undefined,
      metaDescription: formData.get("en_metaDescription") || undefined,
    },
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }

  const csData = {
    sector: parsed.data.sector,
    companySizeRange: parsed.data.companySizeRange,
    region: parsed.data.region ?? null,
    modulesUsed: parsed.data.modulesUsed,
    resultsQuantified: parsed.data.resultsQuantified,
    durationWeeks: parsed.data.durationWeeks ?? null,
    roiWeeks: parsed.data.roiWeeks ?? null,
    status: parsed.data.status as PublishStatus,
    publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null,
  };

  try {
    const created = !parsed.data.id;
    const cs = await prisma.$transaction(async (tx) => {
      const c = parsed.data.id
        ? await tx.caseStudy.update({ where: { id: parsed.data.id }, data: csData })
        : await tx.caseStudy.create({ data: csData });
      for (const tr of [parsed.data.fr, parsed.data.en]) {
        await tx.caseStudyTranslation.upsert({
          where: { caseStudyId_locale: { caseStudyId: c.id, locale: tr.locale } },
          create: {
            caseStudyId: c.id,
            locale: tr.locale,
            title: tr.title,
            slug: tr.slug,
            problem: tr.problem,
            ...(tr.problemJson !== null ? { problemJson: tr.problemJson as object } : {}),
            problemText: tr.problemText ?? null,
            solution: tr.solution,
            ...(tr.solutionJson !== null ? { solutionJson: tr.solutionJson as object } : {}),
            solutionText: tr.solutionText ?? null,
            metaTitle: tr.metaTitle ?? null,
            metaDescription: tr.metaDescription ?? null,
          },
          update: {
            title: tr.title,
            slug: tr.slug,
            problem: tr.problem,
            ...(tr.problemJson !== null ? { problemJson: tr.problemJson as object } : {}),
            problemText: tr.problemText ?? null,
            solution: tr.solution,
            ...(tr.solutionJson !== null ? { solutionJson: tr.solutionJson as object } : {}),
            solutionText: tr.solutionText ?? null,
            metaTitle: tr.metaTitle ?? null,
            metaDescription: tr.metaDescription ?? null,
          },
        });
      }
      await tx.activityLog.create({
        data: {
          adminUserId: session.userId,
          action: created ? "case_study.created" : "case_study.updated",
          targetType: "case_study",
          targetId: c.id,
          changes: { status: parsed.data.status },
          ipAddress: await getClientIp(),
        },
      });
      return c;
    });

    revalidatePath(adminPath("fr", "case-studies"));
    revalidatePath("/fr/cas-concrets");
    revalidatePath("/en/case-studies");

    // IndexNow notify (Bing+Yandex+...) à la publication.
    if (parsed.data.status === "published") {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
      pingIndexNow(
        [
          `${baseUrl}/fr/cas-concrets/${parsed.data.fr.slug}`,
          `${baseUrl}/en/case-studies/${parsed.data.en.slug}`,
        ],
        `admin-case-studies:${cs.id}`,
      );
    }

    return { ok: true, id: cs.id, created };
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

export type ArchiveCaseStudyState = { ok: true } | { ok: false; error: string };

export async function archiveCaseStudyAction(
  _prev: ArchiveCaseStudyState,
  formData: FormData,
): Promise<ArchiveCaseStudyState> {
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
    prisma.caseStudy.update({ where: { id }, data: { status: "archived" } }),
    prisma.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: "case_study.archived",
        targetType: "case_study",
        targetId: id,
        ipAddress: await getClientIp(),
      },
    }),
  ]);
  revalidatePath(adminPath("fr", "case-studies"));
  return { ok: true };
}
