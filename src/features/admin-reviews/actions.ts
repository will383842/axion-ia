// Server Actions admin — modération des avis clients (/[adminPrefix]/avis).
//
// Cycle : pending → published / hidden / rejected / archived (+ suppression dure
// super_admin). Transitions atomiques (updateMany where status attendu) → pas de
// double-transition concurrente. Chaque mutation : guard auth → mutation → activity
// log → revalidation des surfaces publiques + ping IndexNow.
//
// À la PUBLICATION : la photo privée (dépôt) est optimisée en photo publique.

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { SITE_URL } from "@/lib/seo";
import { pingIndexNow } from "@/lib/indexnow";
import { readCv, deleteCv } from "@/server/careers/cv-storage";
import { storeReviewPhotoPublic, deleteReviewPhotoPublic } from "@/server/reviews/photo-storage";
import { getServiceLine } from "@/lib/reviews/service-lines";
import { auth } from "@/auth";
import type { Prisma, CustomerReviewStatus } from "../../../prisma/generated/client";

export type AdminReviewActionState = { ok: true } | { ok: false; error: string };

// Guard auth local (pas d'import cross-domaine) : rôles admin autorisés en écriture.
interface AdminSession {
  readonly userId: string;
  readonly email: string;
  readonly role: string;
}

async function requireAdmin(): Promise<AdminSession> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role ?? "reader";
  if (role !== "super_admin" && role !== "admin" && role !== "editor") {
    throw new Error("forbidden");
  }
  return { userId: session.user.id, email: session.user.email, role };
}

async function requireSuperAdmin(): Promise<AdminSession> {
  const session = await requireAdmin();
  if (session.role !== "super_admin") throw new Error("forbidden");
  return session;
}

const ADMIN_SELECT = {
  id: true,
  slug: true,
  authorFirstName: true,
  authorLastInitial: true,
  companyName: true,
  clientSector: true,
  citySlug: true,
  cityName: true,
  departmentCode: true,
  regionSlug: true,
  serviceLine: true,
  rating: true,
  title: true,
  comment: true,
  photoKind: true,
  photoStoragePath: true,
  photoUrl: true,
  photoAlt: true,
  replyBody: true,
  repliedAt: true,
  repliedBy: true,
  status: true,
  isVerified: true,
  featured: true,
  moderatedBy: true,
  moderatedAt: true,
  moderationNotes: true,
  publishedAt: true,
  consentVersion: true,
  createdAt: true,
} satisfies Prisma.CustomerReviewSelect;

export type AdminReview = Prisma.CustomerReviewGetPayload<{ select: typeof ADMIN_SELECT }>;

// ============================================================
// Lecture
// ============================================================

const listSchema = z.object({
  // 🔴 Le défaut était `pending` — le compartiment normalement VIDE. Lu en
  // production le 2026-08-03 : la page s'ouvrait sur « En attente (0) · Aucun
  // avis pour ce filtre » alors que « Publié » en comptait 77. Une liste qui
  // s'ouvre sur du vide se lit comme une liste cassée.
  //
  // `all` ouvre sur ce qui existe ; les onglets restent là pour trier. Le
  // défaut est posé aux DEUX endroits (ici et dans la vue) — c'est en n'en
  // changeant qu'un seul qu'on croit avoir corrigé.
  status: z.enum(["pending", "published", "hidden", "rejected", "archived", "all"]).default("all"),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(50),
});
export type ListReviewsInput = z.infer<typeof listSchema>;

