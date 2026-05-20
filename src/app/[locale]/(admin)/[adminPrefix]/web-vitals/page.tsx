// Console Web Vitals admin (audit RUM 2026-05-15 P0 §8.4 / §8.7 / §8.8).
//
// Centralise la vue RUM 24h pour piloter Web Vitals data-driven :
//  - Snapshot p75 par (route × metric) écrit par
//    `content-web-vitals-monitor-worker` toutes les nuits 02:30 UTC dans
//    `ContentGenConfig.web_vitals_p75`. Fallback : calcule à la volée depuis
//    `WebVitalSample` si pas de snapshot (ex. première install).
//  - Budget AGENTS.md (cible interne plus stricte que Google "good") :
//      LCP ≤ 1 800 ms / INP ≤ 100 ms / CLS = 0 (epsilon 0,01) / FCP ≤ 1 000 ms
//  - Bouton "Forcer un recompute" → enqueue le worker BullMQ (cron sinon nightly).
//  - Liens directs PageSpeed Insights par route (sondage labo on-demand).
//
// V1 minimal — pas de chart (reporté V2 si besoin). Pas de pagination
// (cap 200 rows). Tableaux monospace pour lisibilité ops.
//
// Doctrine admin :
//  - Auth via `auth()` cohérent autres pages admin.
//  - FR uniquement (CLAUDE.md §14 admin FR).
//  - ADMIN_URL_PREFIX env var (jamais hardcodé).
//  - force-dynamic justifié : SSR pure read DB temps réel, pas de cache.

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";
import { contentWebVitalsMonitorQueue } from "@/server/queue/queues";
import { WebVitalsV2 } from "./_v2/WebVitalsV2";

export const dynamic = "force-dynamic";

// ─── Constantes ─────────────────────────────────────────────────────────────

// Budgets SSOT — doit rester aligné avec
// `src/server/queue/workers/content-web-vitals-monitor-worker.ts BUDGETS`
// + AGENTS.md (cible interne stricte vs Google "good" plus laxiste).
const BUDGETS: Record<string, number> = {
  LCP: 1800,
  INP: 100,
  CLS: 0.01,
  TBT: 150,
  FCP: 1000,
  TTFB: 600,
};

const WINDOW_HOURS = 24;
const MIN_SAMPLES = 5;
const TABLE_CAP = 200;

// ─── Types ──────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

interface AggregateRow {
  url: string;
  metric: string;
  count: number;
  p75: number;
  budget: number;
  breach: boolean;
}

interface SnapshotShape {
  window_hours?: number;
  computed_at?: string;
  total_samples?: number;
  aggregates?: AggregateRow[];
  breaches?: AggregateRow[];
}

// ─── Server Action — Forcer recompute ───────────────────────────────────────

async function triggerRecomputeAction(): Promise<void> {
  "use server";
  const session = await auth();
  if (!session?.user) return;
  if (!contentWebVitalsMonitorQueue) return; // BULLMQ_DISABLED en dev
  await contentWebVitalsMonitorQueue.add(
    "tick",
    { trigger: "admin-recompute", tick: new Date().toISOString() },
    { jobId: `web-vitals-recompute-${Date.now()}` },
  );
}

// ─── Fallback compute (sans worker / snapshot vide) ─────────────────────────

/** p75 (sorted asc, ceil(n*0.75)-1) — mirror du worker. */
function p75(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * 0.75) - 1);
  return sorted[idx] ?? 0;
}

async function computeLive(): Promise<{
  aggregates: AggregateRow[];
  totalSamples: number;
  computedAt: string;
}> {
  const since = new Date(Date.now() - WINDOW_HOURS * 3600_000);
  const samples = await prisma.webVitalSample.findMany({
    where: { createdAt: { gte: since } },
    select: { url: true, metric: true, value: true },
    take: 50_000,
  });
  // Séparateur unit-separator U+001F — mirror du worker pour éviter
  // collision si une URL contenait le nom du metric en substring.
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
  aggregates.sort((a, b) => (b.breach ? 1 : 0) - (a.breach ? 1 : 0));
  return { aggregates, totalSamples: samples.length, computedAt: new Date().toISOString() };
}

