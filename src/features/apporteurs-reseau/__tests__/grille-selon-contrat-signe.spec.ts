import { describe, expect, it } from "vitest";

import {
  calculerCommission,
  calculerCommissionSelonGrille,
  grilleDeLaCommande,
  libellePalierFormation,
  PALIERS_FORMATION_LONGUE,
  PLAFOND_FORMATION_LONGUE_CENTS,
  type GrilleCommission,
} from "../regles";

// Décision du dirigeant (27/11, définitive) : chaque apporteur garde la grille de la version de
// contrat qu'il a SIGNÉE tant qu'il n'a pas signé l'avenant 2.8. Les annexes 1 des contrats 2.3, 2.4,
// 2.5 et 2.6 sont identiques (grille « version 2 ») ; la 2.8 porte la grille « version 3 ». La 2.7
// n'existe pas. Exception pour TOUS : formation de 3 jours ou plus = 1 000 € HT au plus, au prorata.

const DECLAREE = new Date("2026-10-20T10:00:00Z");
const COMMANDE = new Date("2026-12-10T10:00:00Z");
const sig = (version: unknown) => ({ version });

describe("quelle grille pour quelle commande", () => {
  it.each([
    ["2.3", "v2"],
    ["2.4", "v2"],
    ["2.5", "v2"],
    ["2.6", "v2"],
    ["2.8", "v3"],
  ] as const)("contrat signé en %s, sans avenant : grille %s", (version, grille) => {
    expect(
      grilleDeLaCommande({
        signature: sig(version),
        declareeAt: DECLAREE,
        commandeSigneeAt: COMMANDE,
        avenant28EffetAt: null,
      }),
    ).toBe(grille);
  });

  it.each([["2.7"], ["2.2"], ["2.1"], ["2"], ["2.9"], ["2.10"], [" 2.6"], [""], [2.6], [null]])(
    "version %j : inconnue (escalade, jamais une grille devinée)",
    (version) => {
      expect(
        grilleDeLaCommande({
          signature: sig(version),
          declareeAt: DECLAREE,
          commandeSigneeAt: COMMANDE,
          avenant28EffetAt: null,
        }),
      ).toBeNull();
    },
  );

  it("signature absente ou illisible : inconnue", () => {
    for (const signature of [null, undefined, "2.6", {}, []]) {
      expect(
        grilleDeLaCommande({
          signature,
          declareeAt: DECLAREE,
          commandeSigneeAt: COMMANDE,
          avenant28EffetAt: null,
        }),
      ).toBeNull();
    }
  });

  const EFFET = new Date("2026-12-01T10:00:00Z");

  it("avenant 2.8 en vigueur, entreprise déclarée et commande signée après : grille v3", () => {
    expect(
      grilleDeLaCommande({
        signature: sig("2.6"),
        declareeAt: new Date("2026-12-02T10:00:00Z"),
        commandeSigneeAt: new Date("2026-12-20T10:00:00Z"),
        avenant28EffetAt: EFFET,
      }),
    ).toBe("v3");
  });

  it("art. 13.5 : entreprise déclarée AVANT l'avenant, commande après : la grille signée reste (v2)", () => {
    expect(
      grilleDeLaCommande({
        signature: sig("2.6"),
        declareeAt: DECLAREE,
        commandeSigneeAt: new Date("2026-12-20T10:00:00Z"),
        avenant28EffetAt: EFFET,
      }),
    ).toBe("v2");
  });

  it("art. 4.1 : commande signée AVANT la date d'effet de l'avenant : grille signée (v2)", () => {
    expect(
      grilleDeLaCommande({
        signature: sig("2.6"),
        declareeAt: new Date("2026-12-02T10:00:00Z"),
        commandeSigneeAt: new Date("2026-11-30T10:00:00Z"),
        avenant28EffetAt: EFFET,
      }),
    ).toBe("v2");
  });

  it("avenant en vigueur mais version d'origine inconnue, déclaration avant : inconnue", () => {
    expect(
      grilleDeLaCommande({
        signature: sig("2.2"),
        declareeAt: DECLAREE,
        commandeSigneeAt: new Date("2026-12-20T10:00:00Z"),
        avenant28EffetAt: EFFET,
      }),
    ).toBeNull();
  });
});

