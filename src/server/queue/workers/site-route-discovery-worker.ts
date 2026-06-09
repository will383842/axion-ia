// Worker BullMQ — découverte « vivante » des URLs publiques (Onglet « Toutes les URLs » 2026-06-08).
//
// Cron daily 01:00 UTC (avant l'inspecteur HTTP de 02:00). Délègue toute la
// logique au runner partagé `runSiteRouteDiscovery()` (même code que le script
// CLI `scan-site-routes.ts`) :
//   1. énumère TOUTES les URLs publiques FR (énumérateur unifié)
//   2. calcule catégorie + indexabilité LIVE (drip villes, tiers articles…)
//   3. upsert sans toucher aux champs de revue manuelle
//   4. soft-tombstone des URLs disparues (jamais de hard-delete)
//
// Stub-aware : skip si DATABASE_URL contient "stub.invalid".

import { Worker } from "bullmq";
import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { runSiteRouteDiscovery } from "@/server/site-explorer/discovery-runner";
import type { SiteRouteDiscoveryJobData } from "../types";

function isStubBuild(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") ?? false;
}

export function startSiteRouteDiscoveryWorker() {
  const worker = new Worker<SiteRouteDiscoveryJobData>(
    "site-route-discovery",
    async () => {
      if (isStubBuild()) {
        console.log("[site-route-discovery] stub build detected, skipping.");
        return;
      }
      const res = await runSiteRouteDiscovery();
      console.log(
        `[site-route-discovery] done: ${res.enumerated} enumerated, ${res.upserted} upserted, ${res.tombstoned} tombstoned.`,
      );
    },
    {
      connection: getBullConnectionOrThrow(),
      concurrency: 1,
      lockDuration: 600_000,
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 200 },
    },
  );

  worker.on("ready", () => console.log("[site-route-discovery-worker] ready"));
  worker.on("failed", (job, err) => {
    console.error(`[site-route-discovery-worker] failed: ${err.message}`);
    captureWorkerError("site-route-discovery", "site-route-discovery", job, err);
  });

  return worker;
}
