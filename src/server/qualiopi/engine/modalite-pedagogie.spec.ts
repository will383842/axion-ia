/**
 * Tests — modalite-pedagogie.ts (règles pédagogiques par modalité).
 * Tests purs, aucune I/O.
 */

import { describe, it, expect } from "vitest";
import {
  normaliserModalite,
  libelleModalite,
  reglesModalitePourPrompt,
  rappelAnimationModalite,
} from "./modalite-pedagogie";

describe("modalite-pedagogie", () => {
  it("normalise les variantes vers les 3 modalités canoniques", () => {
    expect(normaliserModalite("presentiel")).toBe("presentiel");
    expect(normaliserModalite("distanciel")).toBe("distanciel");
    expect(normaliserModalite("FOAD visio")).toBe("distanciel");
    expect(normaliserModalite("hybride")).toBe("hybride");
    expect(normaliserModalite("mixte")).toBe("hybride");
    expect(normaliserModalite(null)).toBe("presentiel");
    expect(normaliserModalite(undefined)).toBe("presentiel");
  });

  it("libelle chaque modalité", () => {
    expect(libelleModalite("distanciel")).toContain("distance");
    expect(libelleModalite("hybride")).toContain("Hybride");
    expect(libelleModalite("presentiel")).toContain("présentiel");
  });

  it("injecte des règles distanciel spécifiques (pause écran, breakout)", () => {
    const regles = reglesModalitePourPrompt("distanciel");
    expect(regles.toLowerCase()).toContain("pause écran");
    expect(regles.toLowerCase()).toContain("breakout");
  });

  it("hybride combine présentiel et distanciel", () => {
    const regles = reglesModalitePourPrompt("hybride");
    expect(regles.toLowerCase()).toContain("présentiel");
    expect(regles.toLowerCase()).toContain("distanciel");
  });

  it("rappel d'animation adapté à la modalité", () => {
    expect(rappelAnimationModalite("distanciel").toLowerCase()).toContain("caméra");
    expect(rappelAnimationModalite("presentiel").toLowerCase()).toContain("binômes");
  });
});