const calc = (
  grille: GrilleCommission,
  e: Omit<Parameters<typeof calculerCommissionSelonGrille>[0], "grille">,
) => calculerCommissionSelonGrille({ ...e, grille });
const montant = (r: ReturnType<typeof calculerCommission>) =>
  r.statut === "calculee" ? r.montantCents : r.statut;

// Commandes signées APRÈS le 26/11/2026 : c'est là que l'écart se voyait.
const APRES = new Date("2026-12-10T10:00:00Z");

describe("signataire 2.6 (grille v2) contre signataire 2.8 (grille v3) : montants", () => {
  it("coaching 1 390 € HT : 417 € en v2, aucune en v3", () => {
    const e = { activite: "un_a_un" as const, factureHtCents: 139_000, signeeAt: APRES };
    expect(montant(calc("v2", e))).toBe(41_700);
    expect(calc("v3", e)).toEqual({ statut: "aucune" });
  });

  it("coaching 790 € HT : 237 € en v2", () => {
    expect(
      montant(calc("v2", { activite: "un_a_un", factureHtCents: 79_000, signeeAt: APRES })),
    ).toBe(23_700);
  });

  it("conférence 2 400 € HT signée après le 26/11 : 500 € en v2, aucune en v3", () => {
    const e = { activite: "conference" as const, factureHtCents: 240_000, signeeAt: APRES };
    expect(montant(calc("v2", e))).toBe(50_000);
    expect(calc("v3", e)).toEqual({ statut: "aucune" });
  });

  it("conférence v2 : 900 € HT → 500 € ; 400 € HT → 400 € (jamais plus que le HT) ; 3 conférences → 1 500 €", () => {
    expect(
      montant(calc("v2", { activite: "conference", factureHtCents: 90_000, signeeAt: APRES })),
    ).toBe(50_000);
    expect(
      montant(calc("v2", { activite: "conference", factureHtCents: 40_000, signeeAt: APRES })),
    ).toBe(40_000);
    expect(
      montant(
        calc("v2", {
          activite: "conference",
          factureHtCents: 600_000,
          quantite: 3,
          signeeAt: APRES,
        }),
      ),
    ).toBe(150_000);
  });

  it("conférence posée en palier sur une facture « formation » : même règle", () => {
    expect(
      montant(
        calc("v2", {
          activite: "formation",
          palier: "conference",
          factureHtCents: 240_000,
          signeeAt: APRES,
        }),
      ),
    ).toBe(50_000);
  });

  it("développement web 6 000 € HT : aucune en v2 (A1.5 de la 2.6), 900 € en v3", () => {
    const e = { activite: "site_web" as const, factureHtCents: 600_000, signeeAt: APRES };
    expect(calc("v2", e)).toEqual({ statut: "aucune" });
    expect(montant(calc("v3", e))).toBe(90_000);
  });

  it("audit et intégration : identiques (30 % et 15 %)", () => {
    for (const g of ["v2", "v3"] as const) {
      expect(montant(calc(g, { activite: "audit", factureHtCents: 290_000 }))).toBe(87_000);
      expect(montant(calc(g, { activite: "implementation", factureHtCents: 600_000 }))).toBe(
        90_000,
      );
    }
  });

  it("formation 1 jour : 500 € au prix public, 400 € vendue 1 520 € (remise 20 %), dans les deux grilles", () => {
    for (const g of ["v2", "v3"] as const) {
      expect(
        montant(
          calc(g, {
            activite: "formation",
            palier: "formation-generale-1j",
            factureHtCents: 190_000,
          }),
        ),
      ).toBe(50_000);
      expect(
        montant(
          calc(g, {
            activite: "formation",
            palier: "formation-generale-1j",
            factureHtCents: 152_000,
          }),
        ),
      ).toBe(40_000);
    }
  });

  it("formation 2 jours 3 600 € : 1 000 € dans les deux grilles", () => {
    for (const g of ["v2", "v3"] as const) {
      expect(
        montant(
          calc(g, {
            activite: "formation",
            palier: "formation-generale-2j",
            factureHtCents: 360_000,
          }),
        ),
      ).toBe(100_000);
    }
  });

  it("formation sans palier : à qualifier, jamais zéro", () => {
    for (const g of ["v2", "v3"] as const) {
      expect(calc(g, { activite: "formation", palier: null, factureHtCents: 190_000 })).toEqual({
        statut: "a_qualifier",
      });
    }
  });
});

