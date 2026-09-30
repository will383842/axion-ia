/**
 * UNE RÉPONSE DIARISÉE INVALIDE EST REFUSÉE PAR ZOD (ADR 0055 §1.2).
 *
 * Le SDK 4.104 ne type pas `diarized_json` : un seul transtypage dans
 * `client.ts`, et la réponse est REVALIDÉE par `ReponseDiarizee`. Une forme
 * inattendue (segments sans horodatage, sans locuteur) est une erreur
 * `sortie_invalide` — jamais une transcription vide prise pour bonne.
 */

import { describe, expect, it } from "vitest";

import { ReponseDiarizee, transcrireTranche } from "../transcrire-tranche";
import { fauxClient, fauxCout } from "../../../../../tests/outils/faux-openai-visio";

describe("une réponse diarisée invalide est refusée par Zod", () => {
  it.each([
    ["réponse texte seul (autre format)", { text: "bonjour" }],
    ["segment sans horodatage", { text: "x", segments: [{ speaker: "A", text: "x" }] }],
    ["segment sans locuteur", { text: "x", segments: [{ start: 0, end: 1, text: "x" }] }],
    ["chaîne brute", "bonjour"],
  ])("%s → sortie_invalide", async (_nom, brut) => {
    const f = fauxClient(undefined, { transcriptions: [brut] });
    await expect(
      transcrireTranche(
        { client: f.client, cout: fauxCout().port },
        {
          octets: Buffer.from("x"),
          dureeMs: 10_000,
          niveauFinMuet: true,
          decalageMs: 0,
          jobId: "j",
        },
      ),
    ).rejects.toMatchObject({ classe: "contenu", code: "sortie_invalide" });
  });

  it("contre-témoin : la forme documentée passe", () => {
    expect(
      ReponseDiarizee.safeParse({
        text: "a",
        segments: [
          {
            type: "transcript.text.segment",
            id: "seg_0",
            start: 0,
            end: 1.2,
            speaker: "A",
            text: "a",
          },
        ],
        usage: { type: "duration", seconds: 2 },
      }).success,
    ).toBe(true);
  });
});
