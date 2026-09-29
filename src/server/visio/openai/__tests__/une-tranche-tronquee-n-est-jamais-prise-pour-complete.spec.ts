/**
 * ⛔ UNE TRANCHE TRONQUÉE N'EST JAMAIS PRISE POUR COMPLÈTE (ADR 0055 §1.2).
 *
 * `gpt-4o-transcribe-diarize` rend au plus 2 000 jetons de sortie : sur une
 * tranche dense, la fin peut manquer SANS erreur. Si le dernier segment finit
 * à plus de 20 s de la fin de la tranche ET que la piste n'était pas muette à
 * la fin (mesure de l'extension), la tranche passe en échec `sortie_tronquee`
 * (classe `contenu`) — jamais transcrite à moitié.
 *
 * Mutation qui rougit : retirer le contrôle `trancheTronquee` de
 * `transcrire-tranche.ts`. Contre-témoin : une fin muette (silence réel)
 * n'est pas une troncature. Angle mort : une troncature au MILIEU d'une
 * tranche (segments manquants avant la fin) n'est pas détectée — seul l'essai
 * de fumée sur audio réel la mesure.
 */

import { describe, expect, it } from "vitest";

import { transcrireTranche, trancheTronquee } from "../transcrire-tranche";
import { fauxClient, fauxCout } from "../../../../../tests/outils/faux-openai-visio";

const coupe = {
  text: "…",
  segments: [{ start: 0, end: 95, speaker: "A", text: "début seulement" }],
};

describe("une tranche tronquée n'est jamais prise pour complète", () => {
  it("fin à 95 s sur 180 s, piste parlante à la fin : échec sortie_tronquee", async () => {
    const f = fauxClient(undefined, { transcriptions: [coupe] });
    await expect(
      transcrireTranche(
        { client: f.client, cout: fauxCout().port },
        {
          octets: Buffer.from("x"),
          dureeMs: 180_000,
          niveauFinMuet: false,
          decalageMs: 0,
          jobId: "j",
        },
      ),
    ).rejects.toMatchObject({ classe: "contenu", code: "sortie_tronquee" });
  });

  it("niveau de fin inconnu : prudence, c'est une troncature", () => {
    expect(trancheTronquee(coupe.segments, 180_000, null)).toBe(true);
  });

  it("contre-témoin : une fin muette n'est pas une troncature ; 165 s sur 180 s non plus", async () => {
    expect(trancheTronquee(coupe.segments, 180_000, true)).toBe(false);
    expect(trancheTronquee([{ end: 165 }], 180_000, false)).toBe(false);
    const f = fauxClient(undefined, { transcriptions: [coupe] });
    const segs = await transcrireTranche(
      { client: f.client, cout: fauxCout().port },
      {
        octets: Buffer.from("x"),
        dureeMs: 180_000,
        niveauFinMuet: true,
        decalageMs: 360_000,
        jobId: "j",
      },
    );
    expect(segs[0]).toMatchObject({ debutMs: 360_000, finMs: 455_000, locuteurBrut: "A" });
  });
});
