import { describe, expect, it } from "vitest";

import { offreFictive } from "./offre-fixtures.spec-util";
import { lirePalierSuivant, totalHtLignesDevis } from "./palier-suivant";

const phase = (rang: number, pourcentage: number, libelle = `P${rang}`) => ({
  rang,
  libelle,
  pourcentage,
  declencheur: "signature" as const,
});

/** Offre à une formule « achat », lignes mono-taux, échéancier donné. */
function offreAchat(pourcentages: number[]) {
  const o = offreFictive();
  return {
    ...o,
    formulesProposees: ["achat" as const],
    automatisations: [],
    abonnement: undefined,
    achat: {
      ...o.achat!,
      lignes: [{ libelle: "L", quantite: 1, prixHtCents: 100005, tauxTvaBps: 2000 }],
      phases: pourcentages.map((p, i) => phase(i + 1, p)),
    },
  };
}

const lire = (pourcentages: number[], nb: number, total = 100005) =>
  lirePalierSuivant({
    offre: offreAchat(pourcentages),
    formuleRetenue: "achat",
    totalHtCents: total,
    nbFacturesEmises: nb,
  });

describe("lirePalierSuivant", () => {
  it("palier 1/3 d'un 30/30/40 : montant imprimé (floor), pas round", () => {
    const r = lire([30, 30, 40], 0);
    // 100005 × 30 % = 30001,5 → floor 30001 (le devis imprime 30001 ; round donnerait 30002)
    expect(r).toMatchObject({
      ok: true,
      palier: { rang: 1, pourcentage: 30, montantHtCents: 30001, estSolde: false, nbPaliers: 3 },
    });
  });

  it("le dernier palier est le solde et absorbe le reste : Σ paliers = total", () => {
    const montants = [0, 1, 2].map((n) => {
      const r = lire([30, 30, 40], n);
      if (!r.ok || r.palier === null) throw new Error("palier attendu");
      return r.palier;
    });
    expect(montants.map((p) => p.montantHtCents)).toEqual([30001, 30001, 40003]);
    expect(montants.reduce((s, p) => s + p.montantHtCents, 0)).toBe(100005);
    expect(montants.map((p) => p.estSolde)).toEqual([false, false, true]);
  });

  it("tout facturé → palier null", () => {
    expect(lire([50, 50], 2)).toEqual({ ok: true, palier: null });
    expect(lire([100], 1)).toEqual({ ok: true, palier: null });
  });

  it("un seul palier de 100 % = solde", () => {
    const r = lire([100], 0);
    expect(r).toMatchObject({ ok: true, palier: { estSolde: true, montantHtCents: 100005 } });
  });

  it("rangs désordonnés : lus dans l'ordre des rangs", () => {
    const o = offreAchat([40, 60]);
    o.achat.phases = [phase(2, 60, "Solde"), phase(1, 40, "Acompte")];
    const r = lirePalierSuivant({
      offre: o,
      formuleRetenue: "achat",
      totalHtCents: 1000,
      nbFacturesEmises: 0,
    });
    expect(r).toMatchObject({
      ok: true,
      palier: { rang: 1, libelle: "Acompte", pourcentage: 40, montantHtCents: 400 },
    });
  });

  it("refus : offre illisible, formule absente, formule non retenue", () => {
    expect(
      lirePalierSuivant({
        offre: { v: 2 },
        formuleRetenue: "achat",
        totalHtCents: 1,
        nbFacturesEmises: 0,
      }).ok,
    ).toBe(false);
    expect(
      lirePalierSuivant({
        offre: offreAchat([100]),
        formuleRetenue: null,
        totalHtCents: 1,
        nbFacturesEmises: 0,
      }).ok,
    ).toBe(false);
    expect(
      lirePalierSuivant({
        offre: offreAchat([100]),
        formuleRetenue: "abonnement",
        totalHtCents: 1,
        nbFacturesEmises: 0,
      }).ok,
    ).toBe(false);
  });
});

describe("totalHtLignesDevis", () => {
  it("Σ round(quantité × prix) — comme la facturation", () => {
    expect(
      totalHtLignesDevis([
        { designation: "a", quantite: 1.5, prixUnitaireHtCents: 333 }, // 499,5 → 500
        { designation: "b", quantite: 2, prixUnitaireHtCents: 100 },
      ]),
    ).toBe(700);
  });
  it("vide ou illisible → null", () => {
    expect(totalHtLignesDevis([])).toBeNull();
    expect(totalHtLignesDevis("x")).toBeNull();
  });
});
