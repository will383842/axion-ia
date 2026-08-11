// Server Actions admin /offres-emploi — système carrières DB-piloté.
// Calqué sur src/features/admin-faq/actions.ts (auth inline, Zod, activityLog,
// revalidatePath, pingIndexNow). Ajouts : setFilled, clone, hard-delete
// super_admin (purge CV des candidatures avant cascade). FR seul indexé (EN off).

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { adminPath } from "@/lib/admin-path";
import { SITE_URL } from "@/lib/seo";
import { pingIndexNow } from "@/lib/indexnow";
import { enqueueGoogleIndexingForUrls } from "@/server/content-gen/indexing/enqueue";
import { isJobOfferIndexable } from "@/lib/careers/job-offers";
import { normalizeApplicantCountries } from "@/lib/careers/format";
import { deleteCv } from "@/server/careers/cv-storage";
import { CAREER_CATEGORY_SLUGS } from "@/content/careers/categories";
import type {
  JobCategory,
  JobWorkMode,
  JobOffer,
  PublishStatus,
  Prisma,
} from "../../../prisma/generated/client";

const LIST_CATEGORIES = [...CAREER_CATEGORY_SLUGS, "all"] as const;

/**
 * Signale une offre aux moteurs. Deux canaux complémentaires (fire-and-forget) :
 *  - IndexNow (Bing/Yandex) : toujours, ping direct synchrone.
 *  - Google Indexing API : seulement si `GOOGLE_INDEXING_API_ENABLED=true`.
 *    Une offre est un `JobPosting` → l'un des 2 types que Google honore
 *    réellement via cette API (contrairement aux articles). Sur `publish`, on
 *    n'émet `URL_UPDATED` que si l'offre est vraiment indexable (sinon on
 *    demanderait à Google d'indexer une page noindex) ; `offer` fournit alors
 *    l'état (tier / pourvue / expiration) pour ce contrôle.
 */
function pingOfferIndexing(
  slug: string,
  event: "publish" | "delete",
  offer?: Pick<JobOffer, "status" | "filledAt" | "indexationTier" | "validThrough">,
): void {
  const url = `${SITE_URL}/fr/carrieres/${slug}`;
  pingIndexNow([url], `joboffer:${event}`);
  // Guard : sur publish, ne pinger Google que si l'offre est réellement indexable.
  if (event === "publish" && offer && !isJobOfferIndexable(offer)) return;
  void enqueueGoogleIndexingForUrls({
    entityId: `joboffer-${slug}`,
    urls: [url],
    origin: "manual",
    lifecycleEvent: event,
  }).catch(() => {});
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
async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin") throw new Error("forbidden");
  return { userId: session.user.id, role };
}

// ============================================================
// list
// ============================================================

const listSchema = z.object({
  category: z.enum(LIST_CATEGORIES).default("all"),
  status: z.enum(["draft", "published", "archived", "all"]).default("all"),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(50),
});
export type ListJobOffersInput = z.infer<typeof listSchema>;

export interface JobOfferListItem {
  id: string;
  slug: string;
  category: JobCategory;
  status: PublishStatus;
  workMode: JobWorkMode;
  titleFr: string;
  city: string | null;
  displayOrder: number;
  viewCount: number;
  filledAt: Date | null;
  validThrough: Date | null;
  updatedAt: Date;
  applicationsCount: number;
}

