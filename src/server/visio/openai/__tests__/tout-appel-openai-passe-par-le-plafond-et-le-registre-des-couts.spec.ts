/**
 * ⛔ TOUT APPEL OPENAI PASSE PAR LE PLAFOND ET LE REGISTRE DES COÛTS (ADR 0055 §1.4).
 *
 * Pour la transcription d'une tranche comme pour une passe de rédaction :
 * `verifierPlafond` AVANT l'appel, `enregistrer` APRÈS — et même quand la
 * réponse est ensuite refusée (on a été facturé). Le `jobId` porte
 * `visio-<etape>-<rencontreId>-<n>`.
 *
 * Mutation qui rougit : retirer `avantAppel` (ou `apresAppel`) de
 * `transcrire-tranche.ts` ou de `passe.ts` → l'ordre « plafond, appel,
 * registre » est rompu. Contre-témoin : un plafond atteint empêche l'appel.
 * Angle mort : le vrai `cost-tracker` (base) est prouvé par content-gen ; ici
 * c'est le PORT qui est observé.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { idTacheVisio } from "../cout";
import { executerPasse } from "../passe";
import { transcrireTranche } from "../transcrire-tranche";
import {
  fauxClient,
  fauxCout,
  reponseReussie,
} from "../../../../../tests/outils/faux-openai-visio";

const TRANSCRIPTION = {
  text: "bonjour",
  segments: [{ start: 0.5, end: 175, speaker: "A", text: "bonjour" }],
  usage: { type: "tokens", input_tokens: 7000, output_tokens: 300 },
};

describe("tout appel OpenAI passe par le plafond et le registre des coûts", () => {
  it("transcription : plafond, appel, registre — dans cet ordre", async () => {
    const journal = { evenements: [] as string[] };
    const cout = fauxCout(journal);
    const { client } = fauxClient(journal, { transcriptions: [TRANSCRIPTION] });
    await transcrireTranche(
      { client, cout: cout.port },
      {
        octets: Buffer.from("x"),
        dureeMs: 180_000,
        niveauFinMuet: false,
        decalageMs: 0,
        jobId: "visio-transcrire-r-1-client-0",
      },
    );
    expect(journal.evenements).toEqual(["plafond", "appel", "registre"]);
    expect(cout.verifications).toEqual([0.03]);
    expect(cout.ecritures[0]).toMatchObject({
      provider: "openai",
      model: "gpt-4o-transcribe-diarize",
      tokensInput: 7000,
      tokensOutput: 300,
    });
    expect(cout.ecritures[0]!.costUsd).toBeGreaterThan(0);
  });

  it("passe : plafond, appel, registre — même si la sortie est refusée ensuite", async () => {
    const journal = { evenements: [] as string[] };
    const cout = fauxCout(journal);
    const { client } = fauxClient(journal, { reponses: [reponseReussie({ faux: true })] });
    await expect(
      executerPasse(
        { client, cout: cout.port },
        {
          passe: "extraire",
          schema: z.object({ attendu: z.string() }),
          nomSchema: "t",
          instructions: "i",
          entree: "e",
          jobId: idTacheVisio("extraire", "r", 1),
        },
      ),
    ).rejects.toMatchObject({ code: "sortie_invalide" });
    expect(journal.evenements).toEqual(["plafond", "appel", "registre"]);
    expect(cout.verifications).toEqual([0.5]);
    expect(cout.ecritures[0]!.jobId).toBe("visio-extraire-r-1");
  });

  it("contre-témoin : plafond atteint, AUCUN appel n'est émis", async () => {
    const journal = { evenements: [] as string[] };
    const cout = fauxCout(journal, { plafondAtteint: true });
    const { client, demandesReponse } = fauxClient(journal, { reponses: [reponseReussie({})] });
    await expect(
      executerPasse(
        { client, cout: cout.port },
        {
          passe: "rediger",
          schema: z.object({}),
          nomSchema: "t",
          instructions: "i",
          entree: "e",
          jobId: "j",
        },
      ),
    ).rejects.toBeTruthy();
    expect(demandesReponse).toHaveLength(0);
    expect(journal.evenements).toEqual(["plafond"]);
  });
});
