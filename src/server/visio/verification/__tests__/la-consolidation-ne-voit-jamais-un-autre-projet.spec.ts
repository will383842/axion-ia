/**
 * ⛔ G10 — LA CONSOLIDATION NE VOIT JAMAIS UN AUTRE PROJET.
 *
 * P3 est appelée UNE FOIS PAR PÉRIMÈTRE, avec une entrée construite par le
 * CODE : les faits validés de ce périmètre et les faits du jour rangés dans
 * ce périmètre, rien d'autre. C'est le constructeur qui est testé, pas l'IA.
 * Et une relation rendue vers un fait hors périmètre est rejetée.
 *
 * Mutation qui rougit : dans `construireEntreeP3`, ne plus filtrer les faits
 * connus par `projetId` → l'énoncé du projet B apparaît dans l'entrée du
 * projet A. Contre-témoin : les faits du périmètre, eux, y sont. Angle mort :
 * un énoncé du jour qui NOMME l'autre projet dans son texte passe (c'est une
 * parole du client, pas une fuite du code).
 */

import { describe, expect, it } from "vitest";

import {
  construireEntreeP3,
  filtrerConsolidation,
  perimetresAConsolider,
  type FaitConnuPourPasse,
} from "../../consolider";
import type { FaitPourPasse } from "../../contexte";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const CONNUS: FaitConnuPourPasse[] = [
  {
    ref: "H001",
    projetId: A,
    type: "nb_participants",
    enonce: "Huit commerciaux à former (projet A)",
    constateLe: new Date("2026-09-01"),
  },
  {
    ref: "H002",
    projetId: B,
    type: "budget",
    enonce: "Budget AUDIT-COMPTA de 9 000 € (projet B)",
    constateLe: new Date("2026-09-01"),
  },
  {
    ref: "H003",
    projetId: null,
    type: "effectif",
    enonce: "35 salariés",
    constateLe: new Date("2026-09-01"),
  },
];
const DU_JOUR: FaitPourPasse[] = [
  {
    ref: "F01",
    type: "nb_participants",
    portee: "projet",
    projetRef: "J1",
    enonce: "Douze commerciaux",
    valeur: "12",
    locuteur: "client",
    confiance: "haute",
  },
  {
    ref: "F02",
    type: "budget",
    portee: "projet",
    projetRef: "J2",
    enonce: "Budget AUDIT-DU-JOUR 5 000 €",
    valeur: "5000",
    locuteur: "client",
    confiance: "haute",
  },
];

describe("la consolidation ne voit jamais un autre projet", () => {
  const perimetres = perimetresAConsolider({
    rattachement: {
      decisions: [
        {
          projet_evoque_ref: "J1",
          decision: "projet_existant",
          projet_connu_ref: "PRJ-1",
          titre_propose: null,
          activite_proposee: null,
          faits_refs: ["F01"],
          confiance: "haute",
          explication: "",
        },
        {
          projet_evoque_ref: "J2",
          decision: "projet_existant",
          projet_connu_ref: "PRJ-2",
          titre_propose: null,
          activite_proposee: null,
          faits_refs: ["F02"],
          confiance: "haute",
          explication: "",
        },
      ],
      projet_principal_ref: "J1",
      portees_a_corriger: [],
    },
    correspondancesProjets: new Map([
      ["PRJ-1", A],
      ["PRJ-2", B],
    ]),
    projets: [
      { id: A, titre: "Formation" },
      { id: B, titre: "Audit" },
    ],
    faitsConnus: CONNUS,
  });

  it("un appel par périmètre : l'entreprise, le projet A, le projet B", () => {
    expect(perimetres.map((p) => p.projetId)).toEqual([null, A, B]);
  });

  it("l'entrée du projet A ne contient rien du projet B", () => {
    const e = construireEntreeP3(perimetres[1]!, CONNUS, DU_JOUR);
    expect(e.entree).not.toMatch(/AUDIT-COMPTA|AUDIT-DU-JOUR|H002|F02/);
    expect(e.entree).toMatch(/H001/);
    expect(e.entree).toMatch(/F01/);
    expect([...e.refsEnvoyees].sort()).toEqual(["F01", "H001"]);
  });

  it("une relation vers un fait d'un autre projet est rejetée", () => {
    const e = construireEntreeP3(perimetres[1]!, CONNUS, DU_JOUR);
    const f = filtrerConsolidation(
      {
        relations: [
          {
            fait_du_jour_ref: "F01",
            relation: "change",
            fait_existant_ref: "H002",
            plus_recent_ref: null,
            explication: "",
          },
          {
            fait_du_jour_ref: "F01",
            relation: "change",
            fait_existant_ref: "H001",
            plus_recent_ref: "F01",
            explication: "",
          },
        ],
        ce_qui_a_change: [{ texte: "x", faits_refs: ["H002"] }],
      },
      e,
    );
    expect(f.horsPerimetre).toBe(1);
    expect(f.consolidation.relations.map((r) => r.fait_existant_ref)).toEqual(["H001"]);
    expect(f.consolidation.ce_qui_a_change).toEqual([]);
  });

  it("contre-témoin : l'entrée de l'entreprise ne voit que la portée entreprise", () => {
    const e = construireEntreeP3(perimetres[0]!, CONNUS, DU_JOUR);
    expect(e.entree).toMatch(/35 salariés/);
    expect(e.entree).not.toMatch(/Huit commerciaux|AUDIT/);
  });
});
