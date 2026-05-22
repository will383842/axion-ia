"use server";

/**
 * Server Actions — External Links Database
 *
 * Sprint External Links Database 2026-05-22.
 * Cf. /content-gen/external-links admin page.
 */

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ALL_EXTERNAL_LINKS } from "@/data/external-links/master";
import { getExternalLinksStats } from "@/data/external-links/master";
import type { ExternalLink, ExternalLinkAuthority } from "@/data/external-links/types";

// Sprint Final P1-3 — Zod runtime validation des inputs Server Actions.
const ListExternalLinksFiltersSchema = z
  .object({
    category: z.string().max(120).optional(),
    scope: z.string().max(120).optional(),
    minAuthority: z.number().int().min(0).max(10).optional(),
    status: z.string().max(60).optional(),
    regionSlug: z.string().max(120).optional(),
    vertical: z.string().max(120).optional(),
    search: z.string().max(500).optional(),
    limit: z.number().int().min(1).max(5000).optional(),
    offset: z.number().int().min(0).max(1_000_000).optional(),
    onlyProblems: z.boolean().optional(),
  })
  .strict();

export interface ExternalLinkRow extends ExternalLink {
  readonly usageCountFromDb: number;
  readonly lastUsedAtFromDb: string | null;
}

export interface ListExternalLinksFilters {
  readonly category?: string;
  readonly scope?: string;
  readonly minAuthority?: ExternalLinkAuthority;
  readonly status?: string;
  readonly regionSlug?: string;
  readonly vertical?: string;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly onlyProblems?: boolean;
}

export interface ListExternalLinksResult {
  readonly total: number;
  readonly stats: ReturnType<typeof getExternalLinksStats>;
  readonly rows: ReadonlyArray<ExternalLinkRow>;
  readonly lastMonitorRun: {
    readonly analyzedAt: string | null;
    readonly broken: number;
    readonly totalLinks: number;
  } | null;
  readonly topUsedLinks: ReadonlyArray<{
    readonly linkId: string;
    readonly title: string;
    readonly usageCount: number;
    readonly lastUsedAt: string | null;
  }>;
}

async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

/**
 * Liste paginée + stats du catalogue.
 */
export async function listExternalLinks(
  filters: ListExternalLinksFilters = {},
): Promise<ListExternalLinksResult> {
  await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  ListExternalLinksFiltersSchema.parse(filters);

  const {
    category,
    scope,
    minAuthority,
    status,
    regionSlug,
    vertical,
    search,
    limit = 100,
    offset = 0,
    onlyProblems,
  } = filters;

  // Hydrate usage stats depuis DB
  const usages = await prisma.externalLinkUsage.findMany({
    where: { externalLinkId: { in: ALL_EXTERNAL_LINKS.map((l) => l.id) } },
  });
  const usageMap = new Map(usages.map((u) => [u.externalLinkId, u]));

  let filtered = ALL_EXTERNAL_LINKS.filter((l) => {
    if (category && l.category !== category) return false;
    if (scope && l.scope !== scope) return false;
    if (minAuthority !== undefined && l.authority < minAuthority) return false;
    if (status && l.status !== status) return false;
    if (regionSlug && l.regionSlug !== regionSlug) return false;
    if (vertical && !l.verticales.includes(vertical)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !l.title.toLowerCase().includes(q) &&
        !l.organization.toLowerCase().includes(q) &&
        !l.url.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    if (onlyProblems) {
      const hasProblem =
        l.status === "404" ||
        l.status === "deprecated" ||
        l.paywall ||
        !l.indexable ||
        !l.isHttps ||
        l.isCompetitor;
      if (!hasProblem) return false;
    }
    return true;
  });

  const total = filtered.length;
  filtered = filtered.slice(offset, offset + limit);

  const rows: ExternalLinkRow[] = filtered.map((l) => {
    const u = usageMap.get(l.id);
    return {
      ...l,
      usageCountFromDb: u?.usageCount ?? 0,
      lastUsedAtFromDb: u?.lastUsedAt.toISOString() ?? null,
    };
  });

  // Top 10 liens les plus cités
  const topUsages = [...usages]
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 10)
    .map((u) => {
      const link = ALL_EXTERNAL_LINKS.find((l) => l.id === u.externalLinkId);
      return {
        linkId: u.externalLinkId,
        title: link?.title ?? u.externalLinkId,
        usageCount: u.usageCount,
        lastUsedAt: u.lastUsedAt.toISOString(),
      };
    });

  // Last monitor run from ContentGenConfig
  let lastMonitorRun: ListExternalLinksResult["lastMonitorRun"] = null;
  try {
    const row = await prisma.contentGenConfig.findUnique({
      where: { key: "external_links_last_check" },
    });
    if (row?.value && typeof row.value === "object") {
      const v = row.value as Record<string, unknown>;
      lastMonitorRun = {
        analyzedAt: (v.analyzedAt as string) ?? null,
        broken: (v.broken as number) ?? 0,
        totalLinks: (v.totalLinks as number) ?? 0,
      };
    }
  } catch {
    /* best-effort */
  }

  return {
    total,
    stats: getExternalLinksStats(),
    rows,
    lastMonitorRun,
    topUsedLinks: topUsages,
  };
}

/**
 * Enqueue un job de vérification HEAD batch immédiate (admin trigger).
 * Bypass la cron mensuelle pour re-vérifier le catalogue à la demande.
 */
export async function triggerManualVerification(): Promise<{ jobId: string } | { error: string }> {
  await requireAdmin();
  // Lazy import BullMQ pour éviter d'instancier Redis dans tests / build
  const { Queue } = await import("bullmq");
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || redisUrl.includes("stub.invalid")) {
    return { error: "REDIS_URL absent ou stub-mode" };
  }
  const queue = new Queue("external-links-monitor", { connection: { url: redisUrl } });
  const job = await queue.add(
    "manual-trigger",
    { triggeredAt: new Date().toISOString() },
    { removeOnComplete: 100, removeOnFail: 50 },
  );
  return { jobId: job.id ?? "unknown" };
}

/**
 * Reset usage stats (admin only). Utile pour repartir de zéro après campagne test.
 */
export async function resetUsageStats(): Promise<{ deletedCount: number }> {
  await requireAdmin();
  const result = await prisma.externalLinkUsage.deleteMany({});
  return { deletedCount: result.count };
}