export async function listReviewsAction(input: Partial<ListReviewsInput> = {}): Promise<{
  items: AdminReview[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<string, number>;
}> {
  await requireAdmin();
  const parsed = listSchema.parse(input);
  const where: Prisma.CustomerReviewWhereInput = {};
  if (parsed.status !== "all") where.status = parsed.status;
  if (parsed.search && parsed.search.trim().length >= 2) {
    const q = parsed.search.trim();
    where.OR = [
      { authorFirstName: { contains: q, mode: "insensitive" } },
      { companyName: { contains: q, mode: "insensitive" } },
      { comment: { contains: q, mode: "insensitive" } },
      { cityName: { contains: q, mode: "insensitive" } },
    ];
  }
  const [total, items, grouped] = await Promise.all([
    prisma.customerReview.count({ where }),
    prisma.customerReview.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (parsed.page - 1) * parsed.pageSize,
      take: parsed.pageSize,
      select: ADMIN_SELECT,
    }),
    prisma.customerReview.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const counts: Record<string, number> = {};
  for (const g of grouped) counts[g.status] = g._count._all;
  return { items, total, page: parsed.page, pageSize: parsed.pageSize, counts };
}

export async function getReviewDetailAction(id: string): Promise<AdminReview | null> {
  await requireAdmin();
  return prisma.customerReview.findUnique({ where: { id }, select: ADMIN_SELECT });
}

// ============================================================
// Helpers mutation
// ============================================================

/** Chemins publics (préfixés locale) impactés par un avis. */
function publicPaths(r: {
  slug: string;
  citySlug: string | null;
  departmentCode: string | null;
  regionSlug: string | null;
  clientSector: string | null;
  serviceLine: string | null;
}): string[] {
  const p = new Set<string>(["/fr/avis", `/fr/avis/${r.slug}`, "/fr"]);
  if (r.citySlug) p.add(`/fr/avis/ville/${r.citySlug}`);
  if (r.departmentCode) p.add(`/fr/avis/departement/${r.departmentCode}`);
  if (r.clientSector) p.add(`/fr/avis/secteur/${r.clientSector}`);
  if (r.serviceLine) {
    p.add(`/fr/avis/service/${r.serviceLine}`);
    const svc = getServiceLine(r.serviceLine);
    if (svc) p.add(`/fr${svc.path}`);
  }
  return [...p];
}

function revalidateAndPing(paths: string[], context: string): void {
  for (const path of paths) revalidatePath(path);
  pingIndexNow(
    paths.filter((p) => !p.includes("[")).map((p) => `${SITE_URL}${p}`),
    context,
  );
}

async function logActivity(
  session: AdminSession,
  action: string,
  reviewId: string,
  changes?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: session.userId,
        action,
        targetType: "customer_review",
        targetId: reviewId,
        ...(changes ? { changes: changes as Prisma.InputJsonValue } : {}),
      },
    });
  } catch {
    // le log ne doit jamais faire échouer la modération
  }
}

/** Transition de statut atomique (garde contre double-transition concurrente). */
async function setStatus(
  id: string,
  to: CustomerReviewStatus,
  session: AdminSession,
  data: Prisma.CustomerReviewUpdateManyMutationInput = {},
): Promise<AdminReview | null> {
  const res = await prisma.customerReview.updateMany({
    where: { id, status: { not: to } },
    data: { ...data, status: to, moderatedBy: session.email, moderatedAt: new Date() },
  });
  if (res.count === 0) return null;
  return prisma.customerReview.findUnique({ where: { id }, select: ADMIN_SELECT });
}

function idFrom(formData: FormData): string {
  const id = formData.get("id");
  return typeof id === "string" ? id : "";
}

// ============================================================
// Mutations
// ============================================================

export async function publishReviewAction(
  _prev: AdminReviewActionState,
  formData: FormData,
): Promise<AdminReviewActionState> {
  const session = await requireAdmin();
  const id = idFrom(formData);
  if (!id) return { ok: false, error: "id manquant" };
  try {
    const current = await prisma.customerReview.findUnique({ where: { id }, select: ADMIN_SELECT });
    if (!current) return { ok: false, error: "Avis introuvable." };

    // Génère la photo publique optimisée si nécessaire (optionnelle → ne bloque pas)
    const extra: Prisma.CustomerReviewUpdateManyMutationInput = { publishedAt: new Date() };
    if (current.photoStoragePath && !current.photoUrl) {
      try {
        const buf = await readCv(current.photoStoragePath);
        extra.photoUrl = await storeReviewPhotoPublic(buf, current.id);
        extra.photoAlt = `Photo de ${current.authorFirstName} ${current.authorLastInitial}`.trim();
      } catch (e) {
        Sentry.captureException(e, { tags: { action: "publishReviewAction:photo" } });
      }
    }

    const updated = await setStatus(id, "published", session, extra);
    if (!updated) return { ok: false, error: "Transition impossible." };
    await logActivity(session, "review.publish", id, { rating: updated.rating });
    revalidateAndPing(publicPaths(updated), "review-publish");
    revalidatePath(adminPath("fr", "avis"));
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "publishReviewAction" } });
    return { ok: false, error: "Erreur lors de la publication." };
  }
}

export async function hideReviewAction(
  _prev: AdminReviewActionState,
  formData: FormData,
): Promise<AdminReviewActionState> {
  const session = await requireAdmin();
  const id = idFrom(formData);
  if (!id) return { ok: false, error: "id manquant" };
  try {
    const updated = await setStatus(id, "hidden", session);
    if (!updated) return { ok: false, error: "Transition impossible." };
    await logActivity(session, "review.hide", id);
    revalidateAndPing(publicPaths(updated), "review-hide");
    revalidatePath(adminPath("fr", "avis"));
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "hideReviewAction" } });
    return { ok: false, error: "Erreur." };
  }
}

