/**
 * ⛔ G16 — L'ACCORD RETROUVÉ EST VÉRIFIÉ COMME UNE CITATION.
 *
 * La preuve d'accord écrite (`phrase_retrouvee_verifiee`) est la phrase
 * EXACTE d'un segment réel de la piste client, dans les 3 minutes qui suivent
 * l'annonce — jamais une phrase reformulée, jamais une phrase de Williams.
 *
 * Mutation qui rougit : dans `planDePrecontrole`, retirer le filtre
 * `accordVerifieCommeUneCitation` → une phrase inventée passerait comme
 * preuve. Contre-témoin : la phrase réelle du client est retenue et écrite.
 * Angle mort : un « oui » à autre chose dans la fenêtre serait pris pour un
 * accord — c'est pourquoi la preuve première reste le clic de Williams.
 */

import { describe, expect, it } from "vitest";

import { executerEtape } from "../etapes";
import { planDePrecontrole, precontroler } from "../precontroles";
import { accordVerifieCommeUneCitation } from "../verification/g16-accord";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";
import { conversation, precontrole, seg } from "./outils-pipeline";

const AVEC_ACCORD = [
  seg({
    piste: "axion",
    debutMs: 8_000,
    texte: "J'enregistre notre échange pour le compte rendu, d'accord ?",
  }),
  seg({ piste: "client", debutMs: 12_000, texte: "Oui, pas de souci, allez-y." }),
  ...conversation().map((s) => ({ ...s, debutMs: s.debutMs + 200_000, finMs: s.finMs + 200_000 })),
];

describe("l'accord retrouvé est vérifié comme une citation", () => {
  it("la phrase exacte du client est écrite comme preuve", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: "00000000-0000-4000-8000-0000000000f1",
      etape: "precontroler",
    });
    const preuves: string[] = [];
    const deps = depsDeTest({
      depot,
      gestionnaires: { precontroler },
      donnees: {
        pourPrecontrole: async () => [precontrole({ segments: AVEC_ACCORD })],
        ecrirePreuvesAccord: async (_tx, a) => {
          preuves.push(...a.accords.map((x) => `${x.reponseMs}:${x.texte}`));
        },
        noterAuJournal: async () => undefined,
      },
    });
    expect(await executerEtape(deps, t.id)).toBe("reussie");
    expect(preuves).toEqual(["12000:Oui, pas de souci, allez-y."]);
  });

  it("une phrase reformulée ou de Williams n'est pas une preuve", () => {
    expect(
      accordVerifieCommeUneCitation(
        { texte: "Oui, vous pouvez tout enregistrer.", debutMs: 12_000 },
        AVEC_ACCORD,
      ),
    ).toBe(false);
    expect(accordVerifieCommeUneCitation({ texte: "d'accord", debutMs: 8_000 }, AVEC_ACCORD)).toBe(
      false,
    );
  });

  it("contre-témoin : hors de la fenêtre de 3 minutes, rien n'est retenu", () => {
    const tard = AVEC_ACCORD.map((s) => (s.debutMs === 12_000 ? { ...s, debutMs: 400_000 } : s));
    const plan = planDePrecontrole(precontrole({ segments: tard, accordDeclareMs: 10_000 }));
    expect(plan.accords.map((a) => a.texte)).not.toContain("Oui, pas de souci, allez-y.");
  });
});
