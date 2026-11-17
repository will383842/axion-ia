/** Présence du lien « Modifier le brouillon » (écran /corriger) selon le devis. */
import { describe, expect, it } from "vitest";

import { peutCorrigerBrouillonClassique } from "../brouillon-classique-modifiable";

const ordinaire = {
  statut: "brouillon",
  offre: null,
  offreSha256: null,
  financementSuggere: null,
  montantOpcoEstimeCents: null,
};

describe("peutCorrigerBrouillonClassique", () => {
  it("brouillon classique ordinaire : lien présent", () => {
    expect(peutCorrigerBrouillonClassique(ordinaire)).toBe(true);
  });
  it("devis à formules : absent", () => {
    expect(
      peutCorrigerBrouillonClassique({
        ...ordinaire,
        offre: { v: 1 },
        offreSha256: "a".repeat(64),
      }),
    ).toBe(false);
  });
  it.each(["envoye", "accepte", "refuse", "expire", "transforme_convention"])(
    "statut « %s » : absent",
    (statut) => {
      expect(peutCorrigerBrouillonClassique({ ...ordinaire, statut })).toBe(false);
    },
  );
  it("règlement par un tiers seul : absent", () => {
    expect(peutCorrigerBrouillonClassique({ ...ordinaire, financementSuggere: "opco" })).toBe(
      false,
    );
  });
  it("estimation seule : absent", () => {
    expect(peutCorrigerBrouillonClassique({ ...ordinaire, montantOpcoEstimeCents: 50000 })).toBe(
      false,
    );
  });
});
