/**
 * UNE DICTÉE N'A PAS D'ÉTAPE CONSENTEMENT : Williams dicte seul, après
 * l'appel. Aucun accord n'est cherché ni écrit, et le contrôle « piste client
 * muette » ne s'applique pas (il n'y a pas de piste client).
 */

import { describe, expect, it } from "vitest";

import { executerEtape } from "../etapes";
import { planDePrecontrole, precontroler } from "../precontroles";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";
import { precontrole, seg } from "./outils-pipeline";

const DICTEE = [
  seg({
    piste: "axion",
    debutMs: 0,
    finMs: 60_000,
    texte: "Compte rendu dicté : la cliente veut former douze commerciaux avant décembre.",
  }),
];

describe("une dictée n'a pas d'étape consentement", () => {
  it("aucun contrôle d'accord, pas « muette », aucune preuve écrite", async () => {
    expect(planDePrecontrole(precontrole({ nature: "dictee", segments: DICTEE }))).toMatchObject({
      controleAccord: false,
      muette: false,
      accords: [],
    });
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: "00000000-0000-4000-8000-0000000000f1",
      etape: "precontroler",
    });
    let preuves = 0;
    const deps = depsDeTest({
      depot,
      gestionnaires: { precontroler },
      donnees: {
        pourPrecontrole: async () => [precontrole({ nature: "dictee", segments: DICTEE })],
        ecrirePreuvesAccord: async () => {
          preuves += 1;
        },
        noterAuJournal: async () => undefined,
      },
    });
    expect(await executerEtape(deps, t.id)).toBe("reussie");
    expect(preuves).toBe(0);
    expect(depot.lignes.map((l) => l.etape)).toEqual(["precontroler", "extraire"]);
  });
});
