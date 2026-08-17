/**
 * Fix 2026-08-15 (audit e2e, C5) — Tests de `addQualityLoopSpend`
 * (content-quality-improver-worker).
 *
 * Symptôme corrigé : le cap `monthlyBudgetCapUsd` (100 $/mois) de la boucle
 * qualité comparait la clé `quality_loop_month_spent`… que personne
 * n'incrémentait jamais — garde morte. Garanties testées, sur le VRAI module
 * importé :
 *  - incrément cumulatif sur le mois courant
 *  - remise à zéro implicite au changement de mois (on ne cumule pas avec un
 *    reliquat périmé)
 *  - no-op sur delta nul/négatif/NaN (pas d'écriture parasite)
 *  - fail-open : une erreur d'écriture ne remonte jamais (le job continue)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks des dépendances lourdes du worker (prisma/bullmq/LLM/telegram) ────

const { readConfigMock, persistConfigMock } = vi.hoisted(() => ({
  readConfigMock: vi.fn(),
  persistConfigMock: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: class {},
  Queue: class {},
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

vi.mock("@/server/actions/content-gen/_settings", () => ({
  readContentGenConfig: readConfigMock,
}));

vi.mock("@/server/content-gen/config-store", () => ({
  persistContentGenConfig: persistConfigMock,
  readKillSwitchFailSafe: vi.fn(),
}));

vi.mock("@/server/content-gen/shared/generation-log", () => ({
  logGeneration: vi.fn(),
  logStep: vi.fn(),
}));

vi.mock("@/server/content-gen/reviewer/llm-judge", () => ({
  reviewArticle: vi.fn(),
  JUDGE_THRESHOLDS: { PUBLISH_MIN: 8.5, IMPROVE_MIN: 6.0 },
}));

vi.mock("@/server/queue/lib/sentry-worker", () => ({
  captureWorkerError: vi.fn(),
}));

vi.mock("@/lib/telegram", () => ({
  sendTelegram: vi.fn(),
}));

import { addQualityLoopSpend } from "@/server/queue/workers/content-quality-improver-worker";

/** Même formule que `currentMonthKey()` du worker (UTC, "YYYY-MM"). */
function monthKeyNow(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

beforeEach(() => {
  readConfigMock.mockReset();
  persistConfigMock.mockReset();
  persistConfigMock.mockResolvedValue(undefined);
});

describe("addQualityLoopSpend — compteur budget boucle qualité (C5)", () => {
  it("cumule sur la dépense existante du mois courant", async () => {
    const month = monthKeyNow();
    readConfigMock.mockResolvedValueOnce({ usd: 10, month });

    await addQualityLoopSpend(2.5, "job-1");

    expect(persistConfigMock).toHaveBeenCalledOnce();
    const [key, value] = persistConfigMock.mock.calls[0] as [
      string,
      { usd: number; month: string },
    ];
    expect(key).toBe("quality_loop_month_spent");
    expect(value).toEqual({ usd: 12.5, month });
  });

  it("repart de zéro quand la valeur stockée date d'un autre mois", async () => {
    readConfigMock.mockResolvedValueOnce({ usd: 87.3, month: "2020-01" });

    await addQualityLoopSpend(1.25);

    const [, value] = persistConfigMock.mock.calls[0] as [string, { usd: number; month: string }];
    // Le reliquat périmé (87.3) ne doit PAS être cumulé.
    expect(value).toEqual({ usd: 1.25, month: monthKeyNow() });
  });

  it("arrondit à 4 décimales (coûts LLM en fractions de cent)", async () => {
    const month = monthKeyNow();
    readConfigMock.mockResolvedValueOnce({ usd: 0.1, month });

    await addQualityLoopSpend(0.20005);

    const [, value] = persistConfigMock.mock.calls[0] as [string, { usd: number }];
    expect(value.usd).toBeCloseTo(0.3001, 4);
  });

  it("no-op sur delta nul, négatif ou NaN (pas d'écriture parasite)", async () => {
    await addQualityLoopSpend(0);
    await addQualityLoopSpend(-3);
    await addQualityLoopSpend(Number.NaN);

    expect(readConfigMock).not.toHaveBeenCalled();
    expect(persistConfigMock).not.toHaveBeenCalled();
  });

  it("fail-open : une erreur d'écriture ne remonte pas au job", async () => {
    readConfigMock.mockResolvedValueOnce({ usd: 0, month: monthKeyNow() });
    persistConfigMock.mockRejectedValueOnce(new Error("DB down"));

    await expect(addQualityLoopSpend(1, "job-2")).resolves.toBeUndefined();
  });

  it("fail-open : une erreur de lecture ne remonte pas non plus", async () => {
    readConfigMock.mockRejectedValueOnce(new Error("DB down"));

    await expect(addQualityLoopSpend(1)).resolves.toBeUndefined();
    expect(persistConfigMock).not.toHaveBeenCalled();
  });
});
