"use server";
// Server Actions Site Explorer Admin — Sprint Site Explorer 2026-05-22.
//
// RÈGLE : opérations uniquement sur routes visibility='public'.
// Aucune action admin/api ne doit apparaître dans ces résultats.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { siteRouteInspectorQueue, siteRouteAnomalyDetectorQueue } from "@/server/queue/queues";
import type { SiteRouteType, SiteRouteStatus } from "../../../../prisma/generated/client";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SiteRouteFilters {
  type?: SiteRouteType;
  status?: SiteRouteStatus;
  section?: string;
  editable?: boolean;
  search?: string;
  anomaliesOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface SiteRouteListItem {
  id: string;
  pathPattern: string;
  pathRendered: string | null;
  pathSlug: string | null;
  type: SiteRouteType;
  status: SiteRouteStatus;
  section: string | null;
  editable: boolean;
  editorRoute: string | null;
  httpStatus: number | null;
  metaTitle: string | null;
  wordCount: number | null;
  jsonLdCount: number | null;
  hasAiDisclaimer: boolean | null;
  lastInspectedAt: Date | null;
  depth: number;
  _count?: { anomalies: number };
}

export interface SiteRouteDetail extends SiteRouteListItem {
  metaDescription: string | null;
  h1: string | null;
  internalLinkCount: number | null;
  externalLinkCount: number | null;
  filePath: string | null;
  sourceDbTable: string | null;
  sourceDbId: string | null;
  lighthousePerf: number | null;
  lighthouseSeo: number | null;
  lighthouseA11y: number | null;
  lighthouseBP: number | null;
  lighthouseRunAt: Date | null;
  verticales: string[];
  anomalies: Array<{
    id: string;
    type: string;
    severity: string;
    description: string;
    detectedAt: Date;
    resolvedAt: Date | null;
  }>;
}

export interface SiteRouteStats {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  anomaliesHigh: number;
  anomaliesTotal: number;
  lastScanAt: Date | null;
}

// ─── listSiteRoutes ────────────────────────────────────────────────────────────

export async function listSiteRoutes(filters: SiteRouteFilters = {}): Promise<{
  routes: SiteRouteListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 50));
  const skip = (page - 1) * pageSize;

  const where = buildWhereClause(filters);

  const [routes, total] = await Promise.all([
    prisma.siteRoute.findMany({
      where,
      select: {
        id: true,
        pathPattern: true,
        pathRendered: true,
        pathSlug: true,
        type: true,
        status: true,
        section: true,
        editable: true,
        editorRoute: true,
        httpStatus: true,
        metaTitle: true,
        wordCount: true,
        jsonLdCount: true,
        hasAiDisclaimer: true,
        lastInspectedAt: true,
        depth: true,
        _count: { select: { anomalies: { where: { resolvedAt: null } } } },
      },
      orderBy: [{ depth: "asc" }, { section: "asc" }, { pathPattern: "asc" }],
      skip,
      take: pageSize,
    }),
    prisma.siteRoute.count({ where }),
  ]);

  return { routes, total, page, pageSize };
}

// ─── getSiteRouteDetail ────────────────────────────────────────────────────────

export async function getSiteRouteDetail(id: string): Promise<SiteRouteDetail | null> {
  const route = await prisma.siteRoute.findUnique({
    where: { id, visibility: "public" },
    include: {
      anomalies: {
        where: { resolvedAt: null },
        orderBy: [{ severity: "asc" }, { detectedAt: "desc" }],
      },
    },
  });

  if (!route) return null;

  return {
    id: route.id,
    pathPattern: route.pathPattern,
    pathRendered: route.pathRendered,
    pathSlug: route.pathSlug,
    type: route.type,
    status: route.status,
    section: route.section,
    editable: route.editable,
    editorRoute: route.editorRoute,
    httpStatus: route.httpStatus,
    metaTitle: route.metaTitle,
    metaDescription: route.metaDescription,
    h1: route.h1,
    wordCount: route.wordCount,
    jsonLdCount: route.jsonLdCount,
    internalLinkCount: route.internalLinkCount,
    externalLinkCount: route.externalLinkCount,
    hasAiDisclaimer: route.hasAiDisclaimer,
    lastInspectedAt: route.lastInspectedAt,
    depth: route.depth,
    filePath: route.filePath,
    sourceDbTable: route.sourceDbTable,
    sourceDbId: route.sourceDbId,
    lighthousePerf: route.lighthousePerf,
    lighthouseSeo: route.lighthouseSeo,
    lighthouseA11y: route.lighthouseA11y,
    lighthouseBP: route.lighthouseBP,
    lighthouseRunAt: route.lighthouseRunAt,
    verticales: route.verticales,
    anomalies: route.anomalies.map((a) => ({
      id: a.id,
      type: a.type,
      severity: a.severity,
      description: a.description,
      detectedAt: a.detectedAt,
      resolvedAt: a.resolvedAt,
    })),
  };
}

// ─── getSiteRouteStats ─────────────────────────────────────────────────────────

