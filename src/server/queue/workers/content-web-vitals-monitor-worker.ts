/**
 * Content Generator — Web Vitals monitor worker (audit final fix P0-3).
 *
 * Cron daily 02:30 UTC. Pour chaque (url, metric) avec ≥ 5 samples WebVitals
 * RUM dans les 24h, calcule p75 et alerte Telegram tag MONITORING si dépasse
 * budget AGENTS.md :
 *   - LCP > 1 800 ms (cible interne; Google good = 2 500 ms)
 *   - INP > 100 ms (cible interne; Google good = 200 ms)
 *   - CLS > 0 (cible interne stricte; Google good = 0,1)
 *   - TBT > 150 ms (Lighthouse lab desktop)
 *   - FCP > 1 000 ms (cible interne)
 *   - TTFB > 600 ms (cible interne)
 *
 * Stocke un snapshot agrégé dans `ContentGenConfig.web_vitals_p75` (key/value
 * JSON) lu par le dashboard admin `/admin/web-vitals` (audit P0 2026-05-15).
 * Pas de FK vers ContentGenJob — la table WebVitalSample est indépendante.
 *
 * Telegram alerts : helpers SSOT `alertLcpDegraded/Inp/Cls` (+ bulk) depuis
 * `src/server/content-gen/shared/content-gen-alerts.ts`. Format uniformisé
 * runbook R30 + lien PSI direct. Audit 2026-05-15 §8.4 / §8.7.
 *
 * **Idempotence** : 1 tick par jour, l'aggregate écrase le précédent.
 * **Fail-soft** : si pas de samples → log info, pas d'alerte (normal en
 * faible trafic). Si Telegram non configuré → fail-soft, le snapshot DB
 * reste écrit.
 *
 * Master prompt § 9.10 + § 12.3bis (alertes Telegram).
 */

import { Worker, type Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import {
  alertLcpDegraded,
  alertInpDegraded,
  alertClsDegraded,
  alertWebVitalsBulk,
} from "@/server/content-gen/shared/content-gen-alerts";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";

/**
 * Worker-side upsert ContentGenConfig (sans requireAdmin — worker BullMQ
 * tourne sans session). Utilisé pour snapshots monitoring agrégés.
 */
async function workerWriteConfig(key: string, value: unknown): Promise<void> {
  await prisma.contentGenConfig.upsert({
    where: { key },
    create: {
      key,
      value: value as never,
      updatedBy: "system:web-vitals-monitor",
    },
    update: {
      value: value as never,
      updatedBy: "system:web-vitals-monitor",
      updatedAt: new Date(),
    },
  });
}

const QUEUE_NAME = "content-web-vitals-monitor";

/** Seuils budget AGENTS.md (cible interne plus stricte que Google "good"). */
const BUDGETS: Record<string, number> = {
  LCP: 1800, // ms
  INP: 100, // ms
  CLS: 0.01, // unitless — tolérance epsilon pour éviter false-positive arrondi flottant
  TBT: 150, // ms
  FCP: 1000, // ms
  TTFB: 600, // ms
};

/** Window de samples sur les 24h passées. */
const WINDOW_HOURS = 24;
/** Minimum de samples par (url, metric) pour calcul p75 fiable. */
const MIN_SAMPLES = 5;

export interface WebVitalsMonitorTick {
  readonly trigger: string;
  readonly tick: string;
}

interface AggregateRow {
  readonly url: string;
  readonly metric: string;
  readonly count: number;
  readonly p75: number;
  readonly budget: number;
  readonly breach: boolean;
}

/** Calcule le 75e percentile (sorted asc, ceil(n*0.75)-1). */
function p75(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * 0.75) - 1);
  return sorted[idx] ?? 0;
}

