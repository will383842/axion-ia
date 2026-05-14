/**
 * Content Generator — Export CSV (Fix P1-11 audit opérationnel 2026-05-14).
 *
 * § 12.1 master prompt — bouton "Export CSV avec filtres actifs" sur
 * /publications-status + § 15.1 "Export CSV total" sur /geo.
 *
 * Route handler `GET /api/content-gen/export?type=jobs&status=published&...`
 * retourne un text/csv avec BOM UTF-8 (Excel-friendly FR). Auth admin
 * exigée via requireAdmin (RBAC).
 *
 * Limite : 10 000 lignes par export pour éviter timeout. Pour des exports
 * plus larges, paginer côté admin ou ajouter un job BullMQ asynchrone V2.
 */

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type {
  ContentGenJobStatus,
  ContentType,
  IndexationTier,
  PublishStatus,
} from "../../../../../prisma/generated/client";
import { requireAdmin } from "@/server/actions/content-gen/_auth";

const MAX_ROWS = 10_000;

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
): string {
  const lines: string[] = [headers.join(",")];
  for (const row of rows) lines.push(row.map(csvEscape).join(","));
  // BOM UTF-8 : Excel ouvre le fichier en UTF-8 sans cette précision.
  return "﻿" + lines.join("\n");
}

async function exportJobs(searchParams: URLSearchParams): Promise<Response> {
  const status = searchParams.get("status") as ContentGenJobStatus | null;
  const contentType = searchParams.get("contentType") as ContentType | null;
  const where = {
    ...(status ? { status } : {}),
    ...(contentType ? { contentType } : {}),
  };
  const rows = await prisma.contentGenJob.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    select: {
      id: true,
      contentType: true,
      status: true,
      anchorVilleSlug: true,
      anchorRegionSlug: true,
      targetSearchIntent: true,
      qualityScore: true,
      seoScore: true,
      costUsd: true,
      durationMs: true,
      createdAt: true,
      completedAt: true,
    },
  });
  const csv = rowsToCsv(
    [
      "id",
      "contentType",
      "status",
      "anchorVilleSlug",
      "anchorRegionSlug",
      "searchIntent",
      "qualityScore",
      "seoScore",
      "costUsd",
      "durationMs",
      "createdAt",
      "completedAt",
    ],
    rows.map((r) => [
      r.id,
      r.contentType,
      r.status,
      r.anchorVilleSlug,
      r.anchorRegionSlug,
      r.targetSearchIntent,
      r.qualityScore,
      r.seoScore,
      r.costUsd ? r.costUsd.toString() : "",
      r.durationMs,
      r.createdAt.toISOString(),
      r.completedAt?.toISOString() ?? "",
    ]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="content-gen-jobs-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

async function exportArticles(searchParams: URLSearchParams): Promise<Response> {
  const status = searchParams.get("status") as PublishStatus | null;
  const tier = searchParams.get("tier") as IndexationTier | null;
  const where = {
    generatedByJobId: { not: null },
    ...(status ? { status } : {}),
    ...(tier ? { indexationTier: tier } : {}),
  };
  const rows = await prisma.article.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    take: MAX_ROWS,
    include: {
      translations: {
        where: { locale: "fr" },
        take: 1,
        select: { title: true, slug: true },
      },
    },
  });
  const csv = rowsToCsv(
    [
      "id",
      "title",
      "slug",
      "status",
      "indexationTier",
      "isNews",
      "qualityScore",
      "seoScore",
      "publishedAt",
      "promotedAt",
    ],
    rows.map((a) => {
      const t = a.translations[0];
      return [
        a.id,
        t?.title ?? "",
        t?.slug ?? "",
        a.status,
        a.indexationTier,
        a.isNews,
        a.qualityScore,
        a.seoScore,
        a.publishedAt?.toISOString() ?? "",
        a.promotedAt?.toISOString() ?? "",
      ];
    }),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="content-gen-articles-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin();
  } catch {
    return new Response("unauthorized", { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "jobs";
  if (type === "jobs") return exportJobs(searchParams);
  if (type === "articles") return exportArticles(searchParams);
  return new Response("invalid type — accepted: jobs | articles", { status: 400 });
}
