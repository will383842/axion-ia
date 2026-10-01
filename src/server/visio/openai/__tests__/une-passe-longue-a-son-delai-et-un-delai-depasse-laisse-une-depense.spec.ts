/**
 * ⛔ UNE PASSE LONGUE A SON DÉLAI, ET UN DÉLAI DÉPASSÉ LAISSE UNE DÉPENSE (V2, M6).
 *
 * P1 (`extraire`) a un effort `high` et jusqu'à 32 000 jetons de sortie (le
 * raisonnement compris), mais le client coupait TOUT appel à 120 s : un appel
 * de 2 h 50 dépassait à chaque essai pendant 72 h, puis échouait. Et un délai
 * dépassé n'inscrivait rien au registre des coûts, alors que la requête était
 * partie et a pu être facturée — or ce registre porte le plafond partagé.
 *
 * Désormais chaque passe a SON délai (P1 : 10 minutes), et un délai dépassé
 * inscrit l'estimation de l'appel, comme un appel annulé en vol.
 *
 * Mutations qui rougissent : ne pas transmettre `delaiMs` (1er cas) ; ne pas
 * inscrire l'estimation sur un délai dépassé (2e et 3e cas). Contre-témoin :
 * une erreur avant l'envoi (authentification) n'inscrit rien.
 */

import OpenAI from "openai";
import { describe, expect, it } from "vitest";

import { DELAI_PAR_PASSE_MS, ESTIMATION_PASSE_USD, ESTIMATION_TRANCHE_USD } from "../modeles";
import { executerPasse } from "../passe";
import { transcrireTranche } from "../transcrire-tranche";
import { z } from "zod";
import {
  fauxClient,
  fauxCout,
  reponseReussie,
} from "../../../../../tests/outils/faux-openai-visio";

const demande = (passe: "extraire" | "rediger") => ({
  passe,
  schema: z.object({ ok: z.boolean() }),
  nomSchema: "test_v1",
  instructions: "i",
  entree: "e",
  jobId: "j",
});

describe("une passe longue a son délai, et un délai dépassé laisse une dépense", () => {
  it("P1 part avec un délai de 10 minutes, les autres avec le leur", async () => {
    const f = fauxClient(undefined, { reponses: [reponseReussie({ ok: true })] });
    await executerPasse({ client: f.client, cout: fauxCout().port }, demande("extraire"));
    expect(DELAI_PAR_PASSE_MS.extraire).toBe(600_000);
    expect(f.demandesReponse[0]?.delaiMs).toBe(600_000);
  });

  it("un délai dépassé sur une passe inscrit son estimation et reste une erreur passagère", async () => {
    const f = fauxClient(undefined, { reponses: [new OpenAI.APIConnectionTimeoutError()] });
    const cout = fauxCout();
    await expect(
      executerPasse({ client: f.client, cout: cout.port }, demande("extraire")),
    ).rejects.toMatchObject({ classe: "passagere", code: "delai_depasse" });
    expect(cout.ecritures.map((e) => e.costUsd)).toEqual([ESTIMATION_PASSE_USD.extraire]);
  });

  it("un délai dépassé sur une tranche inscrit son estimation", async () => {
    const f = fauxClient(undefined, { transcriptions: [new OpenAI.APIConnectionTimeoutError()] });
    const cout = fauxCout();
    await expect(
      transcrireTranche(
        { client: f.client, cout: cout.port },
        {
          octets: Buffer.from("x"),
          dureeMs: 180_000,
          niveauFinMuet: true,
          decalageMs: 0,
          jobId: "j",
        },
      ),
    ).rejects.toMatchObject({ code: "delai_depasse" });
    expect(cout.ecritures.map((e) => e.costUsd)).toEqual([ESTIMATION_TRANCHE_USD]);
  });

  it("contre-témoin : une erreur d'authentification n'inscrit rien", async () => {
    const f = fauxClient(undefined, {
      reponses: [new OpenAI.AuthenticationError(401, { message: "non" }, "non", {})],
    });
    const cout = fauxCout();
    await expect(
      executerPasse({ client: f.client, cout: cout.port }, demande("rediger")),
    ).rejects.toMatchObject({ classe: "configuration" });
    expect(cout.ecritures).toEqual([]);
  });
});
