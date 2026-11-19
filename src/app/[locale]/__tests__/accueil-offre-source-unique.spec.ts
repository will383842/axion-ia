// L'accueil lit l'offre dans `src/content/offre.ts` : le rendu reste EXACTEMENT celui d'avant.
// Voir `src/content/__tests__/offre-source-unique.spec.ts` pour la source et le balayage.

import { describe, it, expect } from "vitest";

import { CONTENU } from "@/app/[locale]/_accueil/contenu";

describe("accueil — textes branchés sur la source unique de l'offre", () => {
  it("les deux réassurances du rendez-vous gratuit", () => {
    const attendu =
      "Diagnostic IA gratuit · 45 minutes · en visio ou par téléphone · sans engagement";
    expect(CONTENU.heros.reassurance).toBe(attendu);
    expect(CONTENU.rendezVous.reassurance).toBe(attendu);
  });

  it("la cible « de 5 à 249 salariés »", () => {
    expect(CONTENU.pmeTpe.chapeau).toBe(
      "Axion-IA aide les PME et les TPE françaises, de 5 à 249 salariés, à commencer avec l’IA\u202f: une journée sur place pour cartographier l’entreprise, chiffrer ses plus gros gains et former les équipes, puis la mise en place.",
    );
  });
});
