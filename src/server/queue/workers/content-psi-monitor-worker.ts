/**
 * P2-29 (audit re-run 2026-05-15 AGENT 8) — Content PSI monitor worker.
 *
 * Cron weekly Monday 03:00 UTC. Query PageSpeed Insights API sur 15 URLs
 * stratégiques en mobile strategy, parse les lab metrics (Lighthouse) +
 * field data (CrUX inclus si trafic suffisant), compare avec p75 RUM
 * maison (WebVitalSample 24h fenêtre). Alerte Telegram si Δ p75 PSI
 * vs RUM > 50 % (signe d'un divergence lab vs terrain → diagnostic).
 *
 * Doctrine vs `content-web-vitals-monitor-worker` :
 *   - web-vitals-monitor = daily 02:30 UTC, p75 RUM maison, alertes budget.
 *   - psi-monitor = weekly 03:00 UTC, PSI lab + field CrUX, alertes Δ vs RUM.
 *
 * Stockage des samples : persiste dans WebVitalSample avec
 * `navigationType="psi-lab"` (cohérent avec mémoire `axionia_audit_web_vitals_*`).
 * Permet au dashboard `/admin/web-vitals` d'afficher les courbes lab vs
 * field dans une seule table sans ajouter un nouveau model Prisma.
 *
 * Fail-soft : si `GOOGLE_PSI_API_KEY` absent → skip silencieusement (V1
 * accepte de tourner sans clé en attendant que Will la crée GCP Console).
 *
 * Quota : 25 000 requêtes/jour avec clé (gratuit). 15 URLs × 1 cron/sem
 * × 2 strategies = 30 req/sem → 0.12 % du quota. Largement OK.
 *
 * Source de vérité 15 URLs stratégiques : top business pages + 3 pSEO
 * pilotes (Paris/Lyon/Marseille). Doit rester ≤ 20 pour rester sous le
 * timeout 60s/job BullMQ × delay PSI ~5-10s.
 */

import { Worker, type Job } from "bullmq";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { prisma } from "@/lib/prisma";
import { alertWebVitalsBulk } from "@/server/content-gen/shared/content-gen-alerts";
import { readKillSwitchFailSafe } from "@/server/content-gen/config-store";

const QUEUE_NAME = "content-psi-monitor";

/**
 * Fix 2026-08-15 (audit e2e, F5) — durée de lock BullMQ alignée sur le PIRE CAS
 * réaliste du job, calculé depuis les timeouts de CE fichier :
 *
 *   15 URLs × (fetch PSI timeout 90 s + throttle 2 s) = 1 380 s ≈ 23 min,
 *   + persistance DB / chargement RUM (marge) → 30 min.
 *
 * L'ancien `lockDuration: 120_000` (2 min) était PLUS COURT que la durée
 * typique du job (déjà > 2 min avec quelques fetches lents). BullMQ renouvelle
 * certes les locks des jobs actifs (toutes les lockDuration/2), mais avec un
 * lock de 2 min il suffit d'une fenêtre de 60 s sans renouvellement (event
 * loop chargé, hoquet Redis) pour que le job soit marqué *stalled* et rejoué
 * EN PARALLÈLE : doubles mesures, doubles alertes, quota Google consommé 2×.
 * Un lock couvrant le pire cas rend le stall impossible même si tous les
 * renouvellements échouent pendant le run — solution la plus simple et la plus
 * sûre (pas de plomberie `job.extendLock` manuelle à entretenir).
 */
const PSI_JOB_LOCK_DURATION_MS = 30 * 60_000;

/** 15 URLs stratégiques mesurées chaque lundi (top business + 3 pSEO pilotes). */
const TARGET_URLS: ReadonlyArray<string> = [
  "https://axion-ia.com/fr",
  "https://axion-ia.com/fr/audit",
  "https://axion-ia.com/fr/interventions",
  "https://axion-ia.com/fr/implementation",
  "https://axion-ia.com/fr/methodologie",
  "https://axion-ia.com/fr/cas-concrets",
  "https://axion-ia.com/fr/tarifs",
  "https://axion-ia.com/fr/appel",
  "https://axion-ia.com/fr/contact",
  "https://axion-ia.com/fr/blog",
  "https://axion-ia.com/fr/faq",
  "https://axion-ia.com/fr/centre-aide",
  "https://axion-ia.com/fr/implantations/ile-de-france/paris",
  "https://axion-ia.com/fr/implantations/auvergne-rhone-alpes/lyon",
  "https://axion-ia.com/fr/implantations/provence-alpes-cote-d-azur/marseille",
];

/** Seuil d'alerte Δ p75 PSI vs RUM (en %). */
const DIVERGENCE_THRESHOLD_PCT = 50;

interface PsiAudit {
  numericValue: number | undefined;
}

