/**
 * Lot R6 : la taille d'audience envoyée aux prompts ne vise jamais ETI ni grandes entreprises.
 */
import { describe, it, expect } from "vitest";
import { taillePourPrompt } from "../positionnement";

describe("taillePourPrompt", () => {
  it("ramène ETI et grande entreprise à PME", () => {
    expect(taillePourPrompt("ETI")).toBe("PME");
    expect(taillePourPrompt("GRANDE_ENTREPRISE")).toBe("PME");
  });
  it("garde TPE et PME", () => {
    expect(taillePourPrompt("TPE")).toBe("TPE");
    expect(taillePourPrompt("PME")).toBe("PME");
  });
  it("prend la valeur par défaut quand rien n'est donné", () => {
    expect(taillePourPrompt(undefined)).toBe("PME");
    expect(taillePourPrompt(undefined, "entreprise")).toBe("entreprise");
  });
});
