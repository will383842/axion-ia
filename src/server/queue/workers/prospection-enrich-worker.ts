/**
 * Worker — Enrichissement d'une entreprise (prospection T5).
 *
 * Mini-crawl 2 passes du site public (via `ssrfSafeFetch` + robots.txt), MX DNS,
 * responsables. `limiter` BullMQ = garde-fou DUR du débit de crawl (politesse).
 * RGPD : opt-out + non-diffusible exclus AVANT tout appel réseau. Anti-re-scrape
 * via `refreshAfter`. Stub-aware.
 */

import { Worker } from "bullmq";
import { resolveMx } from "node:dns/promises";
import { prisma } from "@/lib/prisma";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { ssrfSafeFetch } from "@/lib/ssrf-safe-fetch";
import {
  enrichCompany,
  type EnrichConfig,
  type EnrichDb,
  type EnrichPage,
} from "@/server/prospection/enrichment/enrich-service";
import { CONTACT_PAGE_PATHS, TEAM_PAGE_PATHS } from "@/lib/prospection/crawl-targets";
import { getProspectionConfig } from "@/server/prospection/config/site-settings";
import { isBuildStub } from "@/server/prospection/sources/stock-source";
import type { ProspectionEnrichJobData } from "@/server/prospection/queue/queues";
import type { Job } from "bullmq";

const QUEUE_NAME = "prospection-enrich";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6381";
let workerInstance: Worker<ProspectionEnrichJobData> | null = null;

const mxResolver = {
  async resolveMx(domain: string) {
    return resolveMx(domain);
  },
};

async function fetchPage(url: string): Promise<EnrichPage | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await ssrfSafeFetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const text = (await res.text()).slice(0, 2 * 1024 * 1024); // 2 MB max
    return { url, ok: res.ok, status: res.status, text };
  } catch {
    return null;
  }
}

async function processJob(job: Job<ProspectionEnrichJobData>) {
  if (isBuildStub()) return { skipped: "stub" as const };
  const company = await prisma.prospectionCompany.findUnique({ where: { id: job.data.companyId } });
  if (!company) return { skipped: "not-found" as const };

  // RGPD : opt-out + non-diffusible exclus AVANT tout appel réseau.
  if (company.optOut || company.statutDiffusion !== "diffusible") {
    return { skipped: "rgpd" as const };
  }
  // RGPD (D5) : opposition multi-clé SuppressionEntry (siren + domaine du site).
  const domaine = company.siteWeb
    ? company.siteWeb
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
    : null;
  const suppressed = await prisma.prospectionSuppressionEntry.findFirst({
    where: {
      OR: [
        { type: "siren", valueNormalized: company.siren },
        ...(domaine ? [{ type: "domaine" as const, valueNormalized: domaine }] : []),
      ],
    },
    select: { id: true },
  });
  if (suppressed) return { skipped: "suppression" as const };
  // Anti-re-scrape : fenêtre de fraîcheur.
  if (company.refreshAfter && company.refreshAfter > new Date()) {
    return { skipped: "fresh" as const };
  }

  const [crawlBudget, teamPass, freshness] = await Promise.all([
    getProspectionConfig("crawlBudget"),
    getProspectionConfig("teamPass"),
    getProspectionConfig("freshness"),
  ]);

  const enrichirPersonnes = teamPass.defaultEnabledSecteurs.includes(company.secteur ?? "");
  const config: EnrichConfig = {
    contactPaths: CONTACT_PAGE_PATHS,
    teamPaths: TEAM_PAGE_PATHS,
    maxPagesContact: crawlBudget.maxPagesContact,
    maxPagesPersonnes: teamPass.maxPagesPersonnes,
    maxPagesEntreprise: crawlBudget.maxPagesEntreprise,
    maxTeamAttempts: crawlBudget.maxTeamAttempts,
    enrichirPersonnes,
  };

  const result = await enrichCompany(
    {
      id: company.id,
      siren: company.siren,
      denomination: company.denomination,
      siteWeb: company.siteWeb,
      contentHash: company.contentHash,
    },
    config,
    {
      fetchPage,
      fetchRobots: (u) =>
        ssrfSafeFetch(u).then((r) => ({ ok: r.ok, status: r.status, text: () => r.text() })),
      mxResolver,
      db: prisma as unknown as EnrichDb,
    },
  );

  // Fenêtre de fraîcheur (D6) : succès → fenêtre pleine ; no_data / échec →
  // re-tentative courte (7 j) pour ne pas geler un site momentanément indisponible
  // ni un site ajouté plus tard.
  const days = result.status === "enriched" ? freshness.enrichmentRefreshDays : 7;
  const nextRefresh = new Date(Date.now() + days * 24 * 3600 * 1000);
  await prisma.prospectionCompany.update({
    where: { id: company.id },
    data: { refreshAfter: nextRefresh },
  });

  return result;
}

export function startProspectionEnrichWorker(): Worker<ProspectionEnrichJobData> {
  if (workerInstance) return workerInstance;
  workerInstance = new Worker<ProspectionEnrichJobData>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 3,
    // Garde-fou DUR : ≤ 10 crawls/s (politesse — pas de martèlement des sites).
    limiter: { max: 10, duration: 1000 },
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[${QUEUE_NAME}] job ${job?.id} failed:`, err);
    captureWorkerError("prospection-enrich", QUEUE_NAME, job, err);
  });
  return workerInstance;
}
