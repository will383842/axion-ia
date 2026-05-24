/**
 * Web Vitals top 1% thresholds (Sprint v7 Phase 17).
 *
 * Seuils Web Vitals "top 1% mondial" stricter que les budgets actuels Axion-IA
 * (cf. AGENTS.md § Performance budget Web Vitals 2026). Activable graduellement
 * en Phase D (mois 13+) pour cibler le classement top 1% Google CrUX p75.
 *
 * Comparaison :
 *   ┌──────────┬─────────────┬──────────────┬─────────────────┐
 *   │ Métrique │ Axion-IA V1 │ Google good │ Top 1% strict   │
 *   ├──────────┼─────────────┼──────────────┼─────────────────┤
 *   │ LCP      │ ≤ 1800 ms   │ ≤ 2500 ms    │ ≤ 1200 ms       │
 *   │ INP      │ ≤ 100 ms    │ ≤ 200 ms     │ ≤ 50 ms         │
 *   │ CLS      │ = 0         │ ≤ 0.1        │ = 0             │
 *   │ TBT      │ ≤ 150 ms    │ ≤ 300 ms     │ ≤ 80 ms         │
 *   │ FCP      │ ≤ 1500 ms   │ ≤ 1800 ms    │ ≤ 900 ms        │
 *   │ TTFB     │ ≤ 600 ms    │ ≤ 800 ms     │ ≤ 200 ms (HTTP/3│
 *   │          │             │              │  + Cloudflare APO)│
 *   └──────────┴─────────────┴──────────────┴─────────────────┘
 *
 * Active via env `WEB_VITALS_TOP_1PCT_ENABLED=true`. Désactivé par défaut.
 * Quand actif : alertes RUM se déclenchent sur les seuils top1%, pas V1.
 */

export type WebVitalMetric = "LCP" | "INP" | "CLS" | "TBT" | "FCP" | "TTFB";

export interface WebVitalThresholds {
  readonly good: number;
  readonly needsImprovement: number;
  readonly poor: number;
}

/**
 * Seuils V1 actuels (source : AGENTS.md § Performance budget).
 */
export const THRESHOLDS_V1: Record<WebVitalMetric, WebVitalThresholds> = {
  LCP: { good: 1800, needsImprovement: 2500, poor: 4000 },
  INP: { good: 100, needsImprovement: 200, poor: 500 },
  CLS: { good: 0, needsImprovement: 0.1, poor: 0.25 },
  TBT: { good: 150, needsImprovement: 300, poor: 600 },
  FCP: { good: 1500, needsImprovement: 1800, poor: 3000 },
  TTFB: { good: 600, needsImprovement: 800, poor: 1800 },
};

/**
 * Seuils top 1% mondial (Sprint v7 Phase 17, activation Phase D).
 * Source : CrUX p99 dataset 2026 + benchmarks Vercel/Cloudflare top sites.
 */
export const THRESHOLDS_TOP_1PCT: Record<WebVitalMetric, WebVitalThresholds> = {
  LCP: { good: 1200, needsImprovement: 1800, poor: 2500 },
  INP: { good: 50, needsImprovement: 100, poor: 200 },
  CLS: { good: 0, needsImprovement: 0.05, poor: 0.1 },
  TBT: { good: 80, needsImprovement: 150, poor: 300 },
  FCP: { good: 900, needsImprovement: 1500, poor: 1800 },
  TTFB: { good: 200, needsImprovement: 400, poor: 800 },
};

/**
 * Retourne les seuils actifs selon le feature flag. Default = V1 (safe).
 */
export function getActiveWebVitalThresholds(): Record<WebVitalMetric, WebVitalThresholds> {
  return process.env.WEB_VITALS_TOP_1PCT_ENABLED === "true" ? THRESHOLDS_TOP_1PCT : THRESHOLDS_V1;
}

/**
 * Rate une métrique en fonction des seuils actifs.
 */
export function rateWebVitalMetric(
  metric: WebVitalMetric,
  value: number,
): "good" | "needs-improvement" | "poor" {
  const thresholds = getActiveWebVitalThresholds()[metric];
  if (value <= thresholds.good) return "good";
  if (value <= thresholds.needsImprovement) return "needs-improvement";
  return "poor";
}
