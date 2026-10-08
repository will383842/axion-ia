// « Vos déclarations » (relecture de a1, 08/10) : une commission « à qualifier » dont le produit est
// hors grille (annexe 1, A1.7) est signalée à l'apporteur.
import { describe, expect, it } from "vitest";

import { PALIER_HORS_GRILLE } from "../hors-grille";
import { horsGrilleEnCours, REPERE_HORS_GRILLE } from "../prestation-presentation";

describe("horsGrilleEnCours", () => {
  it("le repère recopié est celui du module « hors grille »", () => {
    expect(REPERE_HORS_GRILLE).toBe(PALIER_HORS_GRILLE);
  });

  it("à qualifier + repère hors grille : signalé", () => {
    expect(horsGrilleEnCours([{ statut: "a_qualifier", palier: REPERE_HORS_GRILLE }])).toBe(true);
  });

  it.each([
    ["à qualifier, palier simplement à choisir", { statut: "a_qualifier", palier: null }],
    ["qualifiée (due)", { statut: "due", palier: REPERE_HORS_GRILLE }],
    ["formation 1 jour", { statut: "due", palier: "formation-generale-1j" }],
  ])("%s : pas signalé", (_c, commission) => {
    expect(horsGrilleEnCours([commission])).toBe(false);
  });
});