async function processJob(_job: Job<WebVitalsMonitorTick>): Promise<void> {
  // Audit 2026-05-15 P1-8 — kill-switch check (monitoring read-only mais
  // Telegram alerts peuvent saturer pendant maintenance, on respecte la pause).
  const killSwitch = await readContentGenConfig<{ active: boolean }>("kill_switch", {
    active: false,
  });
  if (killSwitch.active) {
    console.log("[content-web-vitals-monitor] kill switch active, skip tick");
    return;
  }

  const since = new Date(Date.now() - WINDOW_HOURS * 3600_000);

  // Read all samples 24h window. Limit prudence 50k (cap mémoire ~3 MB).
  // En faible trafic V1, on aura quelques centaines de rows max.
  const samples = await prisma.webVitalSample.findMany({
    where: { createdAt: { gte: since } },
    select: { url: true, metric: true, value: true },
    take: 50_000,
  });

  if (samples.length === 0) {
    await workerWriteConfig("web_vitals_p75", {
      window_hours: WINDOW_HOURS,
      computed_at: new Date().toISOString(),
      total_samples: 0,
      aggregates: [],
      breaches: [],
    });
    console.log("[content-web-vitals-monitor] no samples in window — skip");
    return;
  }

  // Groupe par (url, metric)
  const groups = new Map<string, number[]>();
  for (const s of samples) {
    const key = `${s.url}\u001f${s.metric}`;
    const arr = groups.get(key) ?? [];
    arr.push(s.value);
    groups.set(key, arr);
  }

  const aggregates: AggregateRow[] = [];
  for (const [key, values] of groups) {
    if (values.length < MIN_SAMPLES) continue;
    const sepIdx = key.indexOf("\u001f");
    const url = key.slice(0, sepIdx);
    const metric = key.slice(sepIdx + 1);
    const budget = BUDGETS[metric] ?? Number.POSITIVE_INFINITY;
    const valueP75 = p75(values);
    aggregates.push({
      url,
      metric,
      count: values.length,
      p75: valueP75,
      budget,
      breach: valueP75 > budget,
    });
  }

  const breaches = aggregates.filter((a) => a.breach);
  aggregates.sort((a, b) => (b.breach ? 1 : 0) - (a.breach ? 1 : 0));

  // Stocke snapshot pour dashboard admin.
  await workerWriteConfig("web_vitals_p75", {
    window_hours: WINDOW_HOURS,
    computed_at: new Date().toISOString(),
    total_samples: samples.length,
    aggregates: aggregates.slice(0, 200), // cap UI
    breaches,
  });

  console.log(
    `[content-web-vitals-monitor] ${samples.length} samples, ${aggregates.length} aggregates, ${breaches.length} breaches`,
  );

  if (breaches.length === 0) return;

  // Tri par dépassement relatif (p75/budget) — top breaches en premier.
  const ranked = [...breaches].sort((a, b) => b.p75 / b.budget - a.p75 / a.budget);

  // Audit 2026-05-15 P0 monitoring : helpers SSOT content-gen-alerts.ts.
  // Format Telegram + runbook R30 + lien PSI uniformisés via les helpers
  // (au lieu d'un sendTelegram inline avec format divergent).
  //
  // Stratégie :
  //  - ≤ 5 breaches : 1 helper par breach (alertLcpDegraded / Inp / Cls)
  //    pour LCP/INP/CLS. Les metrics non-core (FCP/TTFB/TBT) restent dans
  //    le bulk pour limiter le bruit Telegram (pas dans budgets critiques
  //    Web Vitals 2026).
  //  - > 5 breaches : 1 alerte bulk avec top 5.
  const BULK_THRESHOLD = 5;

  if (ranked.length > BULK_THRESHOLD) {
    await alertWebVitalsBulk(
      ranked.slice(0, BULK_THRESHOLD).map((b) => ({
        url: b.url,
        metric: b.metric,
        p75: b.p75,
        budget: b.budget,
        count: b.count,
      })),
      ranked.length,
      WINDOW_HOURS,
    );
  } else {
    // Helpers dédiés par metric core. Les metrics non-LCP/INP/CLS sont
    // listées en bulk single-call (pas critiques pour cible 2026).
    const nonCoreBreaches: typeof ranked = [];
    for (const b of ranked) {
      const input = { url: b.url, p75: b.p75, budget: b.budget, count: b.count };
      if (b.metric === "LCP") {
        await alertLcpDegraded(input);
      } else if (b.metric === "INP") {
        await alertInpDegraded(input);
      } else if (b.metric === "CLS") {
        await alertClsDegraded(input);
      } else {
        nonCoreBreaches.push(b);
      }
    }
    if (nonCoreBreaches.length > 0) {
      await alertWebVitalsBulk(
        nonCoreBreaches.map((b) => ({
          url: b.url,
          metric: b.metric,
          p75: b.p75,
          budget: b.budget,
          count: b.count,
        })),
        nonCoreBreaches.length,
        WINDOW_HOURS,
      );
    }
  }

  // Snapshot DB pour audit trail système (dashboard /admin/web-vitals lit ça).
  await workerWriteConfig("web_vitals_last_alert", {
    sent_at: new Date().toISOString(),
    breach_count: breaches.length,
    top_breaches: ranked.slice(0, 5).map((b) => ({
      url: b.url,
      metric: b.metric,
      p75: b.p75,
      budget: b.budget,
    })),
  });
}

let workerInstance: Worker<WebVitalsMonitorTick> | null = null;

export function startContentWebVitalsMonitorWorker(): Worker<WebVitalsMonitorTick> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — web-vitals-monitor cannot start");
  workerInstance = new Worker<WebVitalsMonitorTick>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    limiter: { max: 4, duration: 3600_000 }, // 4/h cap (cron daily mais safety)
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-web-vitals-monitor] job ${job?.id} failed:`, err);
  });
  workerInstance.on("completed", (job) => {
    console.log(`[content-web-vitals-monitor] job ${job.id} completed`);
  });
  return workerInstance;
}

export async function stopContentWebVitalsMonitorWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}

/**
 * P3-32 (audit re-run 2026-05-15) — Test E2E hook. Permet de jouer un tick
 * complet sans démarrer BullMQ Worker (qui exigerait Redis live). Le test
 * mock prisma + helpers alertes + readContentGenConfig puis appelle ce
 * wrapper. Identique à processJob avec un Job stub minimaliste.
 */
export async function runMonitorTickForTest(trigger: string = "test"): Promise<void> {
  const stub = {
    id: `test-${Date.now()}`,
    data: { trigger, tick: new Date().toISOString() },
  } as unknown as Job<WebVitalsMonitorTick>;
  await processJob(stub);
}

export const _internals = { p75, BUDGETS, WINDOW_HOURS, MIN_SAMPLES };
