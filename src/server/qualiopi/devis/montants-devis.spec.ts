import { describe, expect, it } from "vitest";

import { computeTotauxFacture } from "../legal/tva";
import {
  choixCanoniqueDepuisOffre,
  FormuleNonProposeeError,
  montantsDevis,
  SelectionIncompleteError,
} from "./montants-devis";
import { sha256Choix } from "./offre-calculs";
import { offreFictive } from "./offre-fixtures.spec-util";

/** Un devis à la VRAIE forme (model Devis : lignes Json + montantTotalHtCents). */
const lignesActuelles = [
  { designation: "Audit", quantite: 2, prixUnitaireHtCents: 777, tauxTvaPercent: 20 },
  { designation: "Conseil", quantite: 1, prixUnitaireHtCents: 1000 },
];
const montantActuel = computeTotauxFacture(lignesActuelles, "assujetti").totalHtCents;

describe("montantsDevis", () => {
  it("offre NULL : égal au calcul actuel (computeTotauxFacture), lignes inchangées", () => {
    const r = montantsDevis({
      offre: null,
      lignes: lignesActuelles,
      montantTotalHtCents: montantActuel,
    });
    expect(r.lignes).toEqual(lignesActuelles);
    expect(r.montantTotalHtCents).toBe(montantActuel);
    expect(r.montantTotalHtCents).toBe(computeTotauxFacture(r.lignes, "assujetti").totalHtCents);
  });
  it("une formule : partie ponctuelle, lignes à la forme du devis", () => {
    const o = { ...offreFictive(), formulesProposees: ["achat" as const] };
    const r = montantsDevis({ offre: o, lignes: [], montantTotalHtCents: 0 });
    expect(r.montantTotalHtCents).toBe(120000);
    expect(r.lignes).toHaveLength(2);
    expect(r.lignes[0]).toEqual({
      designation: "Ligne A",
      quantite: 1,
      prixUnitaireHtCents: 100000,
      tauxTvaPercent: 20,
    });
    expect(computeTotauxFacture(r.lignes, "assujetti").totalHtCents).toBe(r.montantTotalHtCents);
  });
  it("deux formules : vide et 0 jusqu'au choix", () => {
    const r = montantsDevis({
      offre: offreFictive(),
      lignes: lignesActuelles,
      montantTotalHtCents: montantActuel,
    });
    expect(r).toEqual({ lignes: [], montantTotalHtCents: 0 });
  });
  it("deux formules, choix fait : la formule choisie", () => {
    const r = montantsDevis({
      offre: offreFictive(),
      lignes: [],
      montantTotalHtCents: 0,
      choix: { formule: "abonnement", automatisationsRetenues: [] },
    });
    expect(r.montantTotalHtCents).toBe(30000);
  });
  it("sélection incomplète : erreur typée, pas de repli silencieux", () => {
    const o = offreFictive();
    const a = o.automatisations[0]!;
    const offre = {
      ...o,
      automatisations: [
        { ...a, code: "a", dependDe: ["b"] },
        { ...a, code: "b", dependDe: [] },
      ],
    };
    const appel = () =>
      montantsDevis({
        offre,
        lignes: [],
        montantTotalHtCents: 0,
        choix: { formule: "achat", automatisationsRetenues: ["a"] },
      });
    expect(appel).toThrow(SelectionIncompleteError);
    try {
      appel();
    } catch (e) {
      expect((e as SelectionIncompleteError).manquantes).toEqual(["b"]);
    }
  });
  it("formule choisie non proposée : erreur typée (abonnement seul + choix achat)", () => {
    const o = { ...offreFictive(), formulesProposees: ["abonnement" as const] };
    expect(() =>
      montantsDevis({
        offre: o,
        lignes: [],
        montantTotalHtCents: 0,
        choix: { formule: "achat", automatisationsRetenues: [] },
      }),
    ).toThrow(FormuleNonProposeeError);
  });
  it("formule proposée mais bloc de prix absent : erreur typée", () => {
    const o = { ...offreFictive(), achat: undefined };
    expect(() =>
      montantsDevis({
        offre: o,
        lignes: [],
        montantTotalHtCents: 0,
        choix: { formule: "achat", automatisationsRetenues: [] },
      }),
    ).toThrow(FormuleNonProposeeError);
  });
});

describe("relecture du lot 1 — total borné et choix empreinté sur le facturé", () => {
  it("total au-delà de CENTS_MAX : refus, pas de dépassement silencieux de l'Int 32 bits", () => {
    const o = offreFictive();
    const gros = {
      ...o,
      formulesProposees: ["achat" as const],
      achat: {
        ...o.achat!,
        lignes: [{ libelle: "Gros", quantite: 1000, prixHtCents: 2_000_000_000, tauxTvaBps: 2000 }],
      },
    };
    expect(() => montantsDevis({ offre: gros, lignes: [], montantTotalHtCents: 0 })).toThrow(
      RangeError,
    );
  });
  const base = {
    devisNumero: "N-1",
    offreSha256: "x",
    formule: "achat" as const,
    maintenanceRetenue: false,
    periodiciteMois: null,
  };
  it("une automatisation OBLIGATOIRE est dans le choix empreinté même si la saisie l'omet", () => {
    const o = offreFictive();
    const offre = {
      ...o,
      automatisations: [{ ...o.automatisations[0]!, facultative: false }],
    };
    const c = choixCanoniqueDepuisOffre(offre, { ...base, automatisationsRetenues: [] });
    expect(c.automatisationsRetenues).toEqual(["auto1"]);
    const explicite = choixCanoniqueDepuisOffre(offre, {
      ...base,
      automatisationsRetenues: ["auto1"],
    });
    expect(sha256Choix(c)).toBe(sha256Choix(explicite));
  });
  it("même liste facturée, saisies brutes différentes (inconnue refusée) : sélection incomplète", () => {
    const o = offreFictive();
    expect(() =>
      choixCanoniqueDepuisOffre(o, { ...base, automatisationsRetenues: ["fantome"] }),
    ).toThrow(SelectionIncompleteError);
  });
});
