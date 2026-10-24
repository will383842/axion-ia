// Audit blog 2026-10-24 (lot 7) — la santé de la base de connaissances expose
// aussi la fraîcheur (fiches dont `reviewDueAt` est dépassé), sans jamais bloquer.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { countMock, findFirstMock } = vi.hoisted(() => ({
  countMock: vi.fn<(args: { where: Record<string, unknown> }) => Promise<number>>(),
  findFirstMock: vi.fn<() => Promise<{ publishedAt: Date | null } | null>>(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { knowledgeEntry: { count: countMock, findFirst: findFirstMock } },
}));

import { getKbHealth } from "../kb-health";

function brancher(opts: { total: number; publics: number; enRetard: number }): void {
  countMock.mockImplementation(async ({ where }) => {
    if ("reviewDueAt" in where) return opts.enRetard;
    if (where["audience"] === "public") return opts.publics;
    return opts.total;
  });
  findFirstMock.mockResolvedValue({ publishedAt: new Date() });
}

describe("getKbHealth — fraîcheur", () => {
  beforeEach(() => {
    countMock.mockReset();
    findFirstMock.mockReset();
    delete process.env["KB_BYPASS"];
  });

  it("compte les fiches à relire et en donne la part", async () => {
    brancher({ total: 200, publics: 190, enRetard: 50 });
    const h = await getKbHealth();
    expect(h.reviewOverdueCount).toBe(50);
    expect(h.reviewOverdueRatio).toBeCloseTo(0.25);
  });

  it("des fiches en retard de revue ne rendent pas la base malsaine", async () => {
    brancher({ total: 200, publics: 190, enRetard: 200 });
    const h = await getKbHealth();
    expect(h.healthy).toBe(true);
    expect(h.reviewOverdueRatio).toBe(1);
  });

  it("aucune fiche publiée : part à 0, pas de division par zéro", async () => {
    brancher({ total: 0, publics: 0, enRetard: 0 });
    const h = await getKbHealth();
    expect(h.reviewOverdueRatio).toBe(0);
  });
});
