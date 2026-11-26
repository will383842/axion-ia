/**
 * Annexe 1, A1.1 (grille v3) : la Journée IA donne 500 € par journée facturée, au prorata du
 * prix payé (art. 4.1 bis), arrondi au centime le plus proche ; reprise si remboursée.
 * Un acompte ne donne JAMAIS de commission (décision de Will du 25/11), pas même un prorata.
 */
import { describe, expect, it } from "vitest";

import { commissionPourPrixConserve } from "../ajustement";
import { cibleEtatFinal } from "../avoir-client";
import { commandesSoldees, type FactureDeCommande } from "../commandes";
import {
  calculerCommission,
  commissionJourneeIaCents,
  analyserLignesJourneeIa,
  calculerCommissionJourneeIa,
  type CalculCommission,
} from "../regles";

const montant = (r: CalculCommission) => (r.statut === "calculee" ? r.montantCents : null);
const ji = (factureHtCents: number, quantite?: number) =>
  commissionJourneeIaCents(factureHtCents, quantite);

const facture = (o: Partial<FactureDeCommande> & { id: string }): FactureDeCommande => ({
  devisId: "devis-1",
  statut: "payee",
  avoirDeId: null,
  montantHtCents: 149_000,
  emiseAt: new Date("2026-12-01T10:00:00Z"),
  ...o,
});

describe("Journée IA : 500 € par journée, au prorata du prix payé", () => {
  it("1 journée payée au prix de référence = 500 €", () => {
    expect(ji(149_000)).toBe(50_000);
  });
  it("2 journées payées = 1 000 €", () => {
    expect(ji(298_000, 2)).toBe(100_000);
  });
  it("jamais plus que le forfait : 1 journée payée plus cher reste à 500 €", () => {
    expect(ji(200_000)).toBe(50_000);
  });
  it("remise : 1 341 € HT donnent 450 €, 1 192 € HT donnent 400 €", () => {
    expect(ji(134_100)).toBe(45_000);
    expect(ji(119_200)).toBe(40_000);
  });
  it("arrondi au centime le plus proche (pas à l'inférieur)", () => {
    // 500 × 1 000 ÷ 1 490 = 335,57… € → 335,57 €
    expect(commissionJourneeIaCents(100_000)).toBe(33_557);
    // 500 × 1 489,99 ÷ 1 490 = 499,9966… € → 500,00 € (l'inférieur donnerait 499,99 €)
    expect(commissionJourneeIaCents(148_999)).toBe(50_000);
  });
  it("2 journées avec remise : prorata sur le prix de référence des 2 journées", () => {
    expect(ji(238_400, 2)).toBe(80_000);
  });
  it("offerte (0 €) ou négative : rien", () => {
    expect(ji(0)).toBe(0);
    expect(ji(-5_000)).toBe(0);
  });
  it("le coaching (un_a_un) ne donne rien", () => {
    expect(calculerCommission({ activite: "un_a_un", factureHtCents: 149_000 })).toEqual({
      statut: "aucune",
    });
  });
  it("sans le repère `devis.journee_ia`, une facture d'audit garde son taux", () => {
    expect(montant(calculerCommission({ activite: "audit", factureHtCents: 100_000 }))).toBe(
      30_000,
    );
  });
});

describe("Journée IA : avoir (base = net gardé après avoirs)", () => {
  it("avoir total : 0 €", () => {
    expect(ji(0)).toBe(0);
  });
  it("avoir partiel de 298 € sur 1 490 € : prorata sur le net gardé = 400 €", () => {
    expect(ji(149_000 - 29_800)).toBe(40_000);
  });
  it("commandesSoldees ne rend pas une commande entièrement remboursée", () => {
    const f = facture({ id: "f1" });
    const avoir = facture({ id: "a1", avoirDeId: "f1", montantHtCents: -149_000 });
    expect(commandesSoldees([f, avoir], new Map([["devis-1", 149_000]]))).toEqual([]);
  });
});