interface PsiResponse {
  lighthouseResult?: {
    audits?: {
      "largest-contentful-paint"?: PsiAudit;
      "cumulative-layout-shift"?: PsiAudit;
      "first-contentful-paint"?: PsiAudit;
      "total-blocking-time"?: PsiAudit;
      "server-response-time"?: PsiAudit;
    };
  };
  loadingExperience?: {
    metrics?: Record<string, { percentile?: number }>;
  };
}

interface PsiSample {
  readonly url: string;
  readonly metric: "LCP" | "INP" | "CLS" | "FCP" | "TTFB" | "TBT";
  readonly labValue: number;
  /** Field data CrUX (p75 28j) si disponible — sinon null. */
  readonly fieldValue: number | null;
}

/**
 * Query PSI API pour une URL en mobile strategy. Throttle 1 req/sec par
 * IP côté Google (donc OK pour 15 URLs séquentielles avec await between).
 */
async function fetchPsi(url: string, apiKey: string): Promise<PsiResponse | null> {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", "MOBILE");
  endpoint.searchParams.set("category", "PERFORMANCE");
  endpoint.searchParams.set("key", apiKey);
  // PSI peut bloquer 30-60s en froid. Timeout 90s.
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(endpoint.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[content-psi-monitor] ${url} HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as PsiResponse;
  } catch (err) {
    console.warn(`[content-psi-monitor] ${url} fetch error:`, err);
    return null;
  } finally {
    clearTimeout(tid);
  }
}

/** Extrait lab + field metrics depuis la réponse PSI. */
function parsePsi(url: string, psi: PsiResponse): PsiSample[] {
  const audits = psi.lighthouseResult?.audits ?? {};
  const fields = psi.loadingExperience?.metrics ?? {};
  const samples: PsiSample[] = [];

  const labLcp = audits["largest-contentful-paint"]?.numericValue;
  if (typeof labLcp === "number") {
    samples.push({
      url,
      metric: "LCP",
      labValue: labLcp,
      fieldValue: fields["LARGEST_CONTENTFUL_PAINT_MS"]?.percentile ?? null,
    });
  }
  const labCls = audits["cumulative-layout-shift"]?.numericValue;
  if (typeof labCls === "number") {
    samples.push({
      url,
      metric: "CLS",
      labValue: labCls,
      // CrUX CLS percentile = ×100 (entiers) — on garde tel quel V1
      fieldValue: fields["CUMULATIVE_LAYOUT_SHIFT_SCORE"]?.percentile ?? null,
    });
  }
  const labFcp = audits["first-contentful-paint"]?.numericValue;
  if (typeof labFcp === "number") {
    samples.push({
      url,
      metric: "FCP",
      labValue: labFcp,
      fieldValue: fields["FIRST_CONTENTFUL_PAINT_MS"]?.percentile ?? null,
    });
  }
  const labTbt = audits["total-blocking-time"]?.numericValue;
  if (typeof labTbt === "number") {
    samples.push({ url, metric: "TBT", labValue: labTbt, fieldValue: null });
  }
  const labTtfb = audits["server-response-time"]?.numericValue;
  if (typeof labTtfb === "number") {
    samples.push({
      url,
      metric: "TTFB",
      labValue: labTtfb,
      fieldValue: fields["EXPERIMENTAL_TIME_TO_FIRST_BYTE"]?.percentile ?? null,
    });
  }
  // INP field data uniquement (pas de lab Lighthouse).
  const fieldInp = fields["INTERACTION_TO_NEXT_PAINT"]?.percentile;
  if (typeof fieldInp === "number") {
    samples.push({ url, metric: "INP", labValue: 0, fieldValue: fieldInp });
  }

  return samples;
}

/** Calcule le 75e percentile (sorted asc). */
function p75(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * 0.75) - 1);
  return sorted[idx] ?? 0;
}

/** Charge RUM p75 par (url, metric) sur fenêtre 7j (vs PSI weekly). */
async function loadRumP75ByUrlMetric(): Promise<Map<string, number>> {
  const since = new Date(Date.now() - 7 * 24 * 3600_000);
  const samples = await prisma.webVitalSample.findMany({
    where: { createdAt: { gte: since }, navigationType: { not: "psi-lab" } },
    select: { url: true, metric: true, value: true },
    take: 100_000,
  });
  const groups = new Map<string, number[]>();
  for (const s of samples) {
    const key = `${s.url}${s.metric}`;
    const arr = groups.get(key) ?? [];
    arr.push(s.value);
    groups.set(key, arr);
  }
  const out = new Map<string, number>();
  for (const [key, values] of groups) {
    if (values.length < 5) continue; // MIN_SAMPLES cohérent web-vitals-monitor
    out.set(key, p75(values));
  }
  return out;
}

