import { describe, it, expect } from "vitest";
import { SLUG_OFFRE_FORMATEUR_FREELANCE, porteEncadreFreelance } from "../formateur-freelance";

describe("encadré « formateur indépendant » (demande Will 2026-10-09)", () => {
  it("figure sur les deux offres de formateur salarié", () => {
    expect(porteEncadreFreelance("formateur-ia-itinerant")).toBe(true);
    expect(porteEncadreFreelance("formateur-ia-sedentaire")).toBe(true);
  });

  it("ne figure ni sur l'offre freelance elle-même, ni sur les autres offres", () => {
    expect(porteEncadreFreelance(SLUG_OFFRE_FORMATEUR_FREELANCE)).toBe(false);
    expect(porteEncadreFreelance("stagiaire-formation-ia")).toBe(false);
    expect(porteEncadreFreelance("monteur-video-freelance-distance")).toBe(false);
  });

  // La passerelle « Recrutée → fiche formateur » (#1393) reconnaît une offre de
  // formateur à son slug `formateur-…` : un autre préfixe la priverait du bouton.
  it("l'offre freelance garde un slug « formateur-… »", () => {
    expect(SLUG_OFFRE_FORMATEUR_FREELANCE).toMatch(/^format(eur|rice)/);
  });
});
