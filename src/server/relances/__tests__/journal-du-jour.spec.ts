// CAMP-3 — Le journal du jour et l'anti-doublon lisent le journal ET la corbeille.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ logs: vi.fn(), outbox: vi.fn(), log1: vi.fn(), gare: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: {
      findMany: (...a: unknown[]) => h.logs(...a),
      findFirst: (...a: unknown[]) => h.log1(...a),
    },
    emailOutbox: { findMany: (...a: unknown[]) => h.outbox(...a) },
  },
}));
vi.mock("@/server/email/outbox-service", () => ({
  jobIdDejaGare: (...a: unknown[]) => h.gare(...a),
}));

import { dejaTente, relanceesAujourdhui } from "../passer-campagnes";

beforeEach(() => vi.clearAllMocks());

describe("relanceesAujourdhui", () => {
  it("réunit le journal et la corbeille, depuis minuit à Paris, campagnes fi- seulement", async () => {
    h.logs.mockResolvedValue([{ entityId: "a" }]);
    h.outbox.mockResolvedValue([{ entityId: "b" }, { entityId: null }]);
    const r = await relanceesAujourdhui(["a", "b", "c"], new Date("2026-10-13T08:00:00Z"));
    expect([...(r ?? [])].sort()).toEqual(["a", "b"]);
    const q = h.logs.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(q.where.jobId).toEqual({ startsWith: "fi-" });
    // 13/10 à 0 h à Paris (heure d'été) = 12/10 22:00 UTC.
    expect(q.where.createdAt).toEqual({ gte: new Date("2026-10-12T22:00:00Z") });
  });
  it("base muette : null", async () => {
    h.logs.mockRejectedValue(new Error("base"));
    h.outbox.mockResolvedValue([]);
    expect(await relanceesAujourdhui(["a"], new Date())).toBeNull();
  });
});

describe("dejaTente", () => {
  it("un envoi en échec définitif ne compte pas", async () => {
    h.log1.mockResolvedValue(null);
    h.gare.mockResolvedValue(false);
    expect(await dejaTente("k")).toBe(false);
    expect(h.log1).toHaveBeenCalledWith({
      where: { jobId: "k", status: { not: "failed" } },
      select: { id: true },
    });
  });
  it("garé en corbeille : déjà tenté", async () => {
    h.log1.mockResolvedValue(null);
    h.gare.mockResolvedValue(true);
    expect(await dejaTente("k")).toBe(true);
  });
  it("corbeille illisible : inconnu", async () => {
    h.log1.mockResolvedValue(null);
    h.gare.mockResolvedValue(null);
    expect(await dejaTente("k")).toBeNull();
  });
});
