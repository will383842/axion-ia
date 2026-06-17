// Observatoire IA 2026 — garde d'intégrité de la génération d'article.
// Régression : la garde DOIT s'appuyer sur le compte RÉEL (hors seed `seed:%`),
// jamais sur `snapshot.totalResponses` qui inclut la fixture dev (8627). Sans ça
// une base seedée publierait des chiffres fabriqués comme une vraie étude (L121-2).

import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAdminMock, enqueueMock, readSnapshotMock, countRealMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(async () => ({ id: "admin-1", role: "admin" })),
  enqueueMock: vi.fn(async () => ({ jobId: "job-1" })),
  readSnapshotMock: vi.fn<() => Promise<unknown>>(),
  countRealMock: vi.fn<() => Promise<number>>(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { barometerResponse: { count: vi.fn() }, barometerSnapshot: { findUnique: vi.fn() } },
}));
vi.mock("@/server/actions/content-gen/_auth", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/server/actions/content-gen/enqueue", () => ({ enqueueDirectGen: enqueueMock }));
vi.mock("@/server/observatoire/snapshot", () => ({
  readLatestSnapshot: readSnapshotMock,
  countRealResponses: countRealMock,
  recomputeAndPersistSnapshot: vi.fn(),
}));

import { generateBarometerArticle } from "../admin";

// Snapshot avec un total NON nul (inclut le seed) — l'ancien code (buggé)
// aurait laissé passer la génération sur cette seule base.
const SEEDED_SNAPSHOT = { totalResponses: 8627, distributions: {}, insights: {} };

describe("generateBarometerArticle — garde réel-vs-seed", () => {
  beforeEach(() => {
    enqueueMock.mockClear();
    readSnapshotMock.mockReset();
    countRealMock.mockReset();
  });

  it("REFUSE quand 0 réponse réelle, même si le snapshot total > 0 (seed seul)", async () => {
    readSnapshotMock.mockResolvedValue(SEEDED_SNAPSHOT);
    countRealMock.mockResolvedValue(0); // 8627 lignes, toutes seed → 0 réel

    const res = await generateBarometerArticle();

    expect(res.ok).toBe(false);
    expect(enqueueMock).not.toHaveBeenCalled(); // aucune publication
  });

  it("REFUSE quand aucun snapshot n'existe", async () => {
    readSnapshotMock.mockResolvedValue(null);
    countRealMock.mockResolvedValue(12);

    const res = await generateBarometerArticle();

    expect(res.ok).toBe(false);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("AUTORISE quand au moins une réponse réelle existe", async () => {
    readSnapshotMock.mockResolvedValue(SEEDED_SNAPSHOT);
    countRealMock.mockResolvedValue(5); // 5 vraies réponses

    const res = await generateBarometerArticle();

    expect(res.ok).toBe(true);
    expect(enqueueMock).toHaveBeenCalledOnce();
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "barometer_insight" }),
    );
  });
});
