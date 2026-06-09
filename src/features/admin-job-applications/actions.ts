// Server Actions admin /candidatures — candidatures aux offres d'emploi.
// PII déchiffrées à la lecture (RBAC). Download CV via route dédiée (cv/route.ts).
// Suppression = purge CV disque + delete (droit à l'effacement).

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { adminPath } from "@/lib/admin-path";
import { decryptPii } from "@/lib/pii-crypto";
import { deleteCv } from "@/server/careers/cv-storage";
import type { JobApplicationStatus, Locale } from "../../../prisma/generated/client";

const STATUSES = [
  "new",
  "reviewing",
  "shortlisted",
  "rejected",
  "hired",
  "archived",
] as const;

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
  if ((session.user as { role?: string }).role !== "super_admin") throw new Error("forbidden");
  return { userId: session.user.id };
}

// ============================================================ list
const listSchema = z.object({
  offerId: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().uuid().optional()),
  status: z.enum([...STATUSES, "all"]).default("all"),
  onlyAttention: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(50),
});
export type ListApplicationsInput = z.infer<typeof listSchema>;

export interface JobApplicationListItem {
  id: string;
  offerId: string;
  offerTitleSnap: string;
  contactName: string;
  contactEmail: string;
  status: JobApplicationStatus;
  hasCv: boolean;
  needsAttention: boolean;
  submittedAt: Date;
}

export async function listApplicationsAction(input: Partial<ListApplicationsInput> = {}) {
  await requireAdminRead();
  const parsed = listSchema.parse(input);
  const where: Record<string, unknown> = {};
  if (parsed.offerId) where.offerId = parsed.offerId;
  if (parsed.status !== "all") where.status = parsed.status;
  if (parsed.onlyAttention) where.needsAttention = true;

  const [total, rows] = await Promise.all([
    prisma.jobApplication.count({ where }),
    prisma.jobApplication.findMany({
      where,
      orderBy: [{ submittedAt: "desc" }],
      skip: (parsed.page - 1) * parsed.pageSize,
      take: parsed.pageSize,
      select: {
        id: true,
        offerId: true,
        offerTitleSnap: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        cvStoragePath: true,
        needsAttention: true,
        submittedAt: true,
      },
    }),
  ]);

  const items: JobApplicationListItem[] = rows.map((r) => ({
    id: r.id,
    offerId: r.offerId,
    offerTitleSnap: r.offerTitleSnap,
    contactName: `${decryptPii(r.firstName)} ${decryptPii(r.lastName)}`.trim(),
    contactEmail: decryptPii(r.email),
    status: r.status,
    hasCv: Boolean(r.cvStoragePath),
    needsAttention: r.needsAttention,
    submittedAt: r.submittedAt,
  }));

  return {
    items,
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
    totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)),
  };
}

// ============================================================ detail
export interface JobApplicationDetail {
  id: string;
  offerId: string;
  offerTitleSnap: string;
  status: JobApplicationStatus;
  civility: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string | null;
  motivation: string | null;
  currentRole: string | null;
  experienceBand: string | null;
  availability: string | null;
  linkedinUrl: string | null;
  hasDriverLicense: boolean | null;
  hasVehicle: boolean | null;
  answers: Record<string, string>;
  hasCv: boolean;
  cvOriginalName: string | null;
  internalNotes: string | null;
  assignedTo: string | null;
  needsAttention: boolean;
  locale: Locale;
  submittedAt: Date;
}

export async function getApplicationDetailAction(id: string): Promise<JobApplicationDetail | null> {
  await requireAdminRead();
  const a = await prisma.jobApplication.findUnique({ where: { id } });
  if (!a) return null;
  const answers =
    a.answers && typeof a.answers === "object" && !Array.isArray(a.answers)
      ? (a.answers as Record<string, string>)
      : {};
  return {
    id: a.id,
    offerId: a.offerId,
    offerTitleSnap: a.offerTitleSnap,
    status: a.status,
    civility: a.civility,
    firstName: decryptPii(a.firstName),
    lastName: decryptPii(a.lastName),
    email: decryptPii(a.email),
    phone: decryptPii(a.phone),
    city: a.city,
    motivation: a.motivation,
    currentRole: a.currentRole,
    experienceBand: a.experienceBand,
    availability: a.availability,
    linkedinUrl: a.linkedinUrl,
    hasDriverLicense: a.hasDriverLicense,
    hasVehicle: a.hasVehicle,
    answers,
    hasCv: Boolean(a.cvStoragePath),
    cvOriginalName: a.cvOriginalName,
    internalNotes: a.internalNotes,
    assignedTo: a.assignedTo,
    needsAttention: a.needsAttention,
    locale: a.locale,
    submittedAt: a.submittedAt,
  };
}

// ============================================================ update status
const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES),
  internalNotes: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().max(4000).optional(),
  ),
  assignedTo: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().max(100).optional(),
  ),
  needsAttention: z.preprocess((v) => v === "true" || v === "on", z.boolean()),
});
export type UpdateApplicationState = { ok: true } | { ok: false; error: string };

export async function updateApplicationStatusAction(
  _prev: UpdateApplicationState,
  formData: FormData,
): Promise<UpdateApplicationState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    internalNotes: formData.get("internalNotes"),
    assignedTo: formData.get("assignedTo"),
    needsAttention: formData.get("needsAttention"),
  });
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  await prisma.jobApplication.update({
    where: { id: parsed.data.id },
    data: {
      status: parsed.data.status,
      internalNotes: parsed.data.internalNotes ?? null,
      assignedTo: parsed.data.assignedTo ?? null,
      needsAttention: parsed.data.needsAttention,
    },
  });
  await prisma.activityLog.create({
    data: {
      adminUserId: session.userId,
      action: "jobapplication.updated",
      targetType: "job_application",
      targetId: parsed.data.id,
      ipAddress: await getClientIp(),
    },
  });
  revalidatePath(adminPath("fr", "candidatures"));
  return { ok: true };
}

// ============================================================ delete (RGPD)
export async function deleteApplicationAction(
  _prev: UpdateApplicationState,
  formData: FormData,
): Promise<UpdateApplicationState> {
  let session;
  try {
    session = await requireSuperAdmin();
  } catch {
    return { ok: false, error: "Réservé au super-administrateur." };
  }
  const id = formData.get("id");
  if (typeof id !== "string") return { ok: false, error: "ID invalide." };

  const a = await prisma.jobApplication.findUnique({
    where: { id },
    select: { cvStoragePath: true },
  });
  if (!a) return { ok: false, error: "Candidature introuvable." };

  await deleteCv(a.cvStoragePath); // purge fichier AVANT le delete
  await prisma.jobApplication.delete({ where: { id } });
  await prisma.activityLog.create({
    data: {
      adminUserId: session.userId,
      action: "jobapplication.deleted",
      targetType: "job_application",
      targetId: id,
      ipAddress: await getClientIp(),
    },
  });
  revalidatePath(adminPath("fr", "candidatures"));
  return { ok: true };
}
