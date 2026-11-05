import { describe, expect, it } from "vitest";

import { montantsDevis } from "./montants-devis";
import { offreFictive } from "./offre-fixtures.spec-util";

const lignesActuelles = [{ libelle: "L", quantite: 1, prixHtCents: 777, tauxTvaBps: 2000 }];

describe("montantsDevis", () => {
  it("offre NULL : lignes et total inchangés", () => {
    const r = montantsDevis({ offre: null, lignes: lignesActuelles, totalHtCents: 777 });
    expect(r).toEqual({ lignes: lignesActuelles, totalHtCents: 777 });
  });
  it("une formule : partie ponctuelle", () => {
    const o = { ...offreFictive(), formulesProposees: ["achat" as const] };
    const r = montantsDevis({ offre: o, lignes: [], totalHtCents: 0 });
    expect(r.totalHtCents).toBe(120000);
    expect(r.lignes).toHaveLength(2);
  });
  it("deux formules : vide et 0 jusqu'au choix", () => {
    const r = montantsDevis({ offre: offreFictive(), lignes: lignesActuelles, totalHtCents: 777 });
    expect(r).toEqual({ lignes: [], totalHtCents: 0 });
  });
  it("deux formules, choix fait : la formule choisie", () => {
    const r = montantsDevis({
      offre: offreFictive(),
      lignes: [],
      totalHtCents: 0,
      choix: { formule: "abonnement", automatisationsRetenues: [] },
    });
    expect(r.totalHtCents).toBe(30000);
  });
});
