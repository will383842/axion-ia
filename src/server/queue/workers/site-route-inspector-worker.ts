// Worker BullMQ — inspection quotidienne des routes publiques (Sprint Site Explorer 2026-05-22).
//
// Cron daily 02:00 UTC.
// Pour chaque SiteRoute visible (visibility='public', status != 'draft') :
//   - HEAD request → update httpStatus
//   - Si 200 : GET request, parse HTML
//   - Extract title, description, H1, wordCount, jsonLdCount, liens, AiDisclaimer
//   - Update SiteRoute row
//
// Rate limit : 30 inspections/min (throttle 2s entre chaque).
// PII safe : aucune PII dans les logs (URL seule, pas de cookies).
// Stub-aware : skip si DATABASE_URL contient "stub.invalid".

import { Worker } from "bullmq";
import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { prisma } from "@/lib/prisma";
import type { SiteRouteInspectorJobData } from "../types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
const RATE_LIMIT_DELAY_MS = 2000; // 30/min = 2s entre inspections
const MAX_ROUTES_PER_RUN = 500; // sécurité : pas plus de 500 URLs par run

function isStubBuild(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") ?? false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Extraction métadonnées HTML ──────────────────────────────────────────────

function extractMetaTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() ?? null;
}

function extractMetaDescription(html: string): string | null {
  const match = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  return match?.[1]?.trim() ?? null;
}

function extractH1(html: string): string | null {
  const match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  return match?.[1]?.replace(/<[^>]+>/g, "").trim() ?? null;
}

function countWords(html: string): number {
  // Extrait le texte de <main> ou <article> si disponible, sinon <body>
  const mainMatch = html.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i);
  const content = mainMatch?.[1] ?? html;
  const text = content
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.split(" ").filter((w) => w.length > 0).length;
}

function countJsonLd(html: string): number {
  const matches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>/gi);
  return [...matches].length;
}

function countInternalLinks(html: string): number {
  const internalPattern = new RegExp(`href=["'](?:${SITE_URL}|/)[^"']*["']`, "gi");
  const matches = html.matchAll(internalPattern);
  return [...matches].length;
}

function countExternalLinks(html: string): number {
  const domain = new URL(SITE_URL).hostname;
  const externalPattern = new RegExp(`href=["']https?://(?!${domain})[^"']+["']`, "gi");
  const matches = html.matchAll(externalPattern);
  return [...matches].length;
}

function detectAiDisclaimer(html: string): boolean {
  return (
    html.includes("data-ai-disclaimer") ||
    html.includes("AiContentDisclaimer") ||
    html.includes("assisté par l'IA") ||
    html.includes("assistance de l'IA") ||
    html.includes("Claude Sonnet") ||
    html.includes("ai-disclaimer")
  );
}

// ─── Inspection d'une URL ──────────────────────────────────────────────────────

