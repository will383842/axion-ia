/**
 * Baromètre (lot L3) : l'historique et l'analyse déjà en base ne sont jamais
 * publiés s'ils reposent sur moins de SEUIL_REPONSES_REELLES vraies réponses.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { historyFindMany, analysisFindUnique } = vi.hoisted(() => ({
  historyFindMany: vi.fn(),
  analysisFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    barometerSnapshotHistory: { findMany: historyFindMany },
    barometerAnalysis: { findUnique: analysisFindUnique },
  },
}));

// analysis.ts importe le routeur LLM : on le neutralise (aucun appel payant).
vi.mock("../../content-gen/providers/provider-router", () => ({ generate: vi.fn() }));

import { SEUIL_REPONSES_REELLES } from "@/content/observatoire/study";
import { readSnapshotHistory } from "../snapshot";
import { readLatestAnalysis } from "../analysis";

describe("readSnapshotHistory — seuil de publication", () => {
  beforeEach(() => historyFindMany.mockReset());

  it("ne demande à la base que les points au-dessus du seuil", async () => {
    historyFindMany.mockResolvedValue([]);
    await readSnapshotHistory(10);
    expect(historyFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { totalResponses: { gte: SEUIL_REPONSES_REELLES } },
        take: 10,
      }),
    );
  });

  it("convertit les lignes renvoyées", async () => {
    historyFindMany.mockResolvedValue([
      {
        computedAt: new Date("2026-10-01T00:00:00Z"),
        totalResponses: SEUIL_REPONSES_REELLES,
        insights: { a: 1 },
      },
    ]);
    const h = await readSnapshotHistory();
    expect(h).toEqual([
      {
        computedAt: "2026-10-01T00:00:00.000Z",
        totalResponses: SEUIL_REPONSES_REELLES,
        insights: { a: 1 },
      },
    ]);
  });
});

describe("readLatestAnalysis — seuil de publication", () => {
  beforeEach(() => analysisFindUnique.mockReset());

  const ligne = (basedOnTotal: number) => ({
    payload: { overview: "x" },
    generatedAt: new Date("2026-10-01T00:00:00Z"),
    basedOnTotal,
  });

  it("renvoie null sous le seuil", async () => {
    analysisFindUnique.mockResolvedValue(ligne(SEUIL_REPONSES_REELLES - 1));
    expect(await readLatestAnalysis()).toBeNull();
  });

  it("renvoie l'analyse au seuil", async () => {
    analysisFindUnique.mockResolvedValue(ligne(SEUIL_REPONSES_REELLES));
    const a = await readLatestAnalysis();
    expect(a?.basedOnTotal).toBe(SEUIL_REPONSES_REELLES);
  });

  it("renvoie null si aucune ligne", async () => {
    analysisFindUnique.mockResolvedValue(null);
    expect(await readLatestAnalysis()).toBeNull();
  });
});