export async function listJobOffersAction(input: Partial<ListJobOffersInput> = {}) {
  await requireAdminRead();
  const parsed = listSchema.parse(input);
  const where: Record<string, unknown> = {};
  if (parsed.category !== "all") where.category = parsed.category;
  if (parsed.status !== "all") where.status = parsed.status;
  if (parsed.search && parsed.search.length >= 2) {
    where.OR = [
      { titleFr: { contains: parsed.search, mode: "insensitive" } },
      { titleEn: { contains: parsed.search, mode: "insensitive" } },
      { slug: { contains: parsed.search, mode: "insensitive" } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.jobOffer.count({ where }),
    prisma.jobOffer.findMany({
      where,
      orderBy: [{ status: "asc" }, { displayOrder: "asc" }, { updatedAt: "desc" }],
      skip: (parsed.page - 1) * parsed.pageSize,
      take: parsed.pageSize,
      select: {
        id: true,
        slug: true,
        category: true,
        status: true,
        workMode: true,
        titleFr: true,
        city: true,
        displayOrder: true,
        viewCount: true,
        filledAt: true,
        validThrough: true,
        updatedAt: true,
        _count: { select: { applications: true } },
      },
    }),
  ]);
  const items: JobOfferListItem[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    category: r.category,
    status: r.status,
    workMode: r.workMode,
    titleFr: r.titleFr,
    city: r.city,
    displayOrder: r.displayOrder,
    viewCount: r.viewCount,
    filledAt: r.filledAt,
    validThrough: r.validThrough,
    updatedAt: r.updatedAt,
    applicationsCount: r._count.applications,
  }));
  return {
    items,
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
    totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)),
  };
}

// ============================================================
// getDetail
// ============================================================

export async function getJobOfferDetailAction(id: string) {
  await requireAdminRead();
  return prisma.jobOffer.findUnique({ where: { id } });
}

// ============================================================
// upsert — create + edit
// ============================================================

const slugSchema = z
  .string()
  .min(3, "Slug min 3 caractères.")
  .max(180)
  .regex(/^[a-z0-9-]+$/, "Slug : minuscules + chiffres + tirets uniquement.");

/** "" → undefined (pour champs date/number optionnels venant d'un FormData). */
const emptyToUndef = (v: unknown) => (v === "" || v === null ? undefined : v);
const optDate = z.preprocess(emptyToUndef, z.coerce.date().optional());
const optInt = z.preprocess(emptyToUndef, z.coerce.number().int().optional());
const boolFromForm = z.preprocess(
  (v) => v === "true" || v === "on" || v === true || v === "1",
  z.boolean(),
);

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  slug: slugSchema,
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  category: z.enum(CAREER_CATEGORY_SLUGS),
  titleFr: z.string().min(3).max(160),
  // EN optionnel (site FR-only) : si vide → fallback FR à la construction des data.
  titleEn: z.string().max(160).optional().default(""),
  summaryFr: z.string().min(10).max(320),
  summaryEn: z.string().max(320).optional().default(""),
  bodyFr: z.string().min(1),
  bodyJsonFr: z.string().optional(),
  bodyTextFr: z.string().default(""),
  bodyEn: z.string().optional().default(""),
  bodyJsonEn: z.string().optional(),
  bodyTextEn: z.string().default(""),
  employmentType: z.string().max(20).default("FULL_TIME"),
  workMode: z.enum(["on_site", "hybrid", "remote"]).default("on_site"),
  city: z.preprocess(emptyToUndef, z.string().max(120).optional()),
  region: z.preprocess(emptyToUndef, z.string().max(120).optional()),
  country: z.string().length(2).default("FR"),
  // Pays d'où l'on accepte les candidatures — saisis en clair, séparés par des
  // virgules (« FR, BE, MA »). Vide = France seule. Codes ISO 3166-1 alpha-2 ;
  // ce qui n'en est pas un est ignoré silencieusement par la normalisation.
  applicantCountries: z.preprocess(emptyToUndef, z.string().max(300).optional()),
  salaryMin: optInt,
  salaryMax: optInt,
  salaryPeriod: z.string().max(10).default("YEAR"),
  salaryCurrency: z.string().max(3).default("EUR"),
  salaryVisible: boolFromForm.default(true),
  isCommission: boolFromForm.default(false),
  requiresDriverLicense: boolFromForm.default(false),
  requiresVehicle: boolFromForm.default(false),
  screeningQuestions: z.preprocess(emptyToUndef, z.string().optional()),
  contractLabel: z.preprocess(emptyToUndef, z.string().max(60).optional()),
  startDate: optDate,
  applicationDeadline: optDate,
  remoteDaysPerWeek: optInt,
  perks: z.preprocess(emptyToUndef, z.string().optional()),
  jobLocations: z.preprocess(emptyToUndef, z.string().optional()),
  teamName: z.preprocess(emptyToUndef, z.string().max(120).optional()),
  managerName: z.preprocess(emptyToUndef, z.string().max(120).optional()),
  heroImagePath: z.preprocess(emptyToUndef, z.string().max(255).optional()),
  metaTitle: z.preprocess(emptyToUndef, z.string().max(70).optional()),
  metaDescription: z.preprocess(emptyToUndef, z.string().max(160).optional()),
  indexationTier: z
    .enum(["tier_1_indexable", "tier_2_noindex_follow", "tier_3_noindex_nofollow"])
    .default("tier_1_indexable"),
  ogImagePath: z.preprocess(emptyToUndef, z.string().max(255).optional()),
  validThrough: optDate,
  displayOrder: z.coerce.number().int().min(0).default(0),
});

