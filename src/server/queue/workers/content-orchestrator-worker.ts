/**
 * Content Generator — Orchestrator worker (§ 25.3 master prompt v1.7).
 *
 * Pick CoverageCampaign WHERE status='running' AND generatedCount < totalTargetCount.
 * Pour chaque campagne :
 *  1. Sample distribution selon typeDistribution + audienceMix + searchIntentMix
 *  2. Crée N ContentGenJob rows (batch tick = min(dailyBatchSize, restant))
 *  3. Enqueue jobs vers queue 'content-gen' (worker primaire pick)
 *  4. Met à jour CoverageCampaign.generatedCount
 *
 * Cron toutes les 15 minutes (configurable). Pas de re-tick si campaign
 * passe en 'completed' (generatedCount >= totalTargetCount).
 *
 * Idempotency : ContentGenJob.idempotencyKey = hash(campaign.id + tickIndex)
 * pour éviter doublons si le worker tick re-trigger plus tôt que prévu.
 */

import { Queue, Worker, type Job } from "bullmq";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";
import type {
  CompanySize,
  ContentType,
  OrganisationType,
  SearchIntent,
} from "../../../../prisma/generated/client";

const QUEUE_NAME = "content-orchestrator";

interface BatchSettings {
  readonly dailyBatchSize: number;
  readonly workersConcurrency: number;
}

interface KillSwitchState {
  readonly active: boolean;
}

let contentGenQueue: Queue | null = null;
function getContentGenQueue(): Queue {
  if (contentGenQueue) return contentGenQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set");
  contentGenQueue = new Queue("content-gen", { connection: { url: redisUrl } });
  return contentGenQueue;
}

/**
 * Sample weighted distribution. Returns la clé choisie selon poids %.
 * Ex : { landing_ville: 50, blog_from_title: 30, comparison: 20 } → ~50% landing_ville.
 */
function sampleWeighted<K extends string>(dist: Record<K, number>): K | null {
  const entries = Object.entries(dist) as Array<[K, number]>;
  if (entries.length === 0) return null;
  const total = entries.reduce((a, [, w]) => a + w, 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1]![0];
}

function sampleAudienceMix(
  mix: Record<string, number>,
): { size: CompanySize; org: OrganisationType } | null {
  const key = sampleWeighted(mix);
  if (!key) return null;
  const [size, org] = key.split(":") as [string, string];
  if (!size || !org) return null;
  return { size: size as CompanySize, org: org as OrganisationType };
}

