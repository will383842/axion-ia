/**
 * Sub-agent D Sprint S+5 P2-10 (2026-05-20) — Tests Vitest content-psi-monitor-worker.
 *
 * Worker BullMQ cron weekly (lundi 03:00 UTC). Query PageSpeed Insights API
 * sur 15 URLs stratégiques mobile, persist samples (navigationType=psi-lab),
 * compare avec p75 RUM 7j, alert si Δ > 50%.
 *
 * Le worker expose déjà `runPsiTickForTest` + `_internals` (PSI_TICK + parsePsi).
 * On l'utilise directement (pas besoin de mocker bullmq.Worker).
 *
 * Couvre :
 *  1. happy path : 15 URLs scannées, samples persistés, divergences = 0
 *  2. failure path : GOOGLE_PSI_API_KEY absent → skip silencieux + 0 fetch
 *  3. edge case : Core Web Vitals seuil dépassé (LCP > 2500ms vs RUM 1500ms)
 *     → alertWebVitalsBulk déclenchée avec top 5
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const { webVitalCreateMock, webVitalFindManyMock, alertBulkMock } = vi.hoisted(() => ({
  webVitalCreateMock: vi.fn().mockResolvedValue({}),
  webVitalFindManyMock: vi.fn().mockResolvedValue([]),
  alertBulkMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    webVitalSample: {
      create: webVitalCreateMock,
      findMany: webVitalFindManyMock,
    },
  },
}));

vi.mock("@/server/content-gen/shared/content-gen-alerts", () => ({
  alertWebVitalsBulk: alertBulkMock,
}));

import { runPsiTickForTest, _internals } from "../content-psi-monitor-worker";

const ORIG_PSI_KEY = process.env.GOOGLE_PSI_API_KEY;

// Helper : construit une réponse PSI minimale
function makePsiResponse(opts: {
  lcp?: number;
  cls?: number;
  tbt?: number;
  fieldLcp?: number;
  fieldInp?: number;
}) {
  return {
    lighthouseResult: {
      audits: {
        "largest-contentful-paint": opts.lcp !== undefined ? { numericValue: opts.lcp } : undefined,
        "cumulative-layout-shift": opts.cls !== undefined ? { numericValue: opts.cls } : undefined,
        "total-blocking-time": opts.tbt !== undefined ? { numericValue: opts.tbt } : undefined,
      },
    },
    loadingExperience: {
      metrics: {
        ...(opts.fieldLcp !== undefined && {
          LARGEST_CONTENTFUL_PAINT_MS: { percentile: opts.fieldLcp },
        }),
        ...(opts.fieldInp !== undefined && {
          INTERACTION_TO_NEXT_PAINT: { percentile: opts.fieldInp },
        }),
      },
    },
  };
}

describe("content-psi-monitor-worker — Sub-agent D Sprint S+5 P2-10", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    webVitalCreateMock.mockResolvedValue({});
    webVitalFindManyMock.mockResolvedValue([]);
    alertBulkMock.mockResolvedValue(undefined);
    // Bypass throttle 2s entre URLs : stub setTimeout pour qu'il résolve
    // immédiatement (worker throttle 15 × 2s = 30s sinon, hors budget tests).
    // AbortController.setTimeout du fetch est aussi affecté mais OK car on
    // mock fetch en amont (pas de réseau réel).
    const originalSetTimeout = global.setTimeout;
    vi.stubGlobal("setTimeout", ((fn: () => void) => {
      // Détecte le polyfill Node : si appelé avec un cb seul, exécute tout de suite
      if (typeof fn === "function") {
        queueMicrotask(fn);
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }
      return originalSetTimeout(fn as never, 0);
    }) as typeof setTimeout);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (ORIG_PSI_KEY === undefined) {
      delete process.env.GOOGLE_PSI_API_KEY;
    } else {
      process.env.GOOGLE_PSI_API_KEY = ORIG_PSI_KEY;
    }
  });

  it("failure path : GOOGLE_PSI_API_KEY absent → skip silencieux + 0 fetch + 0 sample", async () => {
    delete process.env.GOOGLE_PSI_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await runPsiTickForTest();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(webVitalCreateMock).not.toHaveBeenCalled();
    expect(alertBulkMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("GOOGLE_PSI_API_KEY absent"));
    warnSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("happy path : 15 URLs scannées + samples persistés (LCP < seuil RUM) → 0 alerte", async () => {
    process.env.GOOGLE_PSI_API_KEY = "test-psi-key";

    // Réponse PSI standard : LCP 1500ms (< budget 1800), CLS 0.02 (good)
    const psiResp = makePsiResponse({ lcp: 1500, cls: 0.02, tbt: 100 });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => psiResp,
    });
    vi.stubGlobal("fetch", fetchMock);

    // RUM p75 = 1400 → diff = (1500-1400)/1400 = 7% < 50% → pas de divergence
    webVitalFindManyMock.mockResolvedValue(
      Array.from({ length: 10 }, () => ({
        url: "/fr",
        metric: "LCP",
        value: 1400,
      })),
    );

    await runPsiTickForTest();

    // 15 URLs ciblées
    expect(_internals.TARGET_URLS).toHaveLength(15);
    expect(fetchMock).toHaveBeenCalledTimes(15);
    // 3 metrics persistées par URL (LCP, CLS, TBT) × 15 URLs = 45 samples
    expect(webVitalCreateMock).toHaveBeenCalledTimes(45);
    // Aucune divergence > 50% → pas d'alerte
    expect(alertBulkMock).not.toHaveBeenCalled();
  });

  it("edge case : LCP PSI 3500ms vs RUM 1500ms (Δ 133%) → alertWebVitalsBulk déclenchée", async () => {
    process.env.GOOGLE_PSI_API_KEY = "test-psi-key";

    // LCP PSI critique : 3500ms (> Google good 2500)
    const psiResp = makePsiResponse({ lcp: 3500, cls: 0.15 });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => psiResp,
    });
    vi.stubGlobal("fetch", fetchMock);

    // RUM p75 = 1500ms pour /fr/audit (4 verticales doctrine) sur toutes les URLs
    // Need ≥ 5 samples par groupe (MIN_SAMPLES)
    const rumSamples = _internals.TARGET_URLS.flatMap((url) => {
      const path = new URL(url).pathname;
      return Array.from({ length: 6 }, () => ({
        url: path,
        metric: "LCP",
        value: 1500,
      }));
    });
    webVitalFindManyMock.mockResolvedValue(rumSamples);

    await runPsiTickForTest();

    // Divergence détectée → alertWebVitalsBulk appelée (top 5)
    expect(alertBulkMock).toHaveBeenCalledTimes(1);
    const [topFive, totalCount, windowHours] = alertBulkMock.mock.calls[0] as [
      ReadonlyArray<{ url: string; metric: string; p75: number; budget: number }>,
      number,
      number,
    ];
    expect(topFive.length).toBeLessThanOrEqual(5);
    expect(topFive.length).toBeGreaterThan(0);
    // Metric label PSI-DIVERGE
    expect(topFive[0]?.metric).toContain("PSI-DIVERGE");
    expect(topFive[0]?.p75).toBe(3500);
    expect(topFive[0]?.budget).toBe(1500); // RUM porté dans `budget`
    // totalCount ≥ topFive.length (15 URLs × 1 metric LCP = 15 divergences)
    expect(totalCount).toBeGreaterThanOrEqual(topFive.length);
    expect(windowHours).toBe(168); // 7j
  });
});
