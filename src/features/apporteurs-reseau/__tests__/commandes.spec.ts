import { describe, expect, it } from "vitest";

import { commandesSoldees, type FactureDeCommande } from "../commandes";

const f = (o: Partial<FactureDeCommande> & { id: string }): FactureDeCommande => ({
  devisId: "D1",
  statut: "payee",
  avoirDeId: null,
  montantHtCents: 100_000,
  emiseAt: new Date("2026-09-01T00:00:00Z"),
  ...o,
});

describe("commande soldée : la commission attend les 100 %", () => {
  it("un acompte payé seul, solde encore dû : aucune commande soldée", () => {
    const r = commandesSoldees([
      f({ id: "A", montantHtCents: 60_000 }),
      f({ id: "S", statut: "emise", montantHtCents: 140_000 }),
    ]);
    expect(r).toEqual([]);
  });

  it("acompte en retard ou partiellement payé : pas soldée non plus", () => {
    expect(
      commandesSoldees([f({ id: "A" }), f({ id: "S", statut: "partiellement_payee" })]),
    ).toEqual([]);
    expect(commandesSoldees([f({ id: "A" }), f({ id: "S", statut: "en_retard" })])).toEqual([]);
  });

  it("acompte + solde payés : UNE commande, calculée sur le total HT facturé", () => {
    const r = commandesSoldees([
      f({ id: "A", montantHtCents: 60_000, emiseAt: new Date("2026-09-01T00:00:00Z") }),
      f({ id: "S", montantHtCents: 140_000, emiseAt: new Date("2026-09-20T00:00:00Z") }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.totalHtCents).toBe(200_000);
    expect(r[0]!.factureIds.sort()).toEqual(["A", "S"]);
    expect(r[0]!.factureCleId).toBe("S");
  });

  it("une facture brouillon ou annulée de la commande ne bloque pas le solde", () => {
    const r = commandesSoldees([
      f({ id: "A" }),
      f({ id: "X", statut: "annulee" }),
      f({ id: "B", statut: "brouillon" }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.totalHtCents).toBe(100_000);
  });

  it("avoir : vient en déduction du total HT facturé", () => {
    const r = commandesSoldees([
      f({ id: "A", montantHtCents: 200_000 }),
      f({ id: "AV", avoirDeId: "A", montantHtCents: -50_000, statut: "emise" }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.totalHtCents).toBe(150_000);
    expect(r[0]!.factureIds).toEqual(["A"]);
  });

  it("avoir qui annule toute la commande : plus de commission", () => {
    expect(
      commandesSoldees([
        f({ id: "A", montantHtCents: 100_000 }),
        f({ id: "AV", avoirDeId: "A", montantHtCents: -100_000 }),
      ]),
    ).toEqual([]);
  });

  it("factures sans devis : traitées une par une", () => {
    const r = commandesSoldees([
      f({ id: "L1", devisId: null, montantHtCents: 10_000 }),
      f({ id: "L2", devisId: null, montantHtCents: 20_000, statut: "emise" }),
      f({ id: "L3", devisId: null, montantHtCents: 30_000 }),
    ]);
    expect(r.map((c) => [c.factureCleId, c.totalHtCents]).sort()).toEqual([
      ["L1", 10_000],
      ["L3", 30_000],
    ]);
  });

  it("deux devis distincts : deux commandes indépendantes", () => {
    const r = commandesSoldees([
      f({ id: "A", devisId: "D1" }),
      f({ id: "B", devisId: "D2", statut: "emise" }),
    ]);
    expect(r.map((c) => c.devisId)).toEqual(["D1"]);
  });
});