async function inspectRoute(siteRouteId: string, urlPath: string): Promise<void> {
  const fullUrl = `${SITE_URL}${urlPath}`;

  try {
    // HEAD request pour le status HTTP
    const headResponse = await fetch(fullUrl, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": "AxionIA-SiteExplorer/1.0 (+https://axion-ia.com/robots.txt)" },
      signal: AbortSignal.timeout(10_000),
    });

    const httpStatus = headResponse.status;

    if (httpStatus !== 200) {
      await prisma.siteRoute.update({
        where: { id: siteRouteId },
        data: {
          httpStatus,
          status:
            httpStatus === 404
              ? "not_found"
              : httpStatus >= 300 && httpStatus < 400
                ? "redirect"
                : "error",
          lastInspectedAt: new Date(),
        },
      });
      return;
    }

    // GET request pour le contenu HTML
    const getResponse = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "User-Agent": "AxionIA-SiteExplorer/1.0 (+https://axion-ia.com/robots.txt)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(15_000),
    });

    const html = await getResponse.text();

    const metaTitle = extractMetaTitle(html);
    const metaDescription = extractMetaDescription(html);
    const h1 = extractH1(html);
    const wordCount = countWords(html);
    const jsonLdCount = countJsonLd(html);
    const internalLinkCount = countInternalLinks(html);
    const externalLinkCount = countExternalLinks(html);
    const hasAiDisclaimer = detectAiDisclaimer(html);

    await prisma.siteRoute.update({
      where: { id: siteRouteId },
      data: {
        httpStatus: 200,
        status: "live",
        metaTitle,
        metaDescription,
        h1,
        wordCount,
        jsonLdCount,
        internalLinkCount,
        externalLinkCount,
        hasAiDisclaimer,
        lastInspectedAt: new Date(),
      },
    });
  } catch (e) {
    // Timeout ou réseau : marque comme erreur sans cracher le worker
    await prisma.siteRoute
      .update({
        where: { id: siteRouteId },
        data: {
          httpStatus: null,
          status: "error",
          lastInspectedAt: new Date(),
        },
      })
      .catch(() => void 0);
    console.warn(`[site-route-inspector] timeout/error for ${urlPath}:`, (e as Error).message);
  }
}

// ─── Worker BullMQ ────────────────────────────────────────────────────────────

export function startSiteRouteInspectorWorker() {
  const worker = new Worker<SiteRouteInspectorJobData>(
    "site-route-inspector",
    async (job) => {
      if (isStubBuild()) {
        console.log("[site-route-inspector] stub build detected, skipping.");
        return;
      }

      const { siteRouteId } = job.data;

      if (siteRouteId) {
        // Trigger manuel : inspecte uniquement cette route
        const route = await prisma.siteRoute.findUnique({
          where: { id: siteRouteId },
          select: { id: true, pathRendered: true, pathPattern: true, visibility: true },
        });
        if (!route || route.visibility !== "public") {
          console.warn(`[site-route-inspector] route ${siteRouteId} not found or not public`);
          return;
        }
        const urlPath = route.pathRendered ?? route.pathPattern;
        await inspectRoute(route.id, urlPath);
        console.log(`[site-route-inspector] inspected: ${urlPath}`);
        return;
      }

      // Run complet : inspecte toutes les routes publiques non-draft
      const routes = await prisma.siteRoute.findMany({
        where: {
          visibility: "public",
          status: { not: "draft" },
          // Priorité aux routes jamais inspectées ou inspectées il y a > 7j
          OR: [
            { lastInspectedAt: null },
            { lastInspectedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          ],
          // Inspecte seulement les routes résolues (pas les templates [param])
          type: { in: ["static", "dynamic_db", "dynamic_filesystem"] },
        },
        select: { id: true, pathRendered: true, pathPattern: true },
        take: MAX_ROUTES_PER_RUN,
        orderBy: { lastInspectedAt: "asc" },
      });

      console.log(`[site-route-inspector] inspecting ${routes.length} routes…`);
      let count = 0;

      for (const route of routes) {
        const urlPath = route.pathRendered ?? route.pathPattern;
        // Skip les templates non-résolus
        if (urlPath.includes("[") || urlPath.includes("]")) continue;

        await inspectRoute(route.id, urlPath);
        count++;

        // Rate limit : 30/min = 2s entre chaque
        await sleep(RATE_LIMIT_DELAY_MS);
      }

      console.log(`[site-route-inspector] done: ${count} routes inspected.`);
    },
    {
      connection: getBullConnectionOrThrow(),
      concurrency: 1,
      lockDuration: 600_000, // 10 min max (500 routes × 2s = ~17 min → on prend 500 max)
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  );

  worker.on("ready", () => console.log("[site-route-inspector-worker] ready"));
  worker.on("failed", (job, err) => {
    console.error(`[site-route-inspector-worker] failed: ${err.message}`);
    captureWorkerError("site-route-inspector", "site-route-inspector", job, err);
  });

  return worker;
}