describe("Journée IA : un acompte ne donne jamais de commission", () => {
  it("acompte payé et gardé après annulation du devis : aucune commande soldée, donc 0 €", () => {
    const acompte = facture({ id: "acompte", montantHtCents: 44_700 });
    const soldeAnnule = facture({ id: "solde", statut: "annulee", montantHtCents: 104_300 });
    const soldees = commandesSoldees([acompte, soldeAnnule], new Map([["devis-1", 149_000]]));
    expect(soldees).toEqual([]);
    // Et, pour mémoire, la formule ne donnerait un prorata que si on la nourrissait à tort.
    expect(ji(44_700)).toBe(15_000);
  });
  it("acompte payé, solde jamais facturé : 0 €", () => {
    const acompte = facture({ id: "acompte", montantHtCents: 44_700 });
    expect(commandesSoldees([acompte], new Map([["devis-1", 149_000]]))).toEqual([]);
  });
  it("acompte + solde payés (100 %) : la commande est soldée", () => {
    const soldees = commandesSoldees(
      [
        facture({ id: "acompte", montantHtCents: 44_700 }),
        facture({ id: "solde", montantHtCents: 104_300 }),
      ],
      new Map([["devis-1", 149_000]]),
    );
    expect(soldees).toHaveLength(1);
    expect(soldees[0]!.totalHtCents).toBe(149_000);
  });
});

describe("Journée IA : lecture du devis, sinon « à qualifier » (jamais un montant silencieux)", () => {
  const calc = (
    activite: Parameters<typeof calculerCommissionJourneeIa>[0]["activite"],
    lignes: unknown,
    net: number,
  ) => calculerCommissionJourneeIa({ activite, lignes, netHtCents: net });
  const J = (quantite: number) => ({ designation: "Journée IA", quantite });

  it("seules des Journées IA : 500 € par journée au prorata", () => {
    expect(montant(calc("audit", [J(2)], 298_000))).toBe(100_000);
    expect(montant(calc("formation", [J(1)], 134_100))).toBe(45_000);
  });
  it("repère du catalogue ou libellé « Journée d'accompagnement IA » reconnus", () => {
    expect(
      analyserLignesJourneeIa([{ designation: "X", offreCode: "journee-ia", quantite: 2 }])
        .journees,
    ).toBe(2);
    expect(
      analyserLignesJourneeIa([{ designation: "Journée d'accompagnement IA", quantite: 2 }])
        .journees,
    ).toBe(2);
  });
  it("autres lignes (déplacement, mise en place) : à qualifier", () => {
    expect(calc("audit", [J(1), { designation: "Mise en place", quantite: 1 }], 649_000)).toEqual({
      statut: "a_qualifier",
    });
  });
  it("quantité non entière, demi-journée ou aucune journée lisible : à qualifier", () => {
    expect(calc("audit", [J(1.5)], 223_500)).toEqual({ statut: "a_qualifier" });
    expect(calc("audit", [{ designation: "Demi-journée IA", quantite: 1 }], 75_000)).toEqual({
      statut: "a_qualifier",
    });
    expect(calc("audit", [], 149_000)).toEqual({ statut: "a_qualifier" });
  });
  it("case cochée sur une facture de site web, de coaching, de conférence ou non classée : à qualifier", () => {
    for (const a of ["site_web", "un_a_un", "conference", null] as const)
      expect(calc(a, [J(1)], 149_000)).toEqual({ statut: "a_qualifier" });
  });
});

describe("Journée IA : reprise après avoir (ligne de commission existante)", () => {
  const ligne = { activite: "formation", palier: "journee-ia", prixPublicHtCents: 149_000 };
  it("avoir total : la commission tombe à 0 €", () => {
    expect(commissionPourPrixConserve(ligne, 0, 50_000)).toBe(0);
  });
  it("avoir partiel : prorata du prix gardé, arrondi au plus proche", () => {
    expect(commissionPourPrixConserve(ligne, 74_500, 50_000)).toBe(25_000);
    expect(commissionPourPrixConserve(ligne, 100_000, 50_000)).toBe(33_557);
  });
  it("le palier journee-ia l'emporte sur l'activité de la facture (conférence, coaching)", () => {
    for (const activite of ["conference", "un_a_un"])
      expect(commissionPourPrixConserve({ ...ligne, activite }, 74_500, 50_000)).toBe(25_000);
    expect(
      cibleEtatFinal({ ...ligne, activite: "un_a_un", montantCents: 50_000 }, 74_500, 149_000),
    ).toBe(25_000);
    expect(
      cibleEtatFinal({ ...ligne, activite: "conference", montantCents: 50_000 }, 74_500, 149_000),
    ).toBe(25_000);
  });
  it("2 journées, 1 remboursée : 500 €", () => {
    expect(
      commissionPourPrixConserve({ ...ligne, prixPublicHtCents: 298_000 }, 149_000, 100_000),
    ).toBe(50_000);
  });
});
