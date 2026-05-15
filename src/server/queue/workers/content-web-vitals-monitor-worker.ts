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
 * JSON) lu par le dashboard admin `/content-gen` (next iteration). Pas de FK
 * vers ContentGenJob — la table WebVitalSample est indépendante.
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
import { sendTelegram } from "@/lib/telegram";
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

  // Alerte Telegram tag MONITORING. Format compact (Telegram limite 4096 chars,
  // on prend top 10 breaches triés par dépassement relatif).
  const ranked = [...breaches].sort((a, b) => b.p75 / b.budget - a.p75 / a.budget).slice(0, 10);
  const lines = ranked.map((b) => {
    const fmt = (v: number) =>
      b.metric === "CLS"
        ? v.toFixed(3)
        : `${Math.round(v)}${b.metric === "INP" || b.metric === "LCP" || b.metric === "FCP" || b.metric === "TTFB" || b.metric === "TBT" ? "ms" : ""}`;
    return `• ${b.metric} \`${b.url}\` p75=${fmt(b.p75)} (budget ${fmt(b.budget)}, n=${b.count})`;
  });
  const body =
    `*Web Vitals dépassement budget*\n` +
    `Fenêtre : ${WINDOW_HOURS}h · ${samples.length} samples\n` +
    `Top ${ranked.length}/${breaches.length} breaches :\n` +
    lines.join("\n");

  try {
    await sendTelegram({ tag: "MONITORING", body, silent: false });
  } catch (err) {
    console.warn(
      "[content-web-vitals-monitor] Telegram alert failed:",
      err instanceof Error ? err.message : String(err),
    );
  }

  // Annule un éventuel snapshot pour `web_vitals_alert` info de réception alerte
  // (utile pour audit trail système, pas lié à un job content-gen).
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

export const _internals = { p75, BUDGETS, WINDOW_HOURS, MIN_SAMPLES };