export type UpsertJobOfferState =
  { ok: true; id: string; created: boolean } | { ok: false; error: string };

/** Parse un JSON optionnel ; retourne undefined si vide/invalide (champ optionnel). */
function parseJsonField(raw: string | undefined): Prisma.InputJsonValue | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

export async function upsertJobOfferAction(
  _prev: UpsertJobOfferState,
  formData: FormData,
): Promise<UpsertJobOfferState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }

  const raw = Object.fromEntries(formData.entries());
  // TiptapEditor name="bodyFr" émet bodyFr_html / bodyFr_json / bodyFr_text.
  const mapped = {
    ...raw,
    bodyFr: raw["bodyFr_html"],
    bodyJsonFr: raw["bodyFr_json"],
    bodyTextFr: raw["bodyFr_text"],
    bodyEn: raw["bodyEn_html"],
    bodyJsonEn: raw["bodyEn_json"],
    bodyTextEn: raw["bodyEn_text"],
  };
  const parsed = upsertSchema.safeParse(mapped);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `${issue?.path.join(".")}: ${issue?.message}` };
  }
  const d = parsed.data;

  // publishedAt : posé à la 1re publication, conservé ensuite.
  const existing = d.id
    ? await prisma.jobOffer.findUnique({
        where: { id: d.id },
        select: { publishedAt: true, slug: true },
      })
    : null;
  const publishedAt =
    d.status === "published"
      ? (existing?.publishedAt ?? new Date())
      : (existing?.publishedAt ?? null);

  // Champs JSON : inclus uniquement si présents (jamais `undefined` explicite,
  // jamais `null` brut — Prisma Json rejette null sans sentinelle).
  const bodyJsonFr = parseJsonField(d.bodyJsonFr);
  const bodyJsonEn = parseJsonField(d.bodyJsonEn);
  const screeningQuestions = parseJsonField(d.screeningQuestions);
  const perks = parseJsonField(d.perks);
  const jobLocations = parseJsonField(d.jobLocations);

  // JSON invalide saisi par l'admin : remonter une erreur plutôt que l'avaler.
  if (d.screeningQuestions && screeningQuestions === undefined) {
    return { ok: false, error: "Questions de l'offre : JSON invalide." };
  }
  if (d.perks && perks === undefined) {
    return { ok: false, error: "Avantages : JSON invalide." };
  }
  if (d.jobLocations && jobLocations === undefined) {
    return { ok: false, error: "Zone d'emploi multi-villes : JSON invalide." };
  }

  const data = {
    slug: d.slug,
    status: d.status,
    category: d.category,
    titleFr: d.titleFr,
    // FR-only : EN vide → on recopie le FR (fallback, jamais de champ EN vide en DB).
    titleEn: d.titleEn || d.titleFr,
    summaryFr: d.summaryFr,
    summaryEn: d.summaryEn || d.summaryFr,
    bodyFr: d.bodyFr,
    bodyTextFr: d.bodyTextFr,
    bodyEn: d.bodyEn || d.bodyFr,
    bodyTextEn: d.bodyTextEn || d.bodyTextFr,
    employmentType: d.employmentType,
    workMode: d.workMode,
    city: d.city ?? null,
    region: d.region ?? null,
    country: d.country,
    applicantCountries: normalizeApplicantCountries(d.applicantCountries?.split(",")),
    salaryMin: d.salaryMin ?? null,
    salaryMax: d.salaryMax ?? null,
    salaryPeriod: d.salaryPeriod,
    salaryCurrency: d.salaryCurrency,
    salaryVisible: d.salaryVisible,
    isCommission: d.isCommission,
    requiresDriverLicense: d.requiresDriverLicense,
    requiresVehicle: d.requiresVehicle,
    contractLabel: d.contractLabel ?? null,
    startDate: d.startDate ?? null,
    applicationDeadline: d.applicationDeadline ?? null,
    remoteDaysPerWeek: d.remoteDaysPerWeek ?? null,
    teamName: d.teamName ?? null,
    managerName: d.managerName ?? null,
    heroImagePath: d.heroImagePath ?? null,
    metaTitle: d.metaTitle ?? null,
    metaDescription: d.metaDescription ?? null,
    indexationTier: d.indexationTier,
    ogImagePath: d.ogImagePath ?? null,
    validThrough: d.validThrough ?? null,
    displayOrder: d.displayOrder,
    publishedAt,
    ...(bodyJsonFr !== undefined ? { bodyJsonFr } : {}),
    ...(bodyJsonEn !== undefined ? { bodyJsonEn } : {}),
    ...(screeningQuestions !== undefined ? { screeningQuestions } : {}),
    ...(perks !== undefined ? { perks } : {}),
    ...(jobLocations !== undefined ? { jobLocations } : {}),
  };

  try {
    const created = !d.id;
    const offer = d.id
      ? await prisma.jobOffer.update({ where: { id: d.id }, data })
      : await prisma.jobOffer.create({ data });
    await prisma.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: created ? "joboffer.created" : "joboffer.updated",
        targetType: "job_offer",
        targetId: offer.id,
        ipAddress: await getClientIp(),
      },
    });
    revalidatePath(adminPath("fr", "offres-emploi"));
    revalidatePath("/fr/carrieres");
    revalidatePath(`/fr/carrieres/${d.slug}`);
    if (existing?.slug && existing.slug !== d.slug) {
      revalidatePath(`/fr/carrieres/${existing.slug}`);
    }
    if (d.status === "published") pingOfferIndexing(d.slug, "publish", offer);
    else if (d.status === "archived") pingOfferIndexing(d.slug, "delete");
    return { ok: true, id: offer.id, created };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "internal";
    if (msg.includes("Unique") || msg.includes("unique")) {
      return { ok: false, error: "Slug déjà utilisé." };
    }
    return { ok: false, error: "Erreur interne." };
  }
}

