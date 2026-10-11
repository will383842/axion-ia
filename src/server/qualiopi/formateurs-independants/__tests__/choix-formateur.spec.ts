/**
 * Lots L11b, L11b-ux, L11h — cartes de choix du formateur (module pur).
 */

import { describe, expect, it } from "vitest";

import {
  choixRestants,
  deplacementCompris,
  eurosCourts,
  figerChoix,
  honorairesProposition,
  libelleProposer,
  ligneJour,
  nomCourt,
  proximite,
  raison,
  raisonGarde,
  trierCartes,
  type CarteFormateur,
} from "../choix-formateur";
import {
  NOMBRE_DEPARTEMENTS,
  departementDeCodePostal,
  regionDeDepartement,
} from "../departement-region";
import { MANQUES_MISSION } from "../garde-mission";
import { TARIF_JOURNEE_HT_CENTS } from "../lettre-mission-v2-calcul";

const carte = (p: Partial<CarteFormateur> & { trainerId: string }): CarteFormateur => ({
  nomCourt: p.trainerId,
  independant: true,
  departement: null,
  proximite: "meme_departement",
  refus: [],
  avertissements: [],
  ...p,
});

describe("département et région d'un code postal (repli sans la phase 7)", () => {
  it("lit le département, Corse et outre-mer compris", () => {
    expect(departementDeCodePostal("38000")).toBe("38");
    expect(departementDeCodePostal("01100")).toBe("01");
    expect(departementDeCodePostal("20000")).toBe("2A");
    expect(departementDeCodePostal("20200")).toBe("2B");
    expect(departementDeCodePostal("97400")).toBe("974");
    expect(departementDeCodePostal("3800")).toBeNull();
    expect(departementDeCodePostal(null)).toBeNull();
  });
  it("101 départements, chacun dans une région", () => {
    expect(NOMBRE_DEPARTEMENTS).toBe(101);
    expect(regionDeDepartement("38")).toBe("Auvergne-Rhône-Alpes");
    expect(regionDeDepartement("69")).toBe("Auvergne-Rhône-Alpes");
    expect(regionDeDepartement("2A")).toBe("Corse");
    expect(regionDeDepartement("975")).toBeNull();
  });
});

describe("proximité et forfait « compris »", () => {
  const lyon = { distanciel: false, codePostal: "69003" };
  it("département, puis région, puis ailleurs ; distanciel à part", () => {
    expect(proximite(lyon, "69100")).toBe("meme_departement");
    expect(proximite(lyon, "42000")).toBe("meme_region");
    expect(proximite(lyon, "75011")).toBe("ailleurs");
    expect(proximite(lyon, null)).toBe("inconnu");
    expect(proximite({ distanciel: true, codePostal: null }, "75011")).toBe("distanciel");
  });
  it("même département ou visio = 0 ; ailleurs, le forfait se saisit", () => {
    expect(deplacementCompris("meme_departement")).toBe(true);
    expect(deplacementCompris("distanciel")).toBe(true);
    expect(deplacementCompris("meme_region")).toBe(false);
    expect(deplacementCompris("inconnu")).toBe(false);
  });
});

