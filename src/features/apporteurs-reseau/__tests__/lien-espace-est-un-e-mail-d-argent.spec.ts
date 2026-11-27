// Lot 9 : le lien neuf qui suit une validation ou une opposition doit partir aussi à une fiche retirée ou résiliée.
import { describe, expect, it } from "vitest";

import { GABARITS_ARGENT } from "../retrait";

describe("apporteur-lien-espace", () => {
  it("entre dans GABARITS_ARGENT (c'est l'accès à SON argent, après une validation ou une opposition)", () => {
    expect(GABARITS_ARGENT.has("apporteur-lien-espace")).toBe(true);
  });
});