// ============================================================
// archive (soft) / setFilled / clone / hard-delete
// ============================================================

const idSchema = z.object({ id: z.string().uuid() });
export type JobOfferActionState = { ok: true; id?: string } | { ok: false; error: string };

export async function archiveJobOfferAction(
  _prev: JobOfferActionState,
  formData: FormData,
): Promise<JobOfferActionState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "ID invalide." };

  const [archived] = await prisma.$transaction([
    prisma.jobOffer.update({
      where: { id: parsed.data.id },
      data: { status: "archived" },
    }),
    prisma.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: "joboffer.archived",
        targetType: "job_offer",
        targetId: parsed.data.id,
        ipAddress: await getClientIp(),
      },
    }),
  ]);
  revalidatePath(adminPath("fr", "offres-emploi"));
  revalidatePath("/fr/carrieres");
  if (archived?.slug) {
    revalidatePath(`/fr/carrieres/${archived.slug}`);
    pingOfferIndexing(archived.slug, "delete");
  }
  return { ok: true };
}

/** Marque l'offre « pourvue » → noindex au rendu + retrait sitemap + ping delete. */
export async function setJobOfferFilledAction(
  _prev: JobOfferActionState,
  formData: FormData,
): Promise<JobOfferActionState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "ID invalide." };

  const offer = await prisma.jobOffer.update({
    where: { id: parsed.data.id },
    data: { filledAt: new Date() },
  });
  await prisma.activityLog.create({
    data: {
      adminUserId: session.userId,
      action: "joboffer.filled",
      targetType: "job_offer",
      targetId: parsed.data.id,
      ipAddress: await getClientIp(),
    },
  });
  revalidatePath(adminPath("fr", "offres-emploi"));
  revalidatePath("/fr/carrieres");
  revalidatePath(`/fr/carrieres/${offer.slug}`);
  pingOfferIndexing(offer.slug, "delete");
  return { ok: true };
}