async function processJob(_job: Job): Promise<void> {
  const apiKey = process.env.GOOGLE_PSI_API_KEY;
  if (!apiKey) {
    console.warn("[content-psi-monitor] GOOGLE_PSI_API_KEY absent — skip tick");
    return;
  }

  // Fix 2026-08-15 (audit e2e, F8) — ce worker consomme un quota externe
  // (30 requêtes PSI Google/semaine) sans jamais consulter le kill switch
  // global content-gen. En situation d'arrêt d'urgence, on ne dépense AUCUN
  // quota externe : skip propre (pas d'échec bruyant), la mesure reprend au
  // tick hebdomadaire suivant. Lecture fail-safe : DB illisible = arrêt.
  const killSwitch = await readKillSwitchFailSafe();
  if (killSwitch.active) {
    console.warn(
      `[content-psi-monitor] kill switch actif (${killSwitch.reason ?? "sans raison"}) — skip tick`,
    );
    return;
  }

  const psiSamples: PsiSample[] = [];
  for (const url of TARGET_URLS) {
    const psi = await fetchPsi(url, apiKey);
    if (!psi) continue;
    psiSamples.push(...parsePsi(url, psi));
    // Throttle 2s entre URLs pour rester très en dessous du quota PSI.
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`[content-psi-monitor] collected ${psiSamples.length} PSI samples`);

  // Persiste dans WebVitalSample (navigationType=psi-lab) pour le dashboard.
  // Stocke lab value seulement (field viendrait de CrUX externe).
  for (const s of psiSamples) {
    if (s.metric === "INP") continue; // INP pas lab — skip pour éviter sample 0
    try {
      // URL canonique = pathname seul
      const path = new URL(s.url).pathname;
      await prisma.webVitalSample.create({
        data: {
          url: path,
          metric: s.metric,
          value: s.labValue,
          rating:
            s.metric === "CLS"
              ? s.labValue > 0.1
                ? "poor"
                : s.labValue > 0.05
                  ? "needs_improvement"
                  : "good"
              : s.labValue > (s.metric === "LCP" ? 2500 : 200)
                ? "poor"
                : "needs_improvement",
          navigationType: "psi-lab",
        },
      });
    } catch (err) {
      console.warn(`[content-psi-monitor] persist ${s.url}/${s.metric} failed:`, err);
    }
  }

  // Compare avec RUM p75. Divergence > 50 % → alerte.
  const rumP75 = await loadRumP75ByUrlMetric();
  const divergences: Array<{
    url: string;
    metric: string;
    p75: number;
    budget: number;
    count: number;
  }> = [];

  for (const s of psiSamples) {
    if (s.labValue === 0) continue; // INP / metrics manquantes
    const path = new URL(s.url).pathname;
    const key = `${path}${s.metric}`;
    const rum = rumP75.get(key);
    if (rum === undefined || rum === 0) continue; // pas de RUM = skip
    const diffPct = Math.abs((s.labValue - rum) / rum) * 100;
    if (diffPct > DIVERGENCE_THRESHOLD_PCT) {
      divergences.push({
        url: path,
        metric: s.metric,
        p75: s.labValue,
        budget: rum, // détourné pour porter la valeur RUM dans le message
        count: 1,
      });
    }
  }

  if (divergences.length > 0) {
    console.log(`[content-psi-monitor] ${divergences.length} divergences PSI vs RUM`);
    await alertWebVitalsBulk(
      divergences.slice(0, 5).map((d) => ({
        url: d.url,
        metric: `${d.metric}-PSI-DIVERGE`,
        p75: d.p75,
        budget: d.budget,
        count: d.count,
      })),
      divergences.length,
      168, // 7 jours en heures
    );
  }
}

let workerInstance: Worker | null = null;

export function startContentPsiMonitorWorker(): Worker {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — psi-monitor cannot start");
  workerInstance = new Worker(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    // Fix 2026-08-15 (F5) : 2 min < durée typique du job (pire cas ~23 min) —
    // cf. calcul détaillé sur PSI_JOB_LOCK_DURATION_MS en tête de fichier.
    lockDuration: PSI_JOB_LOCK_DURATION_MS,
    limiter: { max: 2, duration: 24 * 3600_000 }, // 2/jour max (cron weekly mais safety)
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-psi-monitor] job ${job?.id} failed:`, err);
    captureWorkerError("psi-monitor", QUEUE_NAME, job, err);
  });
  workerInstance.on("completed", (job) => {
    console.log(`[content-psi-monitor] job ${job.id} completed`);
  });
  return workerInstance;
}

export async function stopContentPsiMonitorWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}

/**
 * P2-29 — Test E2E hook. Permet de jouer un tick complet sans Worker BullMQ.
 * Le test mock prisma + fetch + alertWebVitalsBulk puis appelle ce wrapper.
 */
export async function runPsiTickForTest(): Promise<void> {
  await processJob({ id: "test", data: {} } as unknown as Job);
}

export const _internals = { TARGET_URLS, DIVERGENCE_THRESHOLD_PCT, p75, parsePsi };
