import { describe, expect, it } from "vitest";

import { TAUX_TVA_STANDARD } from "../legal/tva";
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

describe("offreDevisV1 — bornes (audit)", () => {
  const avecAbo = (patch: Record<string, unknown>) => {
    const o = offreFictive();
    return { ...o, abonnement: { ...o.abonnement, ...patch } };
  };
  it("remiseBps : maximum 10000", () => {
    const ok = avecAbo({ periodes: [{ mois: 1, remiseBps: 10000 }] });
    expect(offreDevisV1.safeParse(ok).success).toBe(true);
    expect(echec(avecAbo({ periodes: [{ mois: 1, remiseBps: 10001 }] }))).toBe(true);
  });
  it("indemniteSortieTauxBps : maximum 10000", () => {
    expect(echec(avecAbo({ indemniteSortieTauxBps: 10001 }))).toBe(true);
  });
  it("tauxTvaBps : jamais sous le taux standard, au plus 10000", () => {
    expect(echec(avecAbo({ tauxTvaBps: 0 }))).toBe(true);
    expect(echec(avecAbo({ tauxTvaBps: TAUX_TVA_STANDARD * 100 - 1 }))).toBe(true);
    expect(echec(avecAbo({ tauxTvaBps: 10001 }))).toBe(true);
    expect(offreDevisV1.safeParse(avecAbo({ tauxTvaBps: TAUX_TVA_STANDARD * 100 })).success).toBe(
      true,
    );
  });
  it("cents : borné à 2 000 000 000 (Int 32 bits)", () => {
    const o = offreFictive();
    const ligne = (p: number) => ({
      ...o,
      achat: { ...o.achat!, lignes: [{ ...o.achat!.lignes[0]!, prixHtCents: p }] },
    });
    expect(echec(ligne(2_000_000_001))).toBe(true);
    expect(offreDevisV1.safeParse(ligne(2_000_000_000)).success).toBe(true);
  });
  it("tauxTvaBps : multiple de 100 uniquement (TVA en entiers purs, pas de flottant)", () => {
    expect(echec(avecAbo({ tauxTvaBps: 2033 }))).toBe(true);
    expect(offreDevisV1.safeParse(avecAbo({ tauxTvaBps: 2100 })).success).toBe(true);
  });
  it("tauxTvaBps d'une ligne ou d'une automatisation : jamais 0", () => {
    const o = offreFictive();
    expect(
      echec({
        ...o,
        achat: { ...o.achat, lignes: [{ ...o.achat!.lignes[0], tauxTvaBps: 0 }] },
      }),
    ).toBe(true);
    expect(echec({ ...o, automatisations: [{ ...o.automatisations[0], tauxTvaBps: 0 }] })).toBe(
      true,
    );
  });
  it("pourcentage de phase : maximum 100 (borne conservée)", () => {
    const o = offreFictive();
    const p = { rang: 1, libelle: "x", pourcentage: 101, declencheur: "signature" };
    expect(echec({ ...o, achat: { ...o.achat, phases: [p] } })).toBe(true);
  });
  it("plusieurs phases + plusieurs taux de TVA : refusé dès le schéma", () => {
    const o = offreFictive();
    const deux = [
      { rang: 1, libelle: "a", pourcentage: 50, declencheur: "signature" },
      { rang: 2, libelle: "b", pourcentage: 50, declencheur: "livraison" },
    ];
    expect(echec({ ...o, achat: { ...o.achat, phases: deux } })).toBe(true);
    const mono = {
      ...o,
      automatisations: [{ ...o.automatisations[0], tauxTvaBps: 2000 }],
      achat: {
        ...o.achat,
        lignes: [{ ...o.achat!.lignes[0], tauxTvaBps: 2000 }],
        phases: deux,
      },
    };
    expect(offreDevisV1.safeParse(mono).success).toBe(true);
    const abo = offreFictive().abonnement!;
    expect(
      echec({
        ...o,
        abonnement: {
          ...abo,
          miseEnServiceLignes: [
            { libelle: "a", quantite: 1, prixHtCents: 1, tauxTvaBps: 2000 },
            { libelle: "b", quantite: 1, prixHtCents: 1, tauxTvaBps: 2500 },
          ],
          phases: deux,
        },
      }),
    ).toBe(true);
  });
  it("rangs de phases en double refusés", () => {
    const o = offreFictive();
    const dbl = [
      { rang: 1, libelle: "a", pourcentage: 50, declencheur: "signature" },
      { rang: 1, libelle: "b", pourcentage: 50, declencheur: "livraison" },
    ];
    const mono = {
      ...o,
      automatisations: [{ ...o.automatisations[0], tauxTvaBps: 2000 }],
      achat: { ...o.achat, lignes: [{ ...o.achat!.lignes[0] }], phases: dbl },
    };
    expect(echec(mono)).toBe(true);
  });
});
