/**
 * ⛔ LES PAROLES APRÈS UN REFUS NE SONT PAS CONSERVÉES.
 *
 * Marquer « après refus » ne suffit pas : la PAROLE est effacée en base
 * (`texte` vidé), pas seulement cachée à l'IA. Le port réel l'écrit ainsi,
 * et la page ne peut plus la montrer.
 *
 * Mutation qui rougit : dans `depot-donnees.ts`, `marquerApresRefus` ne pose
 * que `apresRefus: true` → le texte chiffré reste. Contre-témoin : les
 * segments d'AVANT le refus ne sont pas touchés (seuls les ordres donnés).
 * Angle mort : une copie déjà envoyée à OpenAI avant le précontrôle — il
 * n'y en a pas (le précontrôle précède P1, et la transcription n'est pas
 * conservée chez OpenAI).
 */

import { describe, expect, it } from "vitest";

import { depotDonneesPrisma } from "../depot-donnees";
import { baseEspion } from "../../../../tests/outils/base-espion";

describe("les paroles après un refus ne sont pas conservées", () => {
  it("le texte des segments d'après le refus est vidé, pour ces seuls segments", async () => {
    const e = baseEspion();
    await depotDonneesPrisma(e.base).marquerApresRefus(e.base, "tr1", [7, 8]);
    expect(e.de("transcriptionSegment", "updateMany")).toEqual([
      {
        modele: "transcriptionSegment",
        methode: "updateMany",
        args: {
          where: { transcriptionId: "tr1", ordre: { in: [7, 8] } },
          data: { apresRefus: true, texte: "" },
        },
      },
    ]);
  });
});
