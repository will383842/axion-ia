/**
 * G13 — UNE SORTIE TRONQUÉE N'ÉCRIT AUCUN FAIT.
 *
 * Une passe P1 dont la sortie est incomplète (`max_output_tokens`) lève une
 * erreur `contenu` AVANT toute écriture : l'étape échoue, un essai de plus,
 * puis échec définitif — aucune ligne n'a été écrite entre-temps.
 */

import { describe, expect, it } from "vitest";

import { executerEtape } from "../../etapes";
import { extraire } from "../../passes-ia";
import type { PortDonnees } from "../../port-donnees";
import { depsDeTest, FauxDepot } from "../../../../../tests/outils/faux-circuit-visio";
import { fauxClient } from "../../../../../tests/outils/faux-openai-visio";
import { DATE_ECHANGE, SEGMENTS } from "./outils";

describe("une sortie tronquée n'écrit aucun fait", () => {
  it("P1 incomplète : rien d'écrit, un essai de plus programmé, puis échec définitif", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: "00000000-0000-4000-8000-0000000000f1",
      etape: "extraire",
    });
    let comptesRendus = 0;
    const donnees: Partial<PortDonnees> = {
      pourExtraction: async () => ({
        rencontre: {
          id: "00000000-0000-4000-8000-0000000000f1",
          titre: "Diagnostic",
          source: "calendly",
          clientId: null,
          debut: DATE_ECHANGE,
          dureeMs: 600_000,
        },
        transcriptionId: "tr1",
        segments: SEGMENTS,
        pistes: { client: "OK", axion: "OK" },
        formulaire: [],
        contacts: [],
        projets: [],
        faitsClient: [],
        mode: "initial",
      }),
      creerCompteRendu: async () => {
        comptesRendus += 1;
        return "cr";
      },
    };
    const tronquee = {
      statut: "incomplete",
      raisonIncomplete: "max_output_tokens",
      modele: "gpt-6-sol",
      texte: '{"faits":[',
      refus: null,
      jetonsEntree: 1,
      jetonsEntreeEnCache: 0,
      jetonsSortie: 32000,
    };
    const f = fauxClient(undefined, { reponses: [tronquee, tronquee] });
    const deps = depsDeTest({ depot, donnees, client: f.client, gestionnaires: { extraire } });

    expect(await executerEtape(deps, t.id)).toBe("a_reessayer");
    expect(depot.ligne(t.id)).toMatchObject({
      statut: "a_faire",
      derniereErreur: "sortie_tronquee",
      echecs: 1,
    });
    depot.ligne(t.id).prochaineTentativeLe = null;
    expect(await executerEtape(deps, t.id)).toBe("echec_definitif");
    expect(comptesRendus).toBe(0);
    expect(depot.ecritures).toEqual([]);
  });
});
