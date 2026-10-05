/**
 * Annexe 1 du contrat v2 : un scénario nommé par règle d'argent.
 * Le « plafond » d'une formation est son forfait de palier (250 / 500 / 1 000 €) : jamais
 * dépassé, quel que soit le prix facturé.
 */
import { describe, expect, it } from "vitest";

import { commandesSoldees, type FactureDeCommande } from "../commandes";
import {
  ADRESSE_VALIDE_JOURS,
  PALIERS_FORMATION,
  PEREMPTION_JOURS,
  calculerCommission,
  partParrainage,
} from "../regles";

const montant = (r: ReturnType<typeof calculerCommission>) =>
  r.statut === "calculee" ? r.montantCents : null;

describe("formation : forfait au prorata du HT facturé, arrondi à l'inférieur, plafonné au forfait", () => {
  it("vendue au prix public : le forfait plein, 250 € / 500 € / 1 000 €", () => {
    const forfaits = [
      "formation-generale-4h",
      "formation-generale-1j",
      "formation-generale-2j",
    ].map((palier) => {
      const p = PALIERS_FORMATION.find((x) => x.id === palier)!;
      return montant(
        calculerCommission({ activite: "formation", palier, factureHtCents: p.prixCents }),
      );
    });
    expect(forfaits).toEqual([25_000, 50_000, 100_000]);
  });

  it("remise de 20 % sur 1 jour : 500 € × 1 520 ÷ 1 900 = 400 €", () => {
    expect(
      montant(
        calculerCommission({
          activite: "formation",
          palier: "formation-generale-1j",
          factureHtCents: 152_000,
        }),
      ),
    ).toBe(40_000);
  });

  it("arrondi au centime INFÉRIEUR : 1 199,99 € sur la formation de 4 h donne 249,99 €, pas 250 €", () => {
    expect(
      montant(
        calculerCommission({
          activite: "formation",
          palier: "formation-generale-4h",
          factureHtCents: 119_999,
        }),
      ),
    ).toBe(24_999);
  });

  it("jamais plus que le forfait : 2 jours vendus 10 000 € HT restent à 1 000 €", () => {
    expect(
      montant(
        calculerCommission({
          activite: "formation",
          palier: "formation-generale-2j",
          factureHtCents: 1_000_000,
        }),
      ),
    ).toBe(100_000);
  });

  it("aucun forfait n'est supérieur à celui de son palier, du prix 0 au prix doublé", () => {
    for (const p of PALIERS_FORMATION)
      for (const ht of [0, 1, p.prixCents - 1, p.prixCents, p.prixCents * 2])
        expect(
          montant(calculerCommission({ activite: "formation", palier: p.id, factureHtCents: ht })),
        ).toBeLessThanOrEqual(p.forfaitCents);
  });

  it("facture négative (avoir supérieur) : zéro, jamais négatif", () => {
    expect(
      montant(
        calculerCommission({
          activite: "formation",
          palier: "formation-generale-1j",
          factureHtCents: -5_000,
        }),
      ),
    ).toBe(0);
  });
});

describe("autres activités : taux de l'annexe 1 sur le HT, arrondi à l'inférieur", () => {
  it("audit 30 %", () => {
    expect(montant(calculerCommission({ activite: "audit", factureHtCents: 333_33 }))).toBe(9_999);
  });
  it("implémentation 15 %", () => {
    expect(
      montant(calculerCommission({ activite: "implementation", factureHtCents: 100_001 })),
    ).toBe(15_000);
  });
  it("1-to-1 et coaching à la séance : 30 % (le coaching se classe en « un_a_un »)", () => {
    expect(montant(calculerCommission({ activite: "un_a_un", factureHtCents: 90_000 }))).toBe(
      27_000,
    );
  });
  it("développement web : aucune commission", () => {
    expect(calculerCommission({ activite: "site_web", factureHtCents: 500_000 })).toEqual({
      statut: "aucune",
    });
  });
});

describe("parrain : 10 % de la commission du filleul, pendant 6 mois", () => {
  const filleulSigneAt = new Date("2026-03-31T10:00:00Z");
  it("le dernier jour des 6 mois (30 septembre) : 10 %, arrondi à l'inférieur", () => {
    expect(
      partParrainage({
        commissionFilleulCents: 12_345,
        filleulSigneAt,
        commandeSigneeAt: new Date("2026-09-30T10:00:00Z"),
      }),
    ).toBe(1_234);
  });
  it("le lendemain : rien", () => {
    expect(
      partParrainage({
        commissionFilleulCents: 12_345,
        filleulSigneAt,
        commandeSigneeAt: new Date("2026-10-01T10:00:00Z"),
      }),
    ).toBe(0);
  });
  it("commande avant la signature du filleul : rien", () => {
    expect(
      partParrainage({
        commissionFilleulCents: 12_345,
        filleulSigneAt,
        commandeSigneeAt: new Date("2026-03-30T10:00:00Z"),
      }),
    ).toBe(0);
  });
});

describe("commission seulement quand TOUTES les factures de la commande sont payées, avoir déduit", () => {
  const f = (o: Partial<FactureDeCommande>): FactureDeCommande => ({
    id: "F",
    devisId: "D",
    statut: "payee",
    avoirDeId: null,
    montantHtCents: 100_000,
    emiseAt: new Date("2026-09-01T00:00:00Z"),
    ...o,
  });
  it("trois factures dont une seulement émise : aucune commande soldée", () => {
    expect(
      commandesSoldees([f({ id: "1" }), f({ id: "2" }), f({ id: "3", statut: "emise" })]),
    ).toEqual([]);
  });
  it("trois factures payées et un avoir : le total HT est net de l'avoir", () => {
    const [c] = commandesSoldees([
      f({ id: "1" }),
      f({ id: "2" }),
      f({ id: "3" }),
      f({ id: "AV", avoirDeId: "2", montantHtCents: -40_000, statut: "emise" }),
    ]);
    expect(c?.totalHtCents).toBe(260_000);
  });
});

describe("période de démarrage (art. 2.8) : délais opérés à la main, pas par le passage quotidien", () => {
  it("ADRESSE_VALIDE_JOURS (45) et PEREMPTION_JOURS (90) restent des constantes de référence, appliquées manuellement", () => {
    expect([ADRESSE_VALIDE_JOURS, PEREMPTION_JOURS]).toEqual([45, 90]);
  });
  it.todo(
    "automatiser la fin d'attribution sans adresse valide (45 j) et la péremption sans suite (90 j) à la sortie de la période de démarrage",
  );
});
