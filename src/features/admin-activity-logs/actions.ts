// Server Actions admin /activity-logs (M9 Tier 3 section 4 — DERNIERE).
//
// Lecture seule. Tous les admin peuvent voir l'audit trail. Filtres :
// adminUserId, action, targetType, dateRange, search.
// Cap 1000 dernieres lignes par defaut + pagination.

"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdminRead() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  return session.user.id;
}

const listSchema = z.object({
  adminUserId: z.string().uuid().optional(),
  action: z.string().max(120).optional(),
  targetType: z.string().max(80).optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(200).default(50),
});
export type ListActivityLogsInput = z.infer<typeof listSchema>;

export async function listActivityLogsAction(input: Partial<ListActivityLogsInput> = {}) {
  await requireAdminRead();
  const parsed = listSchema.parse(input);
  const where: Record<string, unknown> = {};
  if (parsed.adminUserId) where.adminUserId = parsed.adminUserId;
  if (parsed.action) where.action = { contains: parsed.action, mode: "insensitive" };
  if (parsed.targetType) where.targetType = parsed.targetType;
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
    where.OR = [
      { action: { contains: parsed.search, mode: "insensitive" } },
      { targetId: parsed.search },
      { ipAddress: { contains: parsed.search, mode: "insensitive" } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (parsed.page - 1) * parsed.pageSize,
      take: parsed.pageSize,
      include: {
        adminUser: { select: { id: true, name: true, email: true } },
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

/** Helper select : tous les admins pour le filtre. */
export async function listAdminUsersOptionsAction() {
  await requireAdminRead();
  return prisma.adminUser.findMany({
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}

/** Stats : count par action top-20. */
export async function getActivityLogStatsAction(): Promise<
  Array<{ action: string; count: number }>
> {
  await requireAdminRead();
  const grouped = await prisma.activityLog.groupBy({
    by: ["action"],
    _count: { _all: true },
    orderBy: { _count: { action: "desc" } },
    take: 20,
  });
  return grouped.map((g) => ({ action: g.action, count: g._count._all }));
}
