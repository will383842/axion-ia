/**
 * ⛔ G0 — UNE PISTE CLIENT MUETTE N'APPELLE JAMAIS OPENAI.
 *
 * Moins de 40 mots, ou moins de 3 % du temps de parole côté client (son de
 * l'onglet non capté, client absent) : AUCUNE passe de rédaction n'est
 * appelée — une facture pour rien, et des « faits » tirés du seul monologue
 * de Williams. L'étape s'arrête (`piste_muette`), une note manuelle est
 * proposée, et `extraire` n'est jamais programmée.
 *
 * Mutation qui rougit : dans `precontroler`, ignorer `plan.muette` → la suite
 * `extraire` est programmée. Contre-témoin : une conversation normale passe à
 * l'extraction. Angle mort : un client qui parle très peu mais dit
 * l'essentiel (40 mots) passe — c'est voulu.
 */

import { describe, expect, it } from "vitest";

import { executerEtape } from "../etapes";
import { extraire } from "../passes-ia";
import { planDePrecontrole, precontroler } from "../precontroles";
import { pisteClientMuette } from "../verification/g00-precontroles";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";
import { clientInterdit } from "../../../../tests/outils/faux-openai-visio";
import { conversation, precontrole, seg } from "./outils-pipeline";

const MUETTE = [
  ...conversation().filter((s) => s.piste === "axion"),
  seg({ piste: "client", debutMs: 30_000, texte: "Oui." }),
];

describe("une piste client muette n'appelle jamais OpenAI", () => {
  it("précontrôle : arrêt piste_muette, aucune extraction programmée, aucun appel", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: "00000000-0000-4000-8000-0000000000f1",
      etape: "precontroler",
    });
    const client = clientInterdit();
    const deps = depsDeTest({
      depot,
      client,
      gestionnaires: { precontroler, extraire },
      donnees: { pourPrecontrole: async () => [precontrole({ segments: MUETTE })] },
    });
    expect(await executerEtape(deps, t.id)).toBe("echec_definitif");
    expect(depot.ligne(t.id)).toMatchObject({
      statut: "echec_definitif",
      derniereErreur: "piste_muette",
    });
    expect(depot.lignes.map((l) => l.etape)).toEqual(["precontroler"]);
    expect(client.appels).toBe(0);
  });

  it("temps de parole client sous 3 % → muette", () => {
    const peu = [
      seg({
        piste: "client",
        debutMs: 0,
        finMs: 5_000,
        texte: Array.from({ length: 50 }, () => "mot").join(" "),
      }),
    ];
    expect(pisteClientMuette(peu, 3_600_000)).toBe(true);
  });

  it("contre-témoin : une vraie conversation passe à l'extraction", () => {
    expect(planDePrecontrole(precontrole()).muette).toBe(false);
  });
});