export async function getSiteRouteStats(): Promise<SiteRouteStats> {
  const [total, groupByType, groupByStatus, anomaliesHigh, anomaliesTotal, lastRoute] =
    await Promise.all([
      prisma.siteRoute.count({ where: { visibility: "public" } }),
      prisma.siteRoute.groupBy({
        by: ["type"],
        where: { visibility: "public" },
        _count: { _all: true },
      }),
      prisma.siteRoute.groupBy({
        by: ["status"],
        where: { visibility: "public" },
        _count: { _all: true },
      }),
      prisma.siteRouteAnomaly.count({
        where: { severity: "high", resolvedAt: null },
      }),
      prisma.siteRouteAnomaly.count({
        where: { resolvedAt: null },
      }),
      prisma.siteRoute.findFirst({
        where: { visibility: "public", lastInspectedAt: { not: null } },
        orderBy: { lastInspectedAt: "desc" },
        select: { lastInspectedAt: true },
      }),
    ]);

  const byType: Record<string, number> = {};
  for (const g of groupByType) {
    byType[g.type] = g._count._all;
  }

  const byStatus: Record<string, number> = {};
  for (const g of groupByStatus) {
    byStatus[g.status] = g._count._all;
  }

  return {
    total,
    byType,
    byStatus,
    anomaliesHigh,
    anomaliesTotal,
    lastScanAt: lastRoute?.lastInspectedAt ?? null,
  };
}

// ─── triggerInspection ─────────────────────────────────────────────────────────

const TriggerInspectionSchema = z.object({
  siteRouteId: z.string().cuid(),
});

export async function triggerInspection(
  siteRouteId: string,
): Promise<{ success: boolean; error?: string }> {
  const input = TriggerInspectionSchema.safeParse({ siteRouteId });
  if (!input.success) return { success: false, error: "ID route invalide" };

  // Vérifie que la route est bien publique (pas admin)
  const route = await prisma.siteRoute.findUnique({
    where: { id: siteRouteId, visibility: "public" },
    select: { id: true },
  });
  if (!route) return { success: false, error: "Route non trouvée ou non publique" };

  if (!siteRouteInspectorQueue) {
    return { success: false, error: "Queue BullMQ non disponible" };
  }

  await siteRouteInspectorQueue.add(
    "tick",
    { tick: new Date().toISOString(), siteRouteId },
    { jobId: `inspect-manual-${siteRouteId}-${Date.now()}` },
  );

  revalidatePath(adminPath("fr", "site-explorer"));
  return { success: true };
}

// ─── triggerScanAll ────────────────────────────────────────────────────────────

export async function triggerScanAll(): Promise<{ success: boolean; error?: string }> {
  if (!siteRouteInspectorQueue) {
    return { success: false, error: "Queue BullMQ non disponible" };
  }

  await siteRouteInspectorQueue.add(
    "tick",
    { tick: new Date().toISOString() },
    { jobId: `inspect-all-${Date.now()}` },
  );

  revalidatePath(adminPath("fr", "site-explorer"));
  return { success: true };
}

// ─── resolveAnomaly ────────────────────────────────────────────────────────────

export async function resolveAnomaly(
  anomalyId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!z.string().cuid().safeParse(anomalyId).success) {
    return { success: false, error: "ID anomalie invalide" };
  }

  await prisma.siteRouteAnomaly.update({
    where: { id: anomalyId },
    data: { resolvedAt: new Date() },
  });

  revalidatePath(adminPath("fr", "site-explorer/anomalies"));
  return { success: true };
}

// ─── listAnomalies ────────────────────────────────────────────────────────────

export async function listAnomalies(filters: {
  type?: string;
  severity?: string;
  resolved?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{
  anomalies: Array<{
    id: string;
    type: string;
    severity: string;
    description: string;
    detectedAt: Date;
    resolvedAt: Date | null;
    siteRoute: { pathPattern: string; pathRendered: string | null; section: string | null };
  }>;
  total: number;
}> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 50));
  const skip = (page - 1) * pageSize;

  const where = {
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.severity ? { severity: filters.severity } : {}),
    ...(filters.resolved === undefined
      ? {}
      : filters.resolved
        ? { resolvedAt: { not: null } }
        : { resolvedAt: null }),
  };

  const [anomalies, total] = await Promise.all([
    prisma.siteRouteAnomaly.findMany({
      where,
      include: {
        siteRoute: {
          select: { pathPattern: true, pathRendered: true, section: true },
        },
      },
      orderBy: [{ severity: "asc" }, { detectedAt: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.siteRouteAnomaly.count({ where }),
  ]);

  return { anomalies, total };
}

// ─── Helper buildWhereClause ───────────────────────────────────────────────────

function buildWhereClause(filters: SiteRouteFilters) {
  const where: Record<string, unknown> = {
    visibility: "public",
  };

  if (filters.type) where["type"] = filters.type;
  if (filters.status) where["status"] = filters.status;
  if (filters.section) where["section"] = filters.section;
  if (filters.editable !== undefined) where["editable"] = filters.editable;

  if (filters.search) {
    where["OR"] = [
      { pathPattern: { contains: filters.search, mode: "insensitive" } },
      { pathRendered: { contains: filters.search, mode: "insensitive" } },
      { metaTitle: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  if (filters.anomaliesOnly) {
    where["anomalies"] = { some: { resolvedAt: null } };
  }

  return where;
}