export async function rejectReviewAction(
  _prev: AdminReviewActionState,
  formData: FormData,
): Promise<AdminReviewActionState> {
  const session = await requireAdmin();
  const id = idFrom(formData);
  if (!id) return { ok: false, error: "id manquant" };
  const notes = (formData.get("notes") as string | null)?.slice(0, 2000) ?? null;
  try {
    const updated = await setStatus(id, "rejected", session, { moderationNotes: notes });
    if (!updated) return { ok: false, error: "Transition impossible." };
    await logActivity(session, "review.reject", id, { notes });
    revalidateAndPing(publicPaths(updated), "review-reject");
    revalidatePath(adminPath("fr", "avis"));
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "rejectReviewAction" } });
    return { ok: false, error: "Erreur." };
  }
}

export async function replyReviewAction(
  _prev: AdminReviewActionState,
  formData: FormData,
): Promise<AdminReviewActionState> {
  const session = await requireAdmin();
  const id = idFrom(formData);
  if (!id) return { ok: false, error: "id manquant" };
  const body = (formData.get("replyBody") as string | null)?.trim().slice(0, 3000) ?? "";
  try {
    const updated = await prisma.customerReview.update({
      where: { id },
      data: body
        ? { replyBody: body, repliedAt: new Date(), repliedBy: session.email }
        : { replyBody: null, repliedAt: null, repliedBy: null },
      select: ADMIN_SELECT,
    });
    await logActivity(session, "review.reply", id);
    revalidateAndPing(publicPaths(updated), "review-reply");
    revalidatePath(adminPath("fr", "avis"));
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "replyReviewAction" } });
    return { ok: false, error: "Erreur." };
  }
}

export async function toggleVerifiedReviewAction(
  _prev: AdminReviewActionState,
  formData: FormData,
): Promise<AdminReviewActionState> {
  const session = await requireAdmin();
  const id = idFrom(formData);
  const verified = formData.get("verified") === "true";
  if (!id) return { ok: false, error: "id manquant" };
  try {
    const updated = await prisma.customerReview.update({
      where: { id },
      data: { isVerified: verified },
      select: ADMIN_SELECT,
    });
    await logActivity(session, "review.verify", id, { verified });
    revalidateAndPing(publicPaths(updated), "review-verify");
    revalidatePath(adminPath("fr", "avis"));
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "toggleVerifiedReviewAction" } });
    return { ok: false, error: "Erreur." };
  }
}

export async function toggleFeaturedReviewAction(
  _prev: AdminReviewActionState,
  formData: FormData,
): Promise<AdminReviewActionState> {
  const session = await requireAdmin();
  const id = idFrom(formData);
  const featured = formData.get("featured") === "true";
  if (!id) return { ok: false, error: "id manquant" };
  try {
    const updated = await prisma.customerReview.update({
      where: { id },
      data: { featured },
      select: ADMIN_SELECT,
    });
    await logActivity(session, "review.feature", id, { featured });
    revalidateAndPing(publicPaths(updated), "review-feature");
    revalidatePath(adminPath("fr", "avis"));
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "toggleFeaturedReviewAction" } });
    return { ok: false, error: "Erreur." };
  }
}

/** Suppression dure (super_admin) + effacement des photos privée & publique (RGPD). */
export async function deleteReviewAction(
  _prev: AdminReviewActionState,
  formData: FormData,
): Promise<AdminReviewActionState> {
  const session = await requireSuperAdmin();
  const id = idFrom(formData);
  if (!id) return { ok: false, error: "id manquant" };
  try {
    const current = await prisma.customerReview.findUnique({ where: { id }, select: ADMIN_SELECT });
    if (!current) return { ok: false, error: "Avis introuvable." };
    await prisma.customerReview.delete({ where: { id } });
    await Promise.allSettled([
      deleteCv(current.photoStoragePath),
      deleteReviewPhotoPublic(current.id),
    ]);
    await logActivity(session, "review.delete", id);
    revalidateAndPing(publicPaths(current), "review-delete");
    revalidatePath(adminPath("fr", "avis"));
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "deleteReviewAction" } });
    return { ok: false, error: "Erreur lors de la suppression." };
  }
}

// ============================================================
// Photo (upload / retrait direct côté admin)
// ============================================================

