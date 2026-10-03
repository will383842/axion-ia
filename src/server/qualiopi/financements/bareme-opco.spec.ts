/**
 * Tests — bareme-opco.ts (Lot 5) : résolution du référentiel versionné.
 *
 * Stratégie : mock @/lib/prisma. Vérifie resolveBaremeOpco (OPCO inconnu → null,
 * where de versionnement, tri desc), tarifHoraireBaremeCents (modalité + null),
 * listBaremesEnVigueur (dédup par OPCO), listHistoriqueOpco, stub-safe.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    baremeOpco: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  resolveBaremeOpco,
  tarifHoraireBaremeCents,
  listBaremesEnVigueur,
  listHistoriqueOpco,
} from "./bareme-opco";

type MockFn = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  baremeOpco: { findFirst: MockFn; findMany: MockFn };
};

const ASOF = new Date("2026-07-13T00:00:00.000Z");

function bareme(over: Record<string, unknown> = {}) {
  return {
    id: "b1",
    opco: "atlas",
    perimetre: null,
    idcc: null,
    trancheEffectif: "tous",
    intraHoraireCents: 4000,
    interPresentielCents: 2500,
    interDistancielCents: 1500,
    plafondFormationCents: null,
    plafondAnnuelCents: 800000,
    sourceUrl: null,
    releveLe: new Date("2026-01-01"),
    dateEffet: new Date("2026-01-01"),
    effectiveTo: null,
    note: null,
    createdById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

describe("resolveBaremeOpco", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne null pour un OPCO inconnu sans toucher la DB", async () => {
    const r = await resolveBaremeOpco("inconnu", ASOF);
    expect(r).toBeNull();
    expect(mockPrisma.baremeOpco.findFirst).not.toHaveBeenCalled();
  });

  it("retourne null pour null/undefined", async () => {
    expect(await resolveBaremeOpco(null, ASOF)).toBeNull();
    expect(await resolveBaremeOpco(undefined, ASOF)).toBeNull();
  });

  it("interroge les versions en vigueur de l'OPCO (sans IDCC, tranche `tous`), tri desc", async () => {
    mockPrisma.baremeOpco.findMany.mockResolvedValue([bareme()]);
    const r = await resolveBaremeOpco("atlas", ASOF);
    expect(r?.id).toBe("b1");
    expect(mockPrisma.baremeOpco.findMany).toHaveBeenCalledWith({
      where: {
        opco: "atlas",
        dateEffet: { lte: ASOF },
        AND: [
          { OR: [{ effectiveTo: null }, { effectiveTo: { gt: ASOF } }] },
          { OR: [{ idcc: null }] },
        ],
        trancheEffectif: { in: ["tous"] },
      },
      orderBy: { dateEffet: "desc" },
    });
  });

  it("lot A4 — avec IDCC et effectif : candidats de branche + tranche exacte, branche prioritaire", async () => {
    mockPrisma.baremeOpco.findMany.mockResolvedValue([
      bareme({ id: "opco-11-49", idcc: null, trancheEffectif: "de_11_a_49" }),
      bareme({ id: "branche-tous", idcc: "1516", trancheEffectif: "tous" }),
    ]);
    const r = await resolveBaremeOpco("akto", ASOF, { idcc: "1516", effectif: 20 });
    expect(r?.id).toBe("branche-tous");
    const appel = mockPrisma.baremeOpco.findMany.mock.calls[0]?.[0] as {
      where: { AND: unknown[]; trancheEffectif: unknown };
    };
    expect(appel.where.AND[1]).toEqual({ OR: [{ idcc: null }, { idcc: "1516" }] });
    expect(appel.where.trancheEffectif).toEqual({ in: ["de_11_a_49", "tous"] });
  });

  it("stub-safe : renvoie null si la DB throw", async () => {
    mockPrisma.baremeOpco.findMany.mockRejectedValue(new Error("db down"));
    expect(await resolveBaremeOpco("atlas", ASOF)).toBeNull();
  });
});

describe("tarifHoraireBaremeCents", () => {
  it("sélectionne le plafond selon la modalité", () => {
    const b = bareme();
    expect(tarifHoraireBaremeCents(b, "intra")).toBe(4000);
    expect(tarifHoraireBaremeCents(b, "inter_presentiel")).toBe(2500);
    expect(tarifHoraireBaremeCents(b, "inter_distanciel")).toBe(1500);
  });

  it("renvoie null si le plafond concerné est absent (structure vide)", () => {
    const b = bareme({ intraHoraireCents: null });
    expect(tarifHoraireBaremeCents(b, "intra")).toBeNull();
  });
});

describe("listBaremesEnVigueur", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ne conserve que le barème le plus récent par OPCO", async () => {
    mockPrisma.baremeOpco.findMany.mockResolvedValue([
      bareme({ id: "atlas-new", opco: "atlas", dateEffet: new Date("2026-06-01") }),
      bareme({ id: "atlas-old", opco: "atlas", dateEffet: new Date("2026-01-01") }),
      bareme({ id: "akto-1", opco: "akto", dateEffet: new Date("2026-03-01") }),
    ]);
    const rows = await listBaremesEnVigueur(ASOF);
    expect(rows.map((r) => r.id).sort()).toEqual(["akto-1", "atlas-new"]);
  });

  it("lot A4 — garde un barème par (OPCO, IDCC, tranche) : la branche ne masque pas l'OPCO", async () => {
    mockPrisma.baremeOpco.findMany.mockResolvedValue([
      bareme({ id: "akto-1516", opco: "akto", idcc: "1516" }),
      bareme({ id: "akto-inter", opco: "akto" }),
      bareme({ id: "akto-inter-11", opco: "akto", trancheEffectif: "de_11_a_49" }),
    ]);
    const rows = await listBaremesEnVigueur(ASOF);
    expect(rows.map((r) => r.id).sort()).toEqual(["akto-1516", "akto-inter", "akto-inter-11"]);
  });

  it("stub-safe → []", async () => {
    mockPrisma.baremeOpco.findMany.mockRejectedValue(new Error("down"));
    expect(await listBaremesEnVigueur(ASOF)).toEqual([]);
  });
});

describe("listHistoriqueOpco", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renvoie [] pour un OPCO inconnu", async () => {
    expect(await listHistoriqueOpco("inconnu")).toEqual([]);
    expect(mockPrisma.baremeOpco.findMany).not.toHaveBeenCalled();
  });

  it("interroge l'historique trié desc", async () => {
    mockPrisma.baremeOpco.findMany.mockResolvedValue([bareme()]);
    await listHistoriqueOpco("atlas");
    expect(mockPrisma.baremeOpco.findMany).toHaveBeenCalledWith({
      where: { opco: "atlas" },
      orderBy: { dateEffet: "desc" },
    });
  });
});
