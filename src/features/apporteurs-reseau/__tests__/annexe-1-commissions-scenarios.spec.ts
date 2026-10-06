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
  FORFAIT_CONFERENCE_CENTS,
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

describe("formation : nombre de sessions du même palier dans une commande", () => {
  const unJour = PALIERS_FORMATION.find((x) => x.id === "formation-generale-1j")!;
  const m = (r: ReturnType<typeof calculerCommission>) =>
    r.statut === "calculee" ? r.montantCents : null;

  it("par défaut une seule session : 500 € pour une journée au plein tarif", () => {
    expect(
      m(calculerCommission({ activite: "formation", palier: unJour.id, factureHtCents: 190_000 })),
    ).toBe(50_000);
  });
  it("trois sessions d'une journée au plein tarif : 500 € × 3 = 1 500 €", () => {
    const r = calculerCommission({
      activite: "formation",
      palier: unJour.id,
      quantite: 3,
      factureHtCents: 570_000,
    });
    expect(m(r)).toBe(150_000);
    expect(r.statut === "calculee" && r.prixPublicCents).toBe(570_000);
  });
  it("trois sessions avec 10 % de remise : 1 500 € × 0,9 = 1 350 €", () => {
    expect(
      m(
        calculerCommission({
          activite: "formation",
          palier: unJour.id,
          quantite: 3,
          factureHtCents: 513_000,
        }),
      ),
    ).toBe(135_000);
  });
  it("trois sessions vendues plus cher que le public : plafonné à 1 500 €", () => {
    expect(
      m(
        calculerCommission({
          activite: "formation",
          palier: unJour.id,
          quantite: 3,
          factureHtCents: 900_000,
        }),
      ),
    ).toBe(150_000);
  });
  it("deux demi-journées au plein tarif : 250 € × 2 = 500 €", () => {
    expect(
      m(
        calculerCommission({
          activite: "formation",
          palier: "formation-generale-4h",
          quantite: 2,
          factureHtCents: 240_000,
        }),
      ),
    ).toBe(50_000);
  });
  it("un nombre de sessions invalide (0, 2,5, négatif, 100) vaut 1", () => {
    for (const quantite of [0, 2.5, -1, 100]) {
      expect(
        m(
          calculerCommission({
            activite: "formation",
            palier: unJour.id,
            quantite,
            factureHtCents: 190_000,
          }),
        ),
      ).toBe(50_000);
    }
  });
});

describe("conférence : 500 € HT fixes par commande, sans prorata (décision du 06/10)", () => {
  const conf = (ht: number, extra: object = {}) =>
    calculerCommission({ activite: "conference", factureHtCents: ht, ...extra });
  const f = (o: Partial<FactureDeCommande>): FactureDeCommande => ({
    id: "F1",
    devisId: null,
    statut: "payee",
    avoirDeId: null,
    montantHtCents: 300_000,
    emiseAt: new Date("2026-10-01T10:00:00Z"),
    ...o,
  });

  it("le forfait vient de la source unique du site : 500 €", () => {
    expect(FORFAIT_CONFERENCE_CENTS).toBe(50_000);
  });
  it("conférence au plein tarif = 500 €", () => {
    expect(montant(conf(300_000))).toBe(50_000);
  });
  it("conférence remisée de 30 % = toujours 500 €", () => {
    expect(montant(conf(210_000))).toBe(50_000);
  });
  it("le nombre de sessions n'y change rien : un forfait par commande", () => {
    expect(montant(conf(300_000, { quantite: 3 }))).toBe(50_000);
  });
  it("facture de conférence typée formation, palier conférence choisi : 500 €, sans prorata", () => {
    const r = calculerCommission({
      activite: "formation",
      palier: "conference",
      quantite: 4,
      factureHtCents: 100_000,
    });
    expect(montant(r)).toBe(50_000);
    expect(r.statut === "calculee" && r.palier).toBe("conference");
  });
  it("commande remboursée en totalité (HT nul) : rien", () => {
    expect(montant(conf(0))).toBe(0);
  });
  it("2 conférences dans 2 commandes = 2 forfaits", () => {
    const commandes = commandesSoldees([
      f({ id: "A", devisId: "D1" }),
      f({ id: "B", devisId: "D2" }),
    ]);
    expect(commandes).toHaveLength(2);
    const total = commandes.reduce((s, c) => s + (montant(conf(c.totalHtCents)) ?? 0), 0);
    expect(total).toBe(100_000);
  });
  it("une commande de conférence avec acompte seul payé = rien (règle de la commande soldée)", () => {
    const acompte = f({ id: "ACO", devisId: "D1", montantHtCents: 100_000 });
    expect(commandesSoldees([acompte], new Map([["D1", 300_000]]))).toEqual([]);
  });
  it("acompte + solde payés : une seule commande, donc un seul forfait", () => {
    const c = commandesSoldees(
      [
        f({ id: "ACO", devisId: "D1", montantHtCents: 100_000 }),
        f({ id: "SOL", devisId: "D1", montantHtCents: 200_000 }),
      ],
      new Map([["D1", 300_000]]),
    );
    expect(c).toHaveLength(1);
    expect(montant(conf(c[0]!.totalHtCents))).toBe(50_000);
  });
  it("parrain 10 % sur la commission de conférence = 50 €", () => {
    expect(
      partParrainage({
        commissionFilleulCents: FORFAIT_CONFERENCE_CENTS,
        filleulSigneAt: new Date("2026-09-01T10:00:00Z"),
        commandeSigneeAt: new Date("2026-10-06T10:00:00Z"),
      }),
    ).toBe(5_000);
  });
  it("formation inchangée : 4 h 250 €, 1 jour 500 €, 2 jours 1 000 €, 3 sessions d'un jour 1 500 €", () => {
    const fm = (palier: string, ht: number, quantite = 1) =>
      montant(calculerCommission({ activite: "formation", palier, factureHtCents: ht, quantite }));
    expect(fm("formation-generale-4h", 120_000)).toBe(25_000);
    expect(fm("formation-generale-1j", 190_000)).toBe(50_000);
    expect(fm("formation-generale-2j", 360_000)).toBe(100_000);
    expect(fm("formation-generale-1j", 570_000, 3)).toBe(150_000);
  });
});
