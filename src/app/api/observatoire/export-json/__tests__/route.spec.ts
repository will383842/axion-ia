/**
 * Export JSON de l'observatoire (lot L3) : aucun historique publié tant que le
 * snapshot est vide (pas de vraie réponse), comme la page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { readLatestSnapshot, readSnapshotHistory } = vi.hoisted(() => ({
  readLatestSnapshot: vi.fn(),
  readSnapshotHistory: vi.fn(),
}));

vi.mock("@/server/observatoire/snapshot", () => ({ readLatestSnapshot, readSnapshotHistory }));

import { GET } from "../route";

const POINT = {
  computedAt: "2026-10-25T00:00:00.000Z",
  totalResponses: 150,
  insights: { a: 1 },
};

describe("GET /api/observatoire/export-json", () => {
  beforeEach(() => {
    readLatestSnapshot.mockReset();
    readSnapshotHistory.mockReset();
  });

  it("ne contient aucun historique quand le snapshot est vide", async () => {
    readLatestSnapshot.mockResolvedValue({ totalResponses: 0 });
    readSnapshotHistory.mockResolvedValue([POINT]);
    const body = JSON.parse(await (await GET()).text());
    expect(body.history).toEqual([]);
  });

  it("ne contient aucun historique sans snapshot", async () => {
    readLatestSnapshot.mockResolvedValue(null);
    readSnapshotHistory.mockResolvedValue([POINT]);
    const body = JSON.parse(await (await GET()).text());
    expect(body.history).toEqual([]);
  });

  it("renvoie l'historique quand le snapshot a des réponses", async () => {
    readLatestSnapshot.mockResolvedValue({ totalResponses: 150 });
    readSnapshotHistory.mockResolvedValue([POINT]);
    const body = JSON.parse(await (await GET()).text());
    expect(body.history).toEqual([POINT]);
  });
});
