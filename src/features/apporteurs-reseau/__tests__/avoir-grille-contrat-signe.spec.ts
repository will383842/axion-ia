import { describe, expect, it } from "vitest";

import { commissionPourPrixConserve } from "../ajustement";
import { cibleApresAvoir, cibleEtatFinal } from "../avoir-client";
import { calculerCommissionSelonGrille, type GrilleCommission } from "../regles";

// Relecture du 27/11 (points 1 et 3) : un avoir partiel recalcule la commission AVEC la grille du
// contrat signé de la ligne. Un signataire 2.6 sans avenant (v2) garde 500 € par journée sans plafond.

const ligne = (grille: GrilleCommission | null, jours: number, montantCents: number) => ({
  activite: "formation",
  palier: "formation-generale-3j-plus",
  prixPublicHtCents: 190_000 * jours,
  montantCents,
  grille,
});

describe("avoir partiel : la grille de la ligne porte le recalcul (point 1)", () => {
  it("#30 · v2 · 3 j 5 700 € puis net 4 560 € → 1 200 € (et non 800 €)", () => {
    const l = ligne("v2", 3, 150_000);
    expect(commissionPourPrixConserve(l, 456_000, 150_000)).toBe(120_000);
    expect(cibleApresAvoir(l, 456_000)).toBe(120_000);
  });

  it("#31 · v2 · 5 j 9 500 € puis net 8 550 € → 2 250 € (et non 900 €)", () => {
    const l = ligne("v2", 5, 250_000);
    expect(commissionPourPrixConserve(l, 855_000, 250_000)).toBe(225_000);
    expect(cibleApresAvoir(l, 855_000)).toBe(225_000);
  });

  it("remontée v2 (cibleEtatFinal) : l'argent revient → 1 500 € / 2 500 €, jamais plafonné à 1 000 €", () => {
    expect(cibleEtatFinal(ligne("v2", 3, 120_000), 570_000, 570_000)).toBe(150_000);
    expect(cibleEtatFinal(ligne("v2", 5, 225_000), 950_000, 950_000)).toBe(250_000);
  });

  it("v3 inchangée : 3 j net 4 560 € → 800 € ; 5 j net 8 550 € → 900 €", () => {
    expect(commissionPourPrixConserve(ligne("v3", 3, 100_000), 456_000, 100_000)).toBe(80_000);
    expect(commissionPourPrixConserve(ligne("v3", 5, 100_000), 855_000, 100_000)).toBe(90_000);
  });

  it("grille inconnue (null) : aucun montant, la ligne ne bouge pas (escalade)", () => {
    const l = ligne(null, 3, 150_000);
    expect(commissionPourPrixConserve(l, 456_000, 150_000)).toBeNull();
    expect(cibleApresAvoir(l, 456_000)).toBeNull();
    expect(cibleEtatFinal(l, 456_000, 570_000)).toBeNull();
  });
});

describe("arrondi au centime le plus proche, formations longues (point 3)", () => {
  const calc = (grille: GrilleCommission, ht: number) => {
    const r = calculerCommissionSelonGrille({
      activite: "formation",
      palier: "formation-generale-3j-plus",
      factureHtCents: ht,
      quantite: 3,
      grille,
    });
    return r.statut === "calculee" ? r.montantCents : null;
  };
  it("3 j à 4 999,99 € : 131 579 en v2, 87 719 en v3", () => {
    expect(calc("v2", 499_999)).toBe(131_579);
    expect(calc("v3", 499_999)).toBe(87_719);
  });
  it("3 j à 5 000,03 € : v3 87 719,82 → 87 720 (la troncature donnerait 87 719)", () => {
    expect(calc("v3", 500_003)).toBe(87_720);
  });
  it("3 j à 4 999,99 € : v2 131 578,68 → 131 579 (la troncature donnerait 131 578)", () => {
    expect(calc("v2", 499_999)).toBe(131_579);
  });
});
