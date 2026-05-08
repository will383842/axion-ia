// Server Actions admin /newsletter (M9 Tier 3 section 1).
//
// Newsletter subscribers : pas de creation manuelle (subscribers s'inscrivent
// via form public + double opt-in RFC 8058). Admin peut :
//  - lister avec filtres (status, locale, source, search, dateRange)
//  - desabonner manuellement (force unsubscribe)
//  - exporter CSV pour MailWizz import / segmentation
//  - voir stats par status × locale

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import type { NewsletterStatus, Locale } from "../../../prisma/generated/client";

async function requireAdminWrite() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin") throw new Error("forbidden");
  return { userId: session.user.id, role };
}
async function requireAdminRead() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  return session.user.id;
}

// ============================================================
// list / stats
// ============================================================

const listSchema = z.object({
  status: z.enum(["pending", "confirmed", "unsubscribed", "bounced", "all"]).default("all"),
  locale: z.enum(["fr", "en", "all"]).default("all"),
  source: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(200).default(50),
});
export type ListSubscribersInput = z.infer<typeof listSchema>;

export interface SubscriberListItem {
  id: string;
  email: string;
  locale: Locale;
  status: NewsletterStatus;
  source: string | null;
  confirmedAt: Date | null;
  unsubscribedAt: Date | null;
  createdAt: Date;
}

export async function listSubscribersAction(input: Partial<ListSubscribersInput> = {}) {
  await requireAdminRead();
  const parsed = listSchema.parse(input);
  const where: Record<string, unknown> = {};
  if (parsed.status !== "all") where.status = parsed.status;
  if (parsed.locale !== "all") where.locale = parsed.locale;
  if (parsed.source) where.source = parsed.source;
  if (parsed.dateFrom || parsed.dateTo) {
    const range: { gte?: Date; lte?: Date } = {};
    if (parsed.dateFrom) range.gte = new Date(parsed.dateFrom);
    if (parsed.dateTo) {
      const to = new Date(parsed.dateTo);
      to.setUTCHours(23, 59, 59, 999);
      range.lte = to;
    }
    where.createdAt = range;
  }
  if (parsed.search && parsed.search.length >= 2) {
    where.email = { contains: parsed.search, mode: "insensitive" };
  }

  const [total, items] = await Promise.all([
    prisma.newsletterSubscriber.count({ where }),
    prisma.newsletterSubscriber.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (parsed.page - 1) * parsed.pageSize,
      take: parsed.pageSize,
      select: {
        id: true,
        email: true,
        locale: true,
        status: true,
        source: true,
        confirmedAt: true,
        unsubscribedAt: true,
        createdAt: true,
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

export async function getNewsletterStatsAction() {
  await requireAdminRead();
  // counts par status (per locale)
  const counts = await prisma.newsletterSubscriber.groupBy({
    by: ["status", "locale"],
    _count: { _all: true },
  });
  // Initialise une grille
  const grid: Record<string, Record<string, number>> = {
    pending: { fr: 0, en: 0 },
    confirmed: { fr: 0, en: 0 },
    unsubscribed: { fr: 0, en: 0 },
    bounced: { fr: 0, en: 0 },
  };
  for (const row of counts) {
    if (grid[row.status]) {
      grid[row.status]![row.locale] = row._count._all;
    }
  }
  return grid;
}

// ============================================================
// force unsubscribe (admin)
// ============================================================

const unsubSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});
export type UnsubscribeState = { ok: true } | { ok: false; error: string };

export async function forceUnsubscribeAction(
  _prev: UnsubscribeState,
  formData: FormData,
): Promise<UnsubscribeState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }
  const parsed = unsubSchema.safeParse({
    id: formData.get("id"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "ID invalide." };

  const ip = await getClientIp();
  const logData: {
    adminUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    ipAddress: string;
    changes?: { reason: string };
  } = {
    adminUserId: session.userId,
    action: "newsletter.force_unsubscribe",
    targetType: "newsletter_subscriber",
    targetId: parsed.data.id,
    ipAddress: ip,
  };
  if (parsed.data.reason) logData.changes = { reason: parsed.data.reason };

  await prisma.$transaction([
    prisma.newsletterSubscriber.update({
      where: { id: parsed.data.id },
      data: { status: "unsubscribed", unsubscribedAt: new Date() },
    }),
    prisma.activityLog.create({ data: logData }),
  ]);
  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9"}/newsletter`);
  return { ok: true };
}

// ============================================================
// export CSV (RGPD-friendly : pas d'export des unsubscribed)
// ============================================================

export async function exportSubscribersCsvAction(
  input: Partial<ListSubscribersInput> = {},
): Promise<{ filename: string; csv: string }> {
  await requireAdminRead();
  const parsed = listSchema.parse({ ...input, pageSize: 200, page: 1 });
  const where: Record<string, unknown> = {};
  // Par defaut on exporte uniquement les confirmed (pour MailWizz / RGPD).
  where.status = parsed.status === "all" ? "confirmed" : parsed.status;
  if (parsed.locale !== "all") where.locale = parsed.locale;
  if (parsed.source) where.source = parsed.source;

  const rows = await prisma.newsletterSubscriber.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10000,
    select: {
      email: true,
      locale: true,
      status: true,
      source: true,
      confirmedAt: true,
      unsubscribedAt: true,
      createdAt: true,
      mailwizzListUid: true,
      mailwizzSubUid: true,
    },
  });

  const headers = [
    "email",
    "locale",
    "status",
    "source",
    "confirmedAt",
    "unsubscribedAt",
    "createdAt",
    "mailwizzListUid",
    "mailwizzSubUid",
  ];
  const escape = (v: unknown): string => {
    if (v == null) return "";
    const s = v instanceof Date ? v.toISOString() : String(v);
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = rows.map((r) =>
    headers.map((h) => escape((r as unknown as Record<string, unknown>)[h])).join(";"),
  );
  const csv = "﻿" + headers.join(";") + "\r\n" + lines.join("\r\n");
  const filename = `axion-ia-newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
  return { filename, csv };
}
