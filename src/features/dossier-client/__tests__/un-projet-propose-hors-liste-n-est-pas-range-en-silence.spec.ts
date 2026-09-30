// @vitest-environment node
/**
 * ⛔ V1-03 (relecture) : P2 voit aussi les projets gagnés ou clos, l'écran
 * « Après l'appel » ne propose que les projets ouverts ou en pause. Une
 * proposition vers un projet ABSENT de la liste ne cochait rien, et l'action
 * rangeait alors le groupe dans le projet principal, en silence.
 *
 *   · une proposition hors de la liste affichée redevient `null` (« Nouveau
 *     projet » coché d'avance) ;
 *   · un groupe envoyé sans choix est REFUSÉ, jamais versé dans le principal.
 *
 * Mutations qui font rougir : ignorer la liste affichée dans
 * `grouperParProjetEvoque` ; déduire « principal » d'un choix vide.
 * Contre-témoin : une proposition vers un projet affiché est gardée ;
 * « principal » choisi explicitement reste permis.
 */

import { describe, expect, it } from "vitest";

import {
  ErreurChoixDeGroupe,
  evocationsDe,
  grouperParProjetEvoque,
  lireChoixDesGroupes,
} from "../projets-evoques";

const CLOS = "00000000-0000-4000-8000-00000000c105";
const OUVERT = "00000000-0000-4000-8000-0000000000e1";

const ETAT = {
  faits: [
    ["F01", "f1"],
    ["F02", "f2"],
  ] as const,
  declarations: [
    ["F01", "projet", "J1"],
    ["F02", "projet", "J2"],
  ] as const,
  projetsEvoques: [
    { ref: "J1", intitule: "Formation", activite: null },
    { ref: "J2", intitule: "Audit", activite: null },
  ],
  correspondances: {
    faits: [],
    contacts: [],
    projets: [
      ["P1", OUVERT],
      ["P2", CLOS],
    ] as const,
  },
  rattachement: {
    decisions: ["J1", "J2"].map((j, i) => ({
      projet_evoque_ref: j,
      decision: "projet_existant" as const,
      projet_connu_ref: i === 0 ? "P1" : "P2",
      titre_propose: null,
      activite_proposee: null,
      faits_refs: [],
      confiance: "haute" as const,
      explication: "",
    })),
    projet_principal_ref: "J1",
    portees_a_corriger: [],
  },
};

const faits = [
  { id: "f1", portee: "a_ranger" },
  { id: "f2", portee: "a_ranger" },
];

describe("⛔ un projet proposé hors de la liste n'est pas rangé en silence", () => {
  it("une proposition vers un projet non affiché redevient « nouveau projet »", () => {
    const g = grouperParProjetEvoque(faits, evocationsDe(ETAT as never), [{ id: OUVERT }]);
    expect(g.principal.proposition).toEqual({ mode: "existant", projetId: OUVERT });
    expect(g.autres[0]?.proposition).toBeNull();
  });

  it("un groupe sans choix est refusé, avec son nom", () => {
    const fd = new FormData();
    fd.append("groupe", "J2");
    fd.set("groupeIntitule_J2", "Audit");
    fd.append("groupeFait_J2", "f2");
    expect(() => lireChoixDesGroupes(fd)).toThrow(ErreurChoixDeGroupe);
    expect(() => lireChoixDesGroupes(fd)).toThrow(/Choisissez un projet pour « Audit »/);
  });

  it("contre-témoin : « principal » choisi explicitement reste permis", () => {
    const fd = new FormData();
    fd.append("groupe", "J2");
    fd.set("projet_J2", "principal");
    fd.append("groupeFait_J2", "f2");
    expect(lireChoixDesGroupes(fd)).toEqual([{ projet: { mode: "principal" }, faitIds: ["f2"] }]);
  });
});
