/**
 * P3-32 (audit re-run 2026-05-15) — Test E2E worker Web Vitals monitor.
 *
 * Couvre le flow complet : samples seed (mocked prisma) → runMonitorTickForTest
 * → assertions sur appels helpers Telegram + snapshot ContentGenConfig.
 *
 * Bouclages testés :
 *  1. Pas de samples → snapshot vide écrit + 0 alerte
 *  2. Kill-switch actif → skip total (0 prisma read, 0 alerte, 0 snapshot)
 *  3. Samples < MIN_SAMPLES → ignorés (pas d'aggregate)
 *  4. ≤ 5 breaches LCP/INP/CLS → 1 helper dédié par metric
 *  5. > 5 breaches → 1 seul appel alertWebVitalsBulk avec top 5
 *  6. Metric non-core (FCP/TTFB/TBT) en breach → alertWebVitalsBulk
 *  7. Aggregate snapshot écrit dans ContentGenConfig.web_vitals_p75
 *
 * Convention : vi.mock hoist au top — les imports relatifs au worker
 * doivent venir APRÈS le bloc mock.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mocks (vi.hoisted pour partager refs avec vi.mock factories) ──────────

const {
  findManyMock,
  upsertMock,
  alertLcpMock,
  alertInpMock,
  alertClsMock,
  alertBulkMock,
  readConfigMock,
} = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  upsertMock: vi.fn().mockResolvedValue({}),
  alertLcpMock: vi.fn().mockResolvedValue(undefined),
  alertInpMock: vi.fn().mockResolvedValue(undefined),
  alertClsMock: vi.fn().mockResolvedValue(undefined),
  alertBulkMock: vi.fn().mockResolvedValue(undefined),
  readConfigMock: vi.fn().mockResolvedValue({ active: false }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    webVitalSample: { findMany: findManyMock },
    contentGenConfig: { upsert: upsertMock },
  },
}));

vi.mock("@/server/content-gen/shared/content-gen-alerts", () => ({
  alertLcpDegraded: alertLcpMock,
  alertInpDegraded: alertInpMock,
  alertClsDegraded: alertClsMock,
  alertWebVitalsBulk: alertBulkMock,
}));

vi.mock("@/server/actions/content-gen/_settings", () => ({
  readContentGenConfig: readConfigMock,
}));

// ─── Imports après mocks ───────────────────────────────────────────────────

import { runMonitorTickForTest, _internals } from "../content-web-vitals-monitor-worker";

// ─── Helpers de seed ───────────────────────────────────────────────────────

interface SampleSeed {
  url: string;
  metric: "LCP" | "INP" | "CLS" | "FCP" | "TTFB" | "TBT";
  value: number;
}

/** Génère n samples identiques pour atteindre MIN_SAMPLES. */
function seedSamples(seeds: ReadonlyArray<SampleSeed>): void {
  const expanded = seeds.flatMap((s) =>
    Array.from({ length: _internals.MIN_SAMPLES }, () => ({ ...s })),
  );
  findManyMock.mockResolvedValue(expanded);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("content-web-vitals-monitor-worker — E2E P3-32 (audit 2026-05-15)", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    upsertMock.mockClear();
    alertLcpMock.mockClear();
    alertInpMock.mockClear();
    alertClsMock.mockClear();
    alertBulkMock.mockClear();
    readConfigMock.mockReset();
    readConfigMock.mockResolvedValue({ active: false });
  });

  it("écrit snapshot vide + 0 alerte quand aucun sample dans la fenêtre", async () => {
    findManyMock.mockResolvedValue([]);
    await runMonitorTickForTest();
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const arg = upsertMock.mock.calls[0]?.[0] as {
      where: { key: string };
      create: { value: { total_samples: number; aggregates: unknown[] } };
    };
    expect(arg.where.key).toBe("web_vitals_p75");
    expect(arg.create.value.total_samples).toBe(0);
    expect(arg.create.value.aggregates).toEqual([]);
    expect(alertLcpMock).not.toHaveBeenCalled();
    expect(alertInpMock).not.toHaveBeenCalled();
    expect(alertClsMock).not.toHaveBeenCalled();
    expect(alertBulkMock).not.toHaveBeenCalled();
  });

  /**
   * 🔴 CE TEST A CHANGÉ DE CONTRAT le 2026-08-03, et c'est voulu.
   *
   * Il verrouillait « kill-switch actif → skip TOTAL : 0 lecture, 0 snapshot,
   * 0 alerte ». Conséquence mesurée en production : le kill switch de la
   * génération de contenu a été activé le 24/07 à 21 h 12, et le snapshot
   * `web_vitals_p75` a cessé d'être écrit — dix jours durant, la page
   * « Vitesse du site » a servi un instantané périmé pendant que 79 122
   * mesures continuaient d'arriver.
   *
   * L'intention d'origine (audit 2026-05-15 P1-8) visait les ALERTES Telegram,
   * pas la mesure. La mesure ne coûte aucun appel de modèle : elle lit des
   * lignes déjà en base. Un arrêt d'urgence de la production de contenu ne
   * doit pas rendre aveugle la surveillance du site en ligne.
   *
   * Nouveau contrat : le snapshot est TOUJOURS écrit, seules les alertes sont
   * mises en pause.
   */
  it("kill-switch actif → snapshot écrit quand même, mais AUCUNE alerte envoyée", async () => {
    readConfigMock.mockResolvedValue({ active: true });
    // 5 samples LCP au-dessus du budget → il y aurait normalement une alerte.
    findManyMock.mockResolvedValue([
      { url: "/fr", metric: "LCP", value: 5000 },
      { url: "/fr", metric: "LCP", value: 5100 },
      { url: "/fr", metric: "LCP", value: 5200 },
      { url: "/fr", metric: "LCP", value: 5300 },
      { url: "/fr", metric: "LCP", value: 5400 },
    ]);

    await runMonitorTickForTest();

    // La mesure a bien eu lieu et le snapshot est écrit.
    expect(findManyMock).toHaveBeenCalled();
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const arg = upsertMock.mock.calls[0]?.[0] as {
      where: { key: string };
      create: { value: { total_samples: number; breaches: unknown[] } };
    };
    expect(arg.where.key).toBe("web_vitals_p75");
    expect(arg.create.value.total_samples).toBe(5);
    expect(arg.create.value.breaches).toHaveLength(1);

    // Mais rien n'est parti sur Telegram : c'est ça, la pause.
    expect(alertLcpMock).not.toHaveBeenCalled();
    expect(alertInpMock).not.toHaveBeenCalled();
    expect(alertClsMock).not.toHaveBeenCalled();
    expect(alertBulkMock).not.toHaveBeenCalled();
  });

  it("samples < MIN_SAMPLES ignorés (pas d'aggregate, pas d'alerte)", async () => {
    // 3 samples LCP sur même URL → < MIN_SAMPLES (5) → groupé mais skip
    findManyMock.mockResolvedValue([
      { url: "/fr", metric: "LCP", value: 3000 },
      { url: "/fr", metric: "LCP", value: 3100 },
      { url: "/fr", metric: "LCP", value: 3200 },
    ]);
    await runMonitorTickForTest();
    const arg = upsertMock.mock.calls[0]?.[0] as {
      create: { value: { aggregates: unknown[]; breaches: unknown[] } };
    };
    expect(arg.create.value.aggregates).toHaveLength(0);
    expect(arg.create.value.breaches).toHaveLength(0);
    expect(alertLcpMock).not.toHaveBeenCalled();
  });

  it("≤ 5 breaches LCP/INP/CLS → 1 helper dédié par metric core", async () => {
    seedSamples([
      { url: "/fr/home", metric: "LCP", value: 2400 }, // budget 1800 → breach
      { url: "/fr/audit", metric: "INP", value: 200 }, // budget 100 → breach
      { url: "/fr/tarifs", metric: "CLS", value: 0.15 }, // budget 0.01 → breach
    ]);
    await runMonitorTickForTest();
    expect(alertLcpMock).toHaveBeenCalledTimes(1);
    expect(alertInpMock).toHaveBeenCalledTimes(1);
    expect(alertClsMock).toHaveBeenCalledTimes(1);
    expect(alertBulkMock).not.toHaveBeenCalled();

    // Vérifie payload helper LCP
    const lcpArg = alertLcpMock.mock.calls[0]?.[0] as {
      url: string;
      p75: number;
      budget: number;
      count: number;
    };
    expect(lcpArg.url).toBe("/fr/home");
    expect(lcpArg.p75).toBe(2400);
    expect(lcpArg.budget).toBe(_internals.BUDGETS.LCP);
    expect(lcpArg.count).toBe(_internals.MIN_SAMPLES);
  });

  it("> 5 breaches → 1 seul appel alertWebVitalsBulk avec top 5 (sortBy ratio p75/budget)", async () => {
    // 6 URLs LCP en breach, ratios variables pour vérifier le tri
    seedSamples([
      { url: "/u1", metric: "LCP", value: 2000 }, // ratio 2000/1800 = 1.11
      { url: "/u2", metric: "LCP", value: 5400 }, // ratio 5400/1800 = 3.00 ← top
      { url: "/u3", metric: "LCP", value: 3600 }, // ratio 2.00
      { url: "/u4", metric: "LCP", value: 2700 }, // ratio 1.50
      { url: "/u5", metric: "LCP", value: 4500 }, // ratio 2.50
      { url: "/u6", metric: "LCP", value: 1900 }, // ratio 1.06 → exclu top 5
    ]);
    await runMonitorTickForTest();
    expect(alertLcpMock).not.toHaveBeenCalled();
    expect(alertBulkMock).toHaveBeenCalledTimes(1);
    const args = alertBulkMock.mock.calls[0];
    const topFive = args?.[0] as ReadonlyArray<{ url: string; p75: number }>;
    expect(topFive).toHaveLength(5);
    // Top breach = /u2 (ratio 3.00)
    expect(topFive[0]?.url).toBe("/u2");
    expect(topFive[0]?.p75).toBe(5400);
    // /u6 (ratio le plus bas) doit être exclu
    expect(topFive.map((b) => b.url)).not.toContain("/u6");
  });

  it("metric non-core (FCP) en breach → alertWebVitalsBulk même avec ≤ 5 breaches", async () => {
    seedSamples([
      { url: "/fr/home", metric: "LCP", value: 2400 }, // core LCP → helper dédié
      { url: "/fr/blog", metric: "FCP", value: 1500 }, // non-core → bulk
    ]);
    await runMonitorTickForTest();
    expect(alertLcpMock).toHaveBeenCalledTimes(1);
    expect(alertBulkMock).toHaveBeenCalledTimes(1); // bulk pour les non-core
    const bulkArgs = alertBulkMock.mock.calls[0];
    const nonCore = bulkArgs?.[0] as ReadonlyArray<{ metric: string }>;
    expect(nonCore).toHaveLength(1);
    expect(nonCore[0]?.metric).toBe("FCP");
  });

  it("snapshot ContentGenConfig.web_vitals_p75 inclut total_samples + aggregates capped 200", async () => {
    seedSamples([{ url: "/fr/home", metric: "LCP", value: 1000 }]); // 1000 < budget 1800 = OK
    await runMonitorTickForTest();
    // Trouve l'appel upsert pour web_vitals_p75
    const p75Call = upsertMock.mock.calls.find(
      (call) => (call[0] as { where: { key: string } }).where.key === "web_vitals_p75",
    );
    expect(p75Call).toBeDefined();
    const value = (
      p75Call?.[0] as { create: { value: { window_hours: number; aggregates: unknown[] } } }
    ).create.value;
    expect(value.window_hours).toBe(_internals.WINDOW_HOURS);
    expect(value.aggregates.length).toBeLessThanOrEqual(200);
  });

  it("snapshot last_alert écrit si breaches présents avec top 5", async () => {
    seedSamples([{ url: "/fr/home", metric: "LCP", value: 2400 }]);
    await runMonitorTickForTest();
    // Filtre les calls pour web_vitals_last_alert
    const lastAlertCall = upsertMock.mock.calls.find(
      (call) => (call[0] as { where: { key: string } }).where.key === "web_vitals_last_alert",
    );
    expect(lastAlertCall).toBeDefined();
    const value = (
      lastAlertCall?.[0] as {
        create: { value: { breach_count: number; top_breaches: unknown[] } };
      }
    ).create.value;
    expect(value.breach_count).toBe(1);
    expect(value.top_breaches).toHaveLength(1);
  });
});
