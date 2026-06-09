// Worker BullMQ — trafic Google Search Console par URL (Onglet « Toutes les URLs » 2026-06-08).
//
// Cron daily 04:00 UTC. Pour un échantillon d'URLs indexables (rotation par
// `gscDataAt` le plus ancien), tire clics / impressions / position via le client
// GSC existant (`gscTopKeywordsForUrl`) et agrège au niveau URL :
//   - clicks/impressions = somme sur les requêtes top
//   - position = moyenne pondérée par impressions
//   - ctr = clicks / impressions
//
// Quota GSC = 2 000 req/jour : on plafonne `MAX_PER_RUN` et on priorise les URLs
// jamais (ou anciennement) rafraîchies. Skip silencieux si credentials absents
// (graceful degrade V1). Stub-aware.

import { Worker } from "bullmq";
import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { prisma } from "@/lib/prisma";
import { gscTopKeywordsForUrl } from "@/server/content-gen/seo/gsc-client";
import type { SiteRouteGscJobData } from "../types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
const MAX_PER_RUN = 400; // < quota 2000/j, laisse de la marge aux autres consommateurs GSC
const THROTTLE_MS = 200;

function isStubBuild(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") ?? false;
}

function hasGscCredentials(): boolean {
  return Boolean(
    process.env["GSC_PROPERTY_URL"] &&
    process.env["GSC_OAUTH_CLIENT_ID"] &&
    process.env["GSC_OAUTH_CLIENT_SECRET"] &&
    process.env["GSC_OAUTH_REFRESH_TOKEN"],
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function startSiteRouteGscWorker() {
  const worker = new Worker<SiteRouteGscJobData>(
    "site-route-gsc",
    async (job) => {
      if (isStubBuild()) {
        console.log("[site-route-gsc] stub build detected, skipping.");
        return;
      }
      if (!hasGscCredentials()) {
        console.log("[site-route-gsc] no GSC credentials, skipping (graceful degrade).");
        return;
      }

      // Échantillon : URLs publiques indexables, résolues, les plus anciennes d'abord.
      const routes = await prisma.siteRoute.findMany({
        where: {
          visibility: "public",
          removedAt: null,
          isIndexable: true,
          pathRendered: { not: null },
        },
        select: { id: true, pathRendered: true },
        orderBy: [{ gscDataAt: { sort: "asc", nulls: "first" } }, { updatedAt: "asc" }],
        take: MAX_PER_RUN,
      });

      let updated = 0;
      const now = new Date();
      for (const route of routes) {
        const path = route.pathRendered;
        if (!path || path.includes("[")) continue;
        const targetUrl = `${SITE_URL}${path}`;

        const rows = await gscTopKeywordsForUrl(targetUrl, 28, 25);
        if (rows === null) {
          // null = credentials/API KO → inutile de marteler le reste du run.
          console.warn("[site-route-gsc] GSC returned null, aborting run early.");
          break;
        }

        const clicks = rows.reduce((s, r) => s + r.clicks, 0);
        const impressions = rows.reduce((s, r) => s + r.impressions, 0);
        const weightedPos =
          impressions > 0
            ? rows.reduce((s, r) => s + r.position * r.impressions, 0) / impressions
            : null;
        const ctr = impressions > 0 ? clicks / impressions : 0;

        await prisma.siteRoute
          .update({
            where: { id: route.id },
            data: {
              gscClicks: clicks,
              gscImpressions: impressions,
              gscCtr: ctr,
              gscPosition: weightedPos,
              gscDataAt: now,
            },
          })
          .catch(() => void 0);
        updated++;

        await sleep(THROTTLE_MS);
      }

      console.log(`[site-route-gsc] done: ${updated} URLs refreshed.`);
      void job;
    },
    {
      connection: getBullConnectionOrThrow(),
      concurrency: 1,
      lockDuration: 600_000,
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 200 },
    },
  );

  worker.on("ready", () => console.log("[site-route-gsc-worker] ready"));
  worker.on("failed", (job, err) => {
    console.error(`[site-route-gsc-worker] failed: ${err.message}`);
    captureWorkerError("site-route-gsc", "site-route-gsc", job, err);
  });

  return worker;
}
