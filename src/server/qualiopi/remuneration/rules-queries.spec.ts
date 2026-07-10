// Tests — rules-queries.ts (lecture des barèmes).
//
// Deux points : la conversion du `Decimal` de `commissionPct`, et le fait que
// les règles CLOSES restent visibles (l'historique explique l'intangibilité
// comptable). Plus le filtre formations qui n'exclut QUE les archivées.

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRuleFindMany = vi.fn();
const mockFormationFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerCompensationRule: { findMany: (...a: unknown[]) => mockRuleFindMany(...a) },
    formation: { findMany: (...a: unknown[]) => mockFormationFindMany(...a) },
  },
}));

import { listFormationOptions, listReglesFormateur } from "./rules-queries";

function decimal(n: number): { toNumber: () => number } {
  return { toNumber: () => n };
}

function ruleRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "r1",
    model: "taux_journalier",
    prestationType: null,
    interventionSlug: null,
    tauxJourneeHtCents: 90_000,
    tauxHoraireHtCents: null,
    commissionPct: null,
    forfaitHtCents: null,
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    effectiveTo: null,
    note: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRuleFindMany.mockResolvedValue([]);
  mockFormationFindMany.mockResolvedValue([]);
});

describe("listReglesFormateur", () => {
  it("convertit le Decimal `commissionPct` en number", async () => {
    mockRuleFindMany.mockResolvedValue([
      ruleRow({ model: "commission_ca_pct", tauxJourneeHtCents: null, commissionPct: decimal(30) }),
    ]);
    const r = await listReglesFormateur("t1");
    expect(r[0]?.commissionPct).toBe(30);
    expect(typeof r[0]?.commissionPct).toBe("number");
  });

  it("`commissionPct` null reste null (pas 0)", async () => {
    mockRuleFindMany.mockResolvedValue([ruleRow()]);
    expect((await listReglesFormateur("t1"))[0]?.commissionPct).toBeNull();
  });

  it("INVARIANT : les règles CLOSES restent visibles (historique)", async () => {
    mockRuleFindMany.mockResolvedValue([
      ruleRow({ id: "close", effectiveTo: new Date("2026-09-01T00:00:00Z") }),
      ruleRow({ id: "ouverte", effectiveTo: null }),
    ]);
    const r = await listReglesFormateur("t1");
    expect(r).toHaveLength(2);
    expect(r.map((x) => x.id)).toContain("close");
  });

  it("trie du plus récent au plus ancien (effectiveFrom desc)", async () => {
    await listReglesFormateur("t1");
    const orderBy = mockRuleFindMany.mock.calls[0]?.[0]?.orderBy;
    expect(orderBy).toEqual([{ effectiveFrom: "desc" }, { createdAt: "desc" }]);
  });

  it("base absente → [] (stub de build)", async () => {
    mockRuleFindMany.mockRejectedValue(new Error("no db"));
    expect(await listReglesFormateur("t1")).toEqual([]);
  });
});

describe("listFormationOptions", () => {
  it("exclut UNIQUEMENT les archivées (garde actif + publié)", async () => {
    await listFormationOptions();
    const where = mockFormationFindMany.mock.calls[0]?.[0]?.where;
    expect(where).toEqual({ statut: { not: "archive" } });
  });

  it("renvoie le slug (comparé par resolveRegle), pas l'id", async () => {
    mockFormationFindMany.mockResolvedValue([{ slug: "ia-generative", titre: "IA générative" }]);
    const r = await listFormationOptions();
    expect(r[0]).toEqual({ slug: "ia-generative", titre: "IA générative" });
  });

  it("base absente → []", async () => {
    mockFormationFindMany.mockRejectedValue(new Error("no db"));
    expect(await listFormationOptions()).toEqual([]);
  });
});
