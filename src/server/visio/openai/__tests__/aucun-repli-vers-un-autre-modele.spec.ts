/**
 * ⛔ AUCUN REPLI VERS UN AUTRE MODÈLE (ADR 0055 §1.2-1.3 ; G13).
 *
 * Une sortie refusée, tronquée ou hors schéma est une ERREUR de classe
 * `contenu` — jamais une raison d'essayer silencieusement un autre modèle.
 * Chaque appel demande EXACTEMENT la constante de `modeles.ts`, et les
 * modèles ne sont jamais lus dans l'environnement.
 *
 * Mutation qui rougit : dans `passe.ts`, rattraper un refus et rappeler avec
 * un autre `modele` → deux demandes, dont une hors constante. Contre-témoin :
 * `MODELES_VISIO` ne contient que les deux modèles décidés. Angle mort : le
 * modèle réellement servi est celui qu'OpenAI rend (`response.model`) ; il
 * est écrit dans `CompteRendu.modele`, pas contrôlé ici.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { MODELE_REDACTION, MODELE_TRANSCRIPTION, MODELES_VISIO } from "../modeles";
import { executerPasse } from "../passe";
import { transcrireTranche } from "../transcrire-tranche";
import { fauxClient, fauxCout } from "../../../../../tests/outils/faux-openai-visio";

describe("aucun repli vers un autre modèle", () => {
  it("un refus, une troncature, un JSON illisible : une seule demande, au modèle décidé", async () => {
    for (const reponse of [
      {
        statut: "completed",
        raisonIncomplete: null,
        modele: MODELE_REDACTION,
        texte: null,
        refus: "non",
        jetonsEntree: 1,
        jetonsEntreeEnCache: 0,
        jetonsSortie: 1,
      },
      {
        statut: "incomplete",
        raisonIncomplete: "max_output_tokens",
        modele: MODELE_REDACTION,
        texte: "{",
        refus: null,
        jetonsEntree: 1,
        jetonsEntreeEnCache: 0,
        jetonsSortie: 1,
      },
      {
        statut: "completed",
        raisonIncomplete: null,
        modele: MODELE_REDACTION,
        texte: "pas du json",
        refus: null,
        jetonsEntree: 1,
        jetonsEntreeEnCache: 0,
        jetonsSortie: 1,
      },
    ]) {
      const f = fauxClient(undefined, { reponses: [reponse] });
      await expect(
        executerPasse(
          { client: f.client, cout: fauxCout().port },
          {
            passe: "rediger",
            schema: z.object({}),
            nomSchema: "t",
            instructions: "i",
            entree: "e",
            jobId: "j",
          },
        ),
      ).rejects.toMatchObject({ classe: "contenu" });
      expect(f.demandesReponse.map((d) => d.modele)).toEqual([MODELE_REDACTION]);
    }
  });

  it("la transcription demande toujours le modèle décidé", async () => {
    const f = fauxClient(undefined, { transcriptions: [{ text: "", segments: [] }] });
    await transcrireTranche(
      { client: f.client, cout: fauxCout().port },
      { octets: Buffer.from("x"), dureeMs: 10_000, niveauFinMuet: true, decalageMs: 0, jobId: "j" },
    );
    expect(f.demandesTranscription.map((d) => d.modele)).toEqual([MODELE_TRANSCRIPTION]);
  });

  it("contre-témoin : deux modèles, et aucun lu dans l'environnement", () => {
    expect([...MODELES_VISIO]).toEqual(["gpt-4o-transcribe-diarize", "gpt-6-sol"]);
    const code = readFileSync(path.resolve(__dirname, "../modeles.ts"), "utf8");
    expect(code).not.toMatch(/process\.env/);
  });
});