describe("cartes : tri et raisons", () => {
  it("disponibles triés département → région → ailleurs ; grisés à part", () => {
    const { disponibles, indisponibles } = trierCartes([
      carte({ trainerId: "Paul", proximite: "ailleurs" }),
      carte({ trainerId: "Marie", proximite: "meme_departement" }),
      carte({ trainerId: "Luc", proximite: "meme_region" }),
      carte({
        trainerId: "Ana",
        proximite: "meme_departement",
        refus: [raisonGarde(MANQUES_MISSION.vigilance)],
      }),
    ]);
    expect(disponibles.map((c) => c.trainerId)).toEqual(["Marie", "Luc", "Paul"]);
    expect(indisponibles.map((c) => c.trainerId)).toEqual(["Ana"]);
  });
  it("chaque raison dit ce qui la lèverait", () => {
    expect(raisonGarde(MANQUES_MISSION.vigilance).levee).toMatch(/attestation URSSAF/);
    expect(raisonGarde(MANQUES_MISSION.contrat).levee).toMatch(/contrat-cadre/);
    expect(raisonGarde(MANQUES_MISSION.finCollaboration).levee).toBeNull();
    expect(raison("non_habilite", "x").levee).toMatch(/habilitations/);
    expect(raison("double_emploi", "x").levee).toMatch(/autre prestation/);
  });
  it("nom court, jamais le nom complet", () => {
    expect(nomCourt("Marie", "Dupont")).toBe("Marie D.");
    expect(nomCourt("", "dupont")).toBe("D.");
  });
  it("libellé du bouton", () => {
    expect(libelleProposer(["Marie D."])).toBe("Proposer à Marie D.");
    expect(libelleProposer(["Marie D.", "Paul R."])).toBe("Proposer à Marie D. (puis Paul R.)");
  });
});

describe("figer le choix (T3 : une carte grisée n'est jamais acceptée)", () => {
  const cartes = [
    carte({ trainerId: "a", proximite: "meme_departement" }),
    carte({ trainerId: "b", proximite: "ailleurs" }),
    carte({ trainerId: "c", independant: false, proximite: "ailleurs" }),
    carte({ trainerId: "g", refus: [raisonGarde(MANQUES_MISSION.vigilance)] }),
  ];
  it("fige 350 € HT et le forfait ; compris = 0 même si une valeur est saisie", () => {
    const r = figerChoix(
      [
        { trainerId: "a", rang: 1, forfaitDeplacementParJourHtCents: 9_999 },
        { trainerId: "b", rang: 2, forfaitDeplacementParJourHtCents: 8_000 },
        { trainerId: "c", rang: 3, forfaitDeplacementParJourHtCents: 5_000 },
      ],
      cartes,
    );
    expect(r).toEqual({
      ok: true,
      choix: [
        {
          trainerId: "a",
          rang: 1,
          tarifHtCents: TARIF_JOURNEE_HT_CENTS,
          forfaitDeplacementParJourHtCents: 0,
        },
        {
          trainerId: "b",
          rang: 2,
          tarifHtCents: TARIF_JOURNEE_HT_CENTS,
          forfaitDeplacementParJourHtCents: 8_000,
        },
        // Un salarié : ni tarif ni forfait ici (sa source reste SessionFormateur).
        { trainerId: "c", rang: 3, tarifHtCents: null, forfaitDeplacementParJourHtCents: null },
      ],
    });
  });
  it("refuse une carte grisée", () => {
    const r = figerChoix(
      [{ trainerId: "g", rang: 1, forfaitDeplacementParJourHtCents: 0 }],
      cartes,
    );
    expect(r.ok).toBe(false);
  });
  it("refuse un forfait hors département non saisi, négatif ou fractionnaire", () => {
    for (const f of [null, -1, 10.5, 1_000_000]) {
      expect(
        figerChoix([{ trainerId: "b", rang: 1, forfaitDeplacementParJourHtCents: f }], cartes).ok,
      ).toBe(false);
    }
  });
  it("rangs 1 à n sans trou, distincts, trois au plus", () => {
    expect(figerChoix([], cartes).ok).toBe(false);
    expect(
      figerChoix([{ trainerId: "a", rang: 2, forfaitDeplacementParJourHtCents: 0 }], cartes).ok,
    ).toBe(false);
    expect(
      figerChoix(
        [
          { trainerId: "a", rang: 1, forfaitDeplacementParJourHtCents: 0 },
          { trainerId: "a", rang: 2, forfaitDeplacementParJourHtCents: 0 },
        ],
        cartes,
      ).ok,
    ).toBe(false);
    expect(
      figerChoix(
        ["a", "b", "c", "a"].map((t, i) => ({
          trainerId: t,
          rang: i + 1,
          forfaitDeplacementParJourHtCents: 0,
        })),
        cartes,
      ).ok,
    ).toBe(false);
    expect(
      figerChoix([{ trainerId: "zz", rang: 1, forfaitDeplacementParJourHtCents: 0 }], cartes).ok,
    ).toBe(false);
  });
});