// ─── UI helpers ─────────────────────────────────────────────────────────────

function fmtValue(metric: string, v: number): string {
  if (metric === "CLS") return v.toFixed(3);
  return `${Math.round(v)} ms`;
}

function classifyRating(metric: string, value: number): "good" | "needs_improvement" | "poor" {
  // Seuils Google CrUX (référence stricte — pas budget AGENTS.md interne).
  // Used uniquement pour le pill UI (statut indicatif user-side).
  const seuils: Record<string, { good: number; poor: number }> = {
    LCP: { good: 2500, poor: 4000 },
    INP: { good: 200, poor: 500 },
    CLS: { good: 0.1, poor: 0.25 },
    FCP: { good: 1800, poor: 3000 },
    TTFB: { good: 800, poor: 1800 },
    TBT: { good: 200, poor: 600 },
  };
  const t = seuils[metric];
  if (!t) return "good";
  if (value <= t.good) return "good";
  if (value <= t.poor) return "needs_improvement";
  return "poor";
}

function ratingPill(rating: "good" | "needs_improvement" | "poor") {
  const labels = {
    good: "● Good",
    needs_improvement: "● Needs improvement",
    poor: "● Poor",
  };
  const cls = {
    good: "admin-severity-info", // sage (info color = vert/neutre)
    needs_improvement: "admin-severity-warning",
    poor: "admin-severity-critical",
  };
  return <span className={`admin-status-pill ${cls[rating]}`}>{labels[rating]}</span>;
}

function budgetPill(breach: boolean) {
  return (
    <span
      className={`admin-status-pill ${breach ? "admin-severity-critical" : "admin-severity-info"}`}
    >
      {breach ? "● Hors budget" : "● Budget OK"}
    </span>
  );
}

function psiUrl(routePath: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const full = `${site}${routePath}`;
  return `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(full)}`;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function AdminWebVitalsPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/fr/${adminPrefix}/login`);
  }

  // 1. Lit le snapshot worker. Fallback live si vide / inexistant.
  const snapshot = await readContentGenConfig<SnapshotShape>("web_vitals_p75", {});
  let aggregates: AggregateRow[] = [];
  let totalSamples = 0;
  let computedAt = "";
  let isLive = false;
  if (snapshot.aggregates && snapshot.aggregates.length > 0) {
    aggregates = snapshot.aggregates;
    totalSamples = snapshot.total_samples ?? 0;
    computedAt = snapshot.computed_at ?? "";
  } else {
    const live = await computeLive();
    aggregates = live.aggregates;
    totalSamples = live.totalSamples;
    computedAt = live.computedAt;
    isLive = true;
  }

  // 2. Lit aussi le dernier état d'alerte pour audit trail.
  const lastAlert = await readContentGenConfig<{
    sent_at?: string;
    breach_count?: number;
  }>("web_vitals_last_alert", {});

  // 3. Top 20 par (route × metric) — priorité aux breaches, sinon p75 desc.
  aggregates.sort((a, b) => {
    if (a.breach !== b.breach) return a.breach ? -1 : 1;
    return b.p75 / b.budget - a.p75 / a.budget;
  });
  const display = aggregates.slice(0, TABLE_CAP);

  const breachCount = aggregates.filter((a) => a.breach).length;
  const routeCount = new Set(aggregates.map((a) => a.url)).size;

  return (
    <WebVitalsV2
      adminPrefix={adminPrefix}
      totalSamples={totalSamples}
      routeCount={routeCount}
      breachCount={breachCount}
      isLive={isLive}
      computedAt={computedAt}
      display={display}
      aggregatesLength={aggregates.length}
      lastAlertSentAt={lastAlert.sent_at}
      lastAlertBreachCount={lastAlert.breach_count}
      recomputeEnabled={Boolean(contentWebVitalsMonitorQueue)}
      triggerRecomputeAction={async () => {
        "use server";
        await triggerRecomputeAction();
      }}
    />
  );
}

