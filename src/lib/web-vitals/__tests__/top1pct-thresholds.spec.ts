/**
 * Sprint v7 Phase 17 — Tests Web Vitals top 1% thresholds switch.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  THRESHOLDS_V1,
  THRESHOLDS_TOP_1PCT,
  getActiveWebVitalThresholds,
  rateWebVitalMetric,
} from "../top1pct-thresholds";

describe("Phase 17 — Web Vitals thresholds switch", () => {
  let original: string | undefined;
  beforeEach(() => {
    original = process.env.WEB_VITALS_TOP_1PCT_ENABLED;
  });
  afterEach(() => {
    if (original !== undefined) process.env.WEB_VITALS_TOP_1PCT_ENABLED = original;
    else delete process.env.WEB_VITALS_TOP_1PCT_ENABLED;
  });

  it("WV1: défaut désactivé → THRESHOLDS_V1 actifs", () => {
    delete process.env.WEB_VITALS_TOP_1PCT_ENABLED;
    const active = getActiveWebVitalThresholds();
    expect(active.LCP.good).toBe(THRESHOLDS_V1.LCP.good);
    expect(active.LCP.good).toBe(1800);
  });

  it("WV2: WEB_VITALS_TOP_1PCT_ENABLED=true → THRESHOLDS_TOP_1PCT actifs", () => {
    process.env.WEB_VITALS_TOP_1PCT_ENABLED = "true";
    const active = getActiveWebVitalThresholds();
    expect(active.LCP.good).toBe(THRESHOLDS_TOP_1PCT.LCP.good);
    expect(active.LCP.good).toBe(1200);
  });

  it("WV3: top 1% seuils tous strict inférieurs ou égaux à V1", () => {
    for (const metric of ["LCP", "INP", "CLS", "TBT", "FCP", "TTFB"] as const) {
      expect(THRESHOLDS_TOP_1PCT[metric].good).toBeLessThanOrEqual(THRESHOLDS_V1[metric].good);
    }
  });

  it("WV4: rateWebVitalMetric retourne 'good' si valeur ≤ threshold.good (V1 default)", () => {
    delete process.env.WEB_VITALS_TOP_1PCT_ENABLED;
    expect(rateWebVitalMetric("LCP", 1500)).toBe("good");
    expect(rateWebVitalMetric("LCP", 2000)).toBe("needs-improvement");
    expect(rateWebVitalMetric("LCP", 5000)).toBe("poor");
  });

  it("WV5: rateWebVitalMetric stricter top1% — 1500ms LCP devient 'needs-improvement'", () => {
    process.env.WEB_VITALS_TOP_1PCT_ENABLED = "true";
    expect(rateWebVitalMetric("LCP", 1500)).toBe("needs-improvement"); // V1: good
    expect(rateWebVitalMetric("LCP", 1100)).toBe("good"); // ≤ 1200
  });

  it("WV6: CLS = 0 reste 'good' dans les 2 modes (cible interne stricte préservée)", () => {
    delete process.env.WEB_VITALS_TOP_1PCT_ENABLED;
    expect(rateWebVitalMetric("CLS", 0)).toBe("good");
    process.env.WEB_VITALS_TOP_1PCT_ENABLED = "true";
    expect(rateWebVitalMetric("CLS", 0)).toBe("good");
  });
});