const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 Mo (aligné dépôt public)

/** Validation photo admin : taille + magic-bytes JPEG/PNG/WebP/HEIC (null = OK). */
function validateReviewPhoto(file: File, buf: Buffer): string | null {
  if (file.size === 0) return "Fichier vide.";
  if (file.size > PHOTO_MAX_BYTES) return "Photo trop volumineuse (5 Mo max).";
  const s = buf.subarray(0, 12);
  const isJpg = s[0] === 0xff && s[1] === 0xd8 && s[2] === 0xff;
  const isPng = s[0] === 0x89 && s[1] === 0x50 && s[2] === 0x4e && s[3] === 0x47;
  const isWebp =
    s[0] === 0x52 &&
    s[1] === 0x49 &&
    s[2] === 0x46 &&
    s[3] === 0x46 &&
    s[8] === 0x57 &&
    s[9] === 0x45 &&
    s[10] === 0x42 &&
    s[11] === 0x50;
  const isHeif = s[4] === 0x66 && s[5] === 0x74 && s[6] === 0x79 && s[7] === 0x70;
  if (!isJpg && !isPng && !isWebp && !isHeif)
    return "Photo non supportée (JPG, PNG, WebP ou HEIC).";
  return null;
}

/** Normalise le type de photo (défaut portrait). */
function reviewPhotoKind(formData: FormData): string {
  return formData.get("photoKind") === "logo" ? "logo" : "portrait";
}

/**
 * Upload direct d'une photo publique pour un avis (console admin). Optimisée
 * Sharp (carré 512 WebP q82, EXIF/GPS strippés → RGPD). Réservé aux vraies
 * photos client fournies avec accord — jamais d'illustration générique.
 */
export async function uploadReviewPhotoAction(
  _prev: AdminReviewActionState,
  formData: FormData,
): Promise<AdminReviewActionState> {
  const session = await requireAdmin();
  const id = idFrom(formData);
  if (!id) return { ok: false, error: "id manquant" };
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Aucun fichier fourni." };
  try {
    const current = await prisma.customerReview.findUnique({
      where: { id },
      select: { id: true, authorFirstName: true, authorLastInitial: true },
    });
    if (!current) return { ok: false, error: "Avis introuvable." };

    const buf = Buffer.from(await file.arrayBuffer());
    const invalid = validateReviewPhoto(file, buf);
    if (invalid) return { ok: false, error: invalid };

    let photoUrl: string;
    try {
      // Cache-buster `?v=` : la route sert la photo en `immutable` (1 an) et un
      // remplacement réutilise le même id/URL → sans ce param, l'ancienne image
      // resterait cachée navigateur/CDN. La route ignore la query (id = path).
      photoUrl = `${await storeReviewPhotoPublic(buf, current.id)}?v=${Date.now()}`;
    } catch (e) {
      Sentry.captureException(e, { tags: { action: "uploadReviewPhotoAction:sharp" } });
      return { ok: false, error: "Image illisible ou format non pris en charge." };
    }

    const updated = await prisma.customerReview.update({
      where: { id },
      data: {
        photoUrl,
        photoKind: reviewPhotoKind(formData),
        photoAlt: `Photo de ${current.authorFirstName} ${current.authorLastInitial}`.trim(),
      },
      select: ADMIN_SELECT,
    });
    await logActivity(session, "review.photo_upload", id, { kind: updated.photoKind });
    revalidateAndPing(publicPaths(updated), "review-photo-upload");
    revalidatePath(adminPath("fr", "avis"));
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "uploadReviewPhotoAction" } });
    return { ok: false, error: "Erreur lors de l'envoi de la photo." };
  }
}

/** Retire la photo publique d'un avis (fichier disque + champs DB). Idempotent. */
export async function removeReviewPhotoAction(
  _prev: AdminReviewActionState,
  formData: FormData,
): Promise<AdminReviewActionState> {
  const session = await requireAdmin();
  const id = idFrom(formData);
  if (!id) return { ok: false, error: "id manquant" };
  try {
    await deleteReviewPhotoPublic(id);
    const updated = await prisma.customerReview.update({
      where: { id },
      data: { photoUrl: null, photoAlt: null, photoKind: null },
      select: ADMIN_SELECT,
    });
    await logActivity(session, "review.photo_remove", id);
    revalidateAndPing(publicPaths(updated), "review-photo-remove");
    revalidatePath(adminPath("fr", "avis"));
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "removeReviewPhotoAction" } });
    return { ok: false, error: "Erreur lors du retrait de la photo." };
  }
}