async function processJob(_job: Job<{ readonly trigger: string }>): Promise<void> {
  // Kill switch check
  const killSwitch = await readContentGenConfig<KillSwitchState>("kill_switch", { active: false });
  if (killSwitch.active) {
    console.log("[orchestrator] kill switch active, skip tick");
    return;
  }

  const batchSettings = await readContentGenConfig<BatchSettings>("batches", {
    dailyBatchSize: 20,
    workersConcurrency: 3,
  });

  const runningCampaigns = await prisma.coverageCampaign.findMany({
    where: { status: "running" },
    orderBy: { createdAt: "asc" },
  });

  if (runningCampaigns.length === 0) {
    console.log("[orchestrator] no running campaigns, skip tick");
    return;
  }

  // Repartition equitable du daily batch entre campagnes actives
  const perCampaignTick = Math.max(
    1,
    Math.floor(batchSettings.dailyBatchSize / runningCampaigns.length),
  );

  let totalEnqueued = 0;

  for (const campaign of runningCampaigns) {
    const remaining = campaign.totalTargetCount - campaign.generatedCount;
    if (remaining <= 0) {
      await prisma.coverageCampaign.update({
        where: { id: campaign.id },
        data: { status: "completed", completedAt: new Date() },
      });
      continue;
    }
    const toEnqueue = Math.min(perCampaignTick, remaining);

    const typeDist = campaign.typeDistribution as Record<ContentType, number>;
    const audienceMix = campaign.audienceMix as Record<string, number>;
    const intentMix = campaign.searchIntentMix as Record<SearchIntent, number> | null;

    // Anchors disponibles pour cette campagne
    const villeAnchors = campaign.anchorVilleSlugs;
    const deptAnchors = campaign.anchorDepartementCodes;
    const regionAnchors = campaign.anchorRegionSlugs;

    for (let i = 0; i < toEnqueue; i++) {
      const contentType = sampleWeighted(typeDist);
      if (!contentType) continue;
      const aud = sampleAudienceMix(audienceMix);
      const searchIntent = intentMix ? sampleWeighted(intentMix) : "informational";

      // Sample anchor (selon scope)
      let anchorVilleSlug: string | undefined;
      let anchorDepartementCode: string | undefined;
      let anchorRegionSlug: string | undefined;
      if (campaign.scope === "ville" && villeAnchors.length > 0) {
        anchorVilleSlug = villeAnchors[Math.floor(Math.random() * villeAnchors.length)];
      } else if (campaign.scope === "departement" && deptAnchors.length > 0) {
        anchorDepartementCode = deptAnchors[Math.floor(Math.random() * deptAnchors.length)];
      } else if (campaign.scope === "region" && regionAnchors.length > 0) {
        anchorRegionSlug = regionAnchors[Math.floor(Math.random() * regionAnchors.length)];
      } else if (campaign.scope === "multi") {
        if (villeAnchors.length > 0) {
          anchorVilleSlug = villeAnchors[Math.floor(Math.random() * villeAnchors.length)];
        } else if (regionAnchors.length > 0) {
          anchorRegionSlug = regionAnchors[Math.floor(Math.random() * regionAnchors.length)];
        }
      }

      // Idempotency key = hash(campaignId + slot index global + contentType)
      const slotIndex = campaign.generatedCount + i;
      const idempotencyKey = crypto
        .createHash("sha256")
        .update(
          `${campaign.id}::${slotIndex}::${contentType}::${anchorVilleSlug ?? anchorRegionSlug ?? "global"}`,
        )
        .digest("hex")
        .slice(0, 32);

      // Insert ContentGenJob row (status=queued)
      try {
        const job = await prisma.contentGenJob.create({
          data: {
            idempotencyKey,
            contentType: contentType as ContentType,
            status: "queued",
            priority: 5,
            campaignId: campaign.id,
            inputPayload: {
              campaignName: campaign.name,
              slotIndex,
            },
            targetLocale: "fr",
            ...(anchorVilleSlug ? { anchorVilleSlug } : {}),
            ...(anchorDepartementCode ? { anchorDepartementCode } : {}),
            ...(anchorRegionSlug ? { anchorRegionSlug } : {}),
            ...(aud ? { targetAudienceSize: aud.size, targetAudienceOrganisation: aud.org } : {}),
            targetSearchIntent: searchIntent as SearchIntent,
            primaryProvider: "openai",
            fallbackProvider: "anthropic",
          },
        });

        // Enqueue BullMQ
        await getContentGenQueue().add(
          "generate",
          {
            contentGenJobId: job.id,
            contentType: job.contentType,
            targetSearchIntent: job.targetSearchIntent,
            inputPayload: job.inputPayload,
          },
          { jobId: `gen-${job.id}` },
        );
        totalEnqueued++;
      } catch (err) {
        // P2002 unique constraint = idempotency hit → skip silently
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("Unique constraint")) {
          console.error("[orchestrator] insert ContentGenJob failed:", msg);
        }
      }
    }

    await prisma.coverageCampaign.update({
      where: { id: campaign.id },
      data: { generatedCount: { increment: toEnqueue } },
    });
  }

  console.log(
    `[orchestrator] tick OK — ${totalEnqueued} jobs enqueued across ${runningCampaigns.length} campaigns`,
  );
}

let workerInstance: Worker | null = null;

export function startOrchestratorWorker(): Worker {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — orchestrator-worker cannot start");
  workerInstance = new Worker(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-orchestrator-worker] job ${job?.id} failed:`, err);
  });
  return workerInstance;
}

export async function stopOrchestratorWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
  if (contentGenQueue) {
    await contentGenQueue.close();
    contentGenQueue = null;
  }
}
