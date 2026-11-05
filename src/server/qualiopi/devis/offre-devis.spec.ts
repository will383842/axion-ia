import { describe, expect, it } from "vitest";

import { GARANTIE_JOURS_PAR_DEFAUT, offreDevisV1 } from "./offre-devis";
import { offreFictive } from "./offre-fixtures.spec-util";

const echec = (o: unknown) => offreDevisV1.safeParse(o).success === false;

describe("offreDevisV1", () => {
  it("accepte une offre valide à deux formules", () => {
    expect(offreDevisV1.safeParse(offreFictive()).success).toBe(true);
  });
  it("est strict : champ inconnu refusé", () => {
    expect(echec({ ...offreFictive(), extra: 1 })).toBe(true);
  });
  it("GARANTIE_JOURS_PAR_DEFAUT est une durée", () => {
    expect(GARANTIE_JOURS_PAR_DEFAUT).toBe(30);
  });
  it("B (abonnement) exige le bloc abonnement", () => {
    const { abonnement: _a, ...reste } = offreFictive();
    expect(echec({ ...reste, formulesProposees: ["abonnement"] })).toBe(true);
  });
  it("A (achat) exige le bloc achat avec règle de maintenance explicite", () => {
    const o = offreFictive();
    const sans = {
      ...o,
      achat: { ...o.achat, maintenance: { ...o.achat!.maintenance, regle: undefined } },
    };
    expect(echec(sans)).toBe(true);
  });
  it("client professionnel seulement", () => {
    expect(echec({ ...offreFictive(), client: "particulier" })).toBe(true);
  });
  it("somme des phases = 100", () => {
    const o = offreFictive();
    expect(
      echec({
        ...o,
        achat: {
          ...o.achat,
          phases: [{ rang: 1, libelle: "x", pourcentage: 90, declencheur: "signature" }],
        },
      }),
    ).toBe(true);
  });
  it("hébergement axion exige un mensuel", () => {
    const o = offreFictive();
    expect(echec({ ...o, achat: { ...o.achat, hebergement: "axion" } })).toBe(true);
    expect(
      offreDevisV1.safeParse({
        ...o,
        achat: { ...o.achat, hebergement: "axion", hebergementMensuelHtCents: 1500 },
      }).success,
    ).toBe(true);
  });
  it("montant négatif refusé", () => {
    const o = offreFictive();
    expect(
      echec({ ...o, achat: { ...o.achat, lignes: [{ ...o.achat!.lignes[0], prixHtCents: -1 }] } }),
    ).toBe(true);
  });
  it("périodes : mois distincts, 1 à 4", () => {
    const o = offreFictive();
    const periodes = [
      { mois: 1, remiseBps: 0 },
      { mois: 1, remiseBps: 100 },
    ];
    expect(echec({ ...o, abonnement: { ...o.abonnement, periodes } })).toBe(true);
    expect(echec({ ...o, abonnement: { ...o.abonnement, periodes: [] } })).toBe(true);
  });
  it("indemnité de sortie : aucune valeur par défaut", () => {
    const o = offreFictive();
    const { indemniteSortieTauxBps: _i, ...abo } = o.abonnement!;
    expect(echec({ ...o, abonnement: abo })).toBe(true);
  });
  it("modeIA incluse exige moisIAInclus>=1 et modeIAApres", () => {
    const o = offreFictive();
    const a = { ...o.automatisations[0], modeIA: "incluse" };
    expect(echec({ ...o, automatisations: [a] })).toBe(true);
    expect(
      offreDevisV1.safeParse({
        ...o,
        automatisations: [{ ...a, moisIAInclus: 3, modeIAApres: "client_direct" }],
      }).success,
    ).toBe(true);
  });
  it("dépendances invalides refusées (cycle)", () => {
    const o = offreFictive();
    const a = o.automatisations[0]!;
    const autos = [
      { ...a, code: "a", dependDe: ["b"] },
      { ...a, code: "b", dependDe: ["a"] },
    ];
    expect(echec({ ...o, automatisations: autos })).toBe(true);
  });
});