/** Duplique une offre (statut draft, slug suffixé) pour des postes similaires. */
export async function cloneJobOfferAction(
  _prev: JobOfferActionState,
  formData: FormData,
): Promise<JobOfferActionState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "ID invalide." };

  const src = await prisma.jobOffer.findUnique({
    where: { id: parsed.data.id },
  });
  if (!src) return { ok: false, error: "Offre introuvable." };

  // slug unique : suffixe -copie, -copie-2, …
  let newSlug = `${src.slug}-copie`.slice(0, 180);
  for (let i = 2; await prisma.jobOffer.findUnique({ where: { slug: newSlug } }); i++) {
    newSlug = `${src.slug}-copie-${i}`.slice(0, 180);
  }

  const {
    id: _id,
    slug: _slug,
    createdAt: _c,
    updatedAt: _u,
    publishedAt: _p,
    filledAt: _f,
    viewCount: _v,
    bodyJsonFr: _bjf,
    bodyJsonEn: _bje,
    screeningQuestions: _sq,
    perks: _pk,
    jobLocations: _jl,
    ...rest
  } = src;
  const clone = await prisma.jobOffer.create({
    data: {
      ...rest,
      slug: newSlug,
      titleFr: `${src.titleFr} (copie)`,
      titleEn: `${src.titleEn} (copy)`,
      status: "draft",
      publishedAt: null,
      filledAt: null,
      viewCount: 0,
      ...(src.bodyJsonFr != null ? { bodyJsonFr: src.bodyJsonFr as Prisma.InputJsonValue } : {}),
      ...(src.bodyJsonEn != null ? { bodyJsonEn: src.bodyJsonEn as Prisma.InputJsonValue } : {}),
      ...(src.screeningQuestions != null
        ? {
            screeningQuestions: src.screeningQuestions as Prisma.InputJsonValue,
          }
        : {}),
      ...(src.perks != null ? { perks: src.perks as Prisma.InputJsonValue } : {}),
      ...(src.jobLocations != null
        ? { jobLocations: src.jobLocations as Prisma.InputJsonValue }
        : {}),
    },
  });
  await prisma.activityLog.create({
    data: {
      adminUserId: session.userId,
      action: "joboffer.cloned",
      targetType: "job_offer",
      targetId: clone.id,
      ipAddress: await getClientIp(),
    },
  });
  revalidatePath(adminPath("fr", "offres-emploi"));
  return { ok: true, id: clone.id };
}

/**
 * Suppression DURE (super_admin) — purge d'abord les CV des candidatures sur
 * disque (le cascade SQL supprime les lignes mais PAS les fichiers), puis delete
 * l'offre (cascade → candidatures). Droit à l'effacement RGPD.
 */
export async function deleteJobOfferAction(
  _prev: JobOfferActionState,
  formData: FormData,
): Promise<JobOfferActionState> {
  let session;
  try {
    session = await requireSuperAdmin();
  } catch {
    return { ok: false, error: "Réservé au super-administrateur." };
  }
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "ID invalide." };

  const offer = await prisma.jobOffer.findUnique({
    where: { id: parsed.data.id },
    select: { slug: true, applications: { select: { cvStoragePath: true } } },
  });
  if (!offer) return { ok: false, error: "Offre introuvable." };

  // 1) purge fichiers CV (best-effort) AVANT le cascade DB
  await Promise.all(offer.applications.map((a) => deleteCv(a.cvStoragePath)));
  // 2) delete offre (cascade → job_applications)
  await prisma.jobOffer.delete({ where: { id: parsed.data.id } });
  await prisma.activityLog.create({
    data: {
      adminUserId: session.userId,
      action: "joboffer.deleted",
      targetType: "job_offer",
      targetId: parsed.data.id,
      ipAddress: await getClientIp(),
    },
  });
  revalidatePath(adminPath("fr", "offres-emploi"));
  revalidatePath("/fr/carrieres");
  pingOfferIndexing(offer.slug, "delete");
  return { ok: true };
}
