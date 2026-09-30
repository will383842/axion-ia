/**
 * Un troisième participant affiche la limite de Meet (PR 5, W1-05) : sur un
 * compte gratuit, Meet coupe à 60 min dès 3 participants. Le badge le dit dès
 * le 3ᵉ ; à deux, rien. Jamais de proposition d'offre payante (A0).
 */

import { describe, expect, it } from "vitest";

import * as capture from "../../../extensions/enregistreur-meet/lib/etats-capture.js";
import { base, MESURE_NORMALE } from "./outils";

const T = 1_000_000;

describe("un troisième participant affiche la limite Meet", () => {
  it("2 participants : pas de badge ; 3 : badge « limite_meet »", () => {
    const e = capture.demarrer(capture.etatInitial(), base(T), T).etat;
    expect(capture.tic(e, MESURE_NORMALE, T + 1000).etat.badges).not.toContain("limite_meet");
    expect(
      capture.tic(e, { ...MESURE_NORMALE, nbParticipants: 3 }, T + 1000).etat.badges,
    ).toContain("limite_meet");
  });
});