describe("rang suivant (T15) : jamais deux fois le même rang dans un tour", () => {
  const choisiLe = new Date("2026-10-11T08:00:00Z");
  const choix = [
    { trainerId: "a", rang: 1, sauteAt: null, choisiLe },
    { trainerId: "b", rang: 2, sauteAt: null, choisiLe },
    { trainerId: "c", rang: 3, sauteAt: new Date("2026-10-11T09:00:00Z"), choisiLe },
    // Ancien choix archivé (rang au-delà de 3) : jamais proposé.
    { trainerId: "d", rang: 4, sauteAt: new Date("2026-10-11T07:00:00Z"), choisiLe },
  ];
  it("saute les rangs déjà sollicités depuis le choix, et les rangs sautés", () => {
    expect(
      choixRestants(choix, [{ trainerId: "a", solliciteAt: new Date("2026-10-11T08:01:00Z") }]).map(
        (c) => c.trainerId,
      ),
    ).toEqual(["b"]);
  });
  it("une sollicitation d'avant le choix ne consomme pas le rang", () => {
    expect(
      choixRestants(choix, [{ trainerId: "a", solliciteAt: new Date("2026-10-01T08:00:00Z") }]).map(
        (c) => c.trainerId,
      ),
    ).toEqual(["a", "b"]);
  });
});

describe("honoraires de la proposition (même calcul que la lettre)", () => {
  const jour = (date: string, heureDebut = "09:00", heureFin = "17:00") => ({
    date,
    heureDebut,
    heureFin,
  });
  it("« 4 journées × 350 € HT = 1 400 € HT » et le forfait par journée", () => {
    const h = honorairesProposition({
      jours: ["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"].map((d) => jour(d)),
      tarifJourneeHtCents: 35_000,
      forfaitDeplacementParJourHtCents: 8_000,
      distanciel: false,
    });
    expect(h?.ligneHonoraires).toBe("4 journées × 350 € HT = 1 400 € HT");
    expect(h?.ligneDeplacement).toBe("4 × 80 € HT");
    expect(h?.totalHtCents).toBe(140_000 + 32_000);
  });
  it("demi-journée, et forfait « compris » à distance", () => {
    const h = honorairesProposition({
      jours: [jour("2026-11-04"), jour("2026-11-05", "09:00", "12:00")],
      tarifJourneeHtCents: 35_000,
      forfaitDeplacementParJourHtCents: 8_000,
      distanciel: true,
    });
    expect(h?.ligneHonoraires).toBe("1 journée × 350 € HT + 1 demi-journée × 175 € HT = 525 € HT");
    expect(h?.ligneDeplacement).toBe("compris");
    expect(h?.totalHtCents).toBe(52_500);
  });
  it("rien sans journée ou sans tarif figé", () => {
    expect(
      honorairesProposition({
        jours: [],
        tarifJourneeHtCents: 35_000,
        forfaitDeplacementParJourHtCents: 0,
        distanciel: false,
      }),
    ).toBeNull();
    expect(
      honorairesProposition({
        jours: [jour("2026-11-04")],
        tarifJourneeHtCents: null,
        forfaitDeplacementParJourHtCents: 0,
        distanciel: false,
      }),
    ).toBeNull();
  });
  it("une ligne par journée, matin et après-midi", () => {
    expect(ligneJour(jour("2026-11-04"))).toBe("mercredi 4 novembre · matin et après-midi");
    expect(ligneJour(jour("2026-11-04", "13:30", "17:00"))).toBe(
      "mercredi 4 novembre · après-midi",
    );
    expect(ligneJour(jour("2026-11-04", "09:00", "12:00"))).toBe("mercredi 4 novembre · matin");
    expect(eurosCourts(17_550)).toBe("175,50 €");
  });
});