describe("formation de 3 jours ou plus : plafond 1 000 € HT pour TOUS (décision du 27/11)", () => {
  it("trois familles, prix d'une journée 1 900 € / 1 900 € / 2 200 €, plafond 1 000 €", () => {
    expect(PLAFOND_FORMATION_LONGUE_CENTS).toBe(100_000);
    expect(PALIERS_FORMATION_LONGUE.map((p) => [p.id, p.prixJourCents])).toEqual([
      ["formation-generale-3j-plus", 190_000],
      ["formation-metier-3j-plus", 190_000],
      ["formation-secteur-3j-plus", 220_000],
    ]);
    expect(libellePalierFormation("formation-generale-3j-plus")).toBe(
      "Formation générale, 3 jours ou plus",
    );
    expect(libellePalierFormation("formation-generale-1j")).toBe("Formation générale, 1 jour");
    expect(libellePalierFormation("inconnu")).toBeNull();
  });

  const longue = (
    g: GrilleCommission,
    ht: number,
    journees: number,
    palier = "formation-generale-3j-plus",
  ) => calc(g, { activite: "formation", palier, factureHtCents: ht, quantite: journees });

  it("3 jours générale au prix de référence (5 700 €) : 1 000 € dans les deux grilles", () => {
    for (const g of ["v2", "v3"] as const) {
      expect(longue(g, 570_000, 3)).toEqual({
        statut: "calculee",
        montantCents: 100_000,
        palier: "formation-generale-3j-plus",
        prixPublicCents: 570_000,
      });
    }
  });

  it("5 jours générale 9 500 € : 1 000 € (et non 2 500 € comme l'annexe 2.6)", () => {
    expect(montant(longue("v2", 950_000, 5))).toBe(100_000);
    expect(montant(longue("v3", 950_000, 5))).toBe(100_000);
  });

  it("3 jours générale vendue 4 560 € (remise 20 %) : 800 €", () => {
    expect(montant(longue("v2", 456_000, 3))).toBe(80_000);
    expect(montant(longue("v3", 456_000, 3))).toBe(80_000);
  });

  it("vendue plus cher que la référence : 1 000 €, jamais plus", () => {
    expect(montant(longue("v2", 900_000, 3))).toBe(100_000);
  });

  it("3 jours secteur 6 600 € : 1 000 € ; 5 940 € (remise 10 %) : 900 €", () => {
    expect(montant(longue("v3", 660_000, 3, "formation-secteur-3j-plus"))).toBe(100_000);
    expect(montant(longue("v3", 594_000, 3, "formation-secteur-3j-plus"))).toBe(90_000);
  });

  it("moins de 3 journées sur ce palier : à qualifier (incohérent, un humain tranche)", () => {
    expect(longue("v2", 380_000, 2)).toEqual({ statut: "a_qualifier" });
    expect(
      calc("v3", {
        activite: "formation",
        palier: "formation-generale-3j-plus",
        factureHtCents: 380_000,
      }),
    ).toEqual({ statut: "a_qualifier" });
  });

  it("le calcul historique (grille v3) connaît aussi ce palier", () => {
    expect(
      montant(
        calculerCommission({
          activite: "formation",
          palier: "formation-metier-3j-plus",
          factureHtCents: 456_000,
          quantite: 3,
        }),
      ),
    ).toBe(80_000);
  });
});
