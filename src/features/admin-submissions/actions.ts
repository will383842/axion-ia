// Server Actions admin /soumissions (M9 Tier 1 section 1).
//
// Doctrine CLAUDE.md §14 : tous les forms publics sont stockes en table
// `submissions`. Cette section permet a l'admin de :
//  - lister avec filtres (type / status / locale / date / search)
//  - voir le detail (incluant bookings lies si type='intervention')
//  - mettre a jour status + internalNotes + assignedTo
//  - exporter en CSV UTF-8 BOM (Excel-compatible)

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import type { SubmissionType, SubmissionStatus, Locale } from "../../../prisma/generated/client";

// ============================================================
// AUTH guard helper (RBAC simple V1 : super_admin/admin/editor)
// ============================================================

async function requireAdminWriteSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin" && role !== "editor") {
    throw new Error("forbidden");
  }
  return { userId: session.user.id, role };
}

async function requireAdminReadSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  return session.user.id;
}

// ============================================================
// listSubmissions — filtres + pagination
// ============================================================

const listSubmissionsSchema = z.object({
  type: z.enum(["audit", "implementation", "intervention", "contact", "all"]).default("all"),
  status: z.enum(["new", "in_progress", "processed", "archived", "all"]).default("all"),
  locale: z.enum(["fr", "en", "all"]).default("all"),
  search: z.string().optional(),
  /** ISO date YYYY-MM-DD inclusif. */
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});
export type ListSubmissionsInput = z.infer<typeof listSubmissionsSchema>;

export interface SubmissionListItem {
  id: string;
  type: SubmissionType;
  status: SubmissionStatus;
  locale: Locale;
  companyName: string;
  contactName: string;
  contactEmail: string;
  sector: string | null;
  assignedTo: string | null;
  submittedAt: Date;
}

export interface SubmissionListResult {
  items: SubmissionListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listSubmissionsAction(
  input: Partial<ListSubmissionsInput> = {},
): Promise<SubmissionListResult> {
  await requireAdminReadSession();
  const parsed = listSubmissionsSchema.parse(input);

  const where: Parameters<typeof prisma.submission.findMany>[0] extends infer T
    ? T extends { where?: infer W }
      ? W
      : never
    : never = {};

  if (parsed.type !== "all") where.type = parsed.type;
  if (parsed.status !== "all") where.status = parsed.status;
  if (parsed.locale !== "all") where.locale = parsed.locale;

  if (parsed.dateFrom || parsed.dateTo) {
    where.submittedAt = {};
    if (parsed.dateFrom) (where.submittedAt as { gte?: Date }).gte = new Date(parsed.dateFrom);
    if (parsed.dateTo) {
      const to = new Date(parsed.dateTo);
      to.setUTCHours(23, 59, 59, 999);
      (where.submittedAt as { lte?: Date }).lte = to;
    }
  }

  if (parsed.search) {
    const q = parsed.search.trim();
    if (q.length >= 2) {
      where.OR = [
        { contactEmail: { contains: q, mode: "insensitive" } },
        { contactName: { contains: q, mode: "insensitive" } },
        { companyName: { contains: q, mode: "insensitive" } },
      ];
    }
  }

  const [total, items] = await Promise.all([
    prisma.submission.count({ where }),
    prisma.submission.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      skip: (parsed.page - 1) * parsed.pageSize,
      take: parsed.pageSize,
      select: {
        id: true,
        type: true,
        status: true,
        locale: true,
        companyName: true,
        contactName: true,
        contactEmail: true,
        sector: true,
        assignedTo: true,
        submittedAt: true,
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
// getSubmissionDetail
// ============================================================

export async function getSubmissionDetailAction(id: string) {
  await requireAdminReadSession();
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      bookings: {
        select: {
          id: true,
          interventionType: true,
          bookingDate: true,
          participantsCount: true,
          status: true,
          pricePaidCents: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  return submission;
}

// ============================================================
// updateSubmission — status + internalNotes + assignedTo
// ============================================================

const updateSubmissionSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "in_progress", "processed", "archived"]).optional(),
  internalNotes: z.string().max(5000).nullable().optional(),
  assignedTo: z.string().max(100).nullable().optional(),
});
export type UpdateSubmissionState = { ok: true } | { ok: false; error: string };

export async function updateSubmissionAction(
  _prev: UpdateSubmissionState,
  formData: FormData,
): Promise<UpdateSubmissionState> {
  let session;
  try {
    session = await requireAdminWriteSession();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }

  const parsed = updateSubmissionSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status") || undefined,
    internalNotes: formData.get("internalNotes") || null,
    assignedTo: formData.get("assignedTo") || null,
  });
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const ip = await getClientIp();
  const data: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.internalNotes !== undefined) data.internalNotes = parsed.data.internalNotes;
  if (parsed.data.assignedTo !== undefined) data.assignedTo = parsed.data.assignedTo;

  await prisma.$transaction([
    prisma.submission.update({ where: { id: parsed.data.id }, data }),
    prisma.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: "submission.updated",
        targetType: "submission",
        targetId: parsed.data.id,
        changes: data as Record<string, string | null>,
        ipAddress: ip,
      },
    }),
  ]);
  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9"}/submissions`);
  return { ok: true };
}

// ============================================================
// exportSubmissionsCsv — UTF-8 BOM (Excel compatible)
// ============================================================

export async function exportSubmissionsCsvAction(
  input: Partial<ListSubmissionsInput> = {},
): Promise<{ filename: string; csv: string }> {
  await requireAdminReadSession();
  const parsed = listSubmissionsSchema.parse({ ...input, pageSize: 100, page: 1 });

  const where: Record<string, unknown> = {};
  if (parsed.type !== "all") where.type = parsed.type;
  if (parsed.status !== "all") where.status = parsed.status;
  if (parsed.locale !== "all") where.locale = parsed.locale;

  // Cap export a 5000 lignes pour ne pas saturer la RAM admin V1.
  const rows = await prisma.submission.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    take: 5000,
    select: {
      id: true,
      type: true,
      status: true,
      locale: true,
      companyName: true,
      sector: true,
      contactName: true,
      contactRole: true,
      contactEmail: true,
      contactPhone: true,
      employeesCount: true,
      address: true,
      assignedTo: true,
      internalNotes: true,
      submittedAt: true,
    },
  });

  const headers = [
    "id",
    "type",
    "status",
    "locale",
    "companyName",
    "sector",
    "contactName",
    "contactRole",
    "contactEmail",
    "contactPhone",
    "employeesCount",
    "address",
    "assignedTo",
    "internalNotes",
    "submittedAt",
  ];
  const escape = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = rows.map((r) =>
    headers.map((h) => escape((r as unknown as Record<string, unknown>)[h])).join(";"),
  );
  // BOM UTF-8 + CRLF (Windows Excel friendly)
  const csv = "﻿" + headers.join(";") + "\r\n" + lines.join("\r\n");
  const filename = `axion-ia-submissions-${new Date().toISOString().slice(0, 10)}.csv`;

  return { filename, csv };
}
