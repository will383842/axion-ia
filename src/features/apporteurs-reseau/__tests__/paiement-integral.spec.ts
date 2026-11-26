import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  factures: [] as Array<{
    id: string;
    devisId: string | null;
    paidAt: Date | null;
    avoirDeId?: null;
    statut?: string;
  }>,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    factureFormation: {
      findMany: vi.fn(async (a: { where: { id?: { in: string[] }; devisId?: { in: string[] } } }) =>
        etat.factures.filter((f) =>
          a.where.id ? a.where.id.in.includes(f.id) : a.where.devisId!.in.includes(f.devisId ?? ""),
        ),
      ),
    },
  },
}));

import { paiementIntegralLe, paiementsIntegrauxParFacture } from "../paiement-integral";

const d = (s: string) => new Date(`${s}T10:00:00Z`);
beforeEach(() => {
  etat.factures = [];
});

describe("paiement intégral d'une commande", () => {
  it("acompte puis solde : le plus tardif", async () => {
    etat.factures = [
      { id: "f1", devisId: "D1", paidAt: d("2026-10-01") },
      { id: "f2", devisId: "D1", paidAt: d("2026-11-02") },
    ];
    const m = await paiementsIntegrauxParFacture(["f1"]);
    expect(m.get("f1")).toEqual(d("2026-11-02"));
  });

  it("deux commandes : la carte rend chaque date, `paiementIntegralLe` rend la plus ANCIENNE", async () => {
    etat.factures = [
      { id: "f1", devisId: null, paidAt: d("2026-11-03") },
      { id: "f2", devisId: null, paidAt: d("2026-11-05") },
    ];
    const m = await paiementsIntegrauxParFacture(["f1", "f2"]);
    expect(m.get("f1")).toEqual(d("2026-11-03"));
    expect(m.get("f2")).toEqual(d("2026-11-05"));
    expect(await paiementIntegralLe(["f1", "f2"])).toEqual(d("2026-11-03"));
  });

  it("aucune date : null, jamais d'erreur", async () => {
    etat.factures = [{ id: "f1", devisId: null, paidAt: null }];
    expect((await paiementsIntegrauxParFacture(["f1"])).get("f1")).toBeNull();
    expect(await paiementIntegralLe(["f1"])).toBeNull();
    expect(await paiementIntegralLe([])).toBeNull();
  });
});
