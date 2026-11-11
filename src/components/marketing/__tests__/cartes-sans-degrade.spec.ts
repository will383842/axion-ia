import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Charte 2027 : aplats uniquement (ni dégradé, ni étoile ambre) sur ces composants.
const RACINE = join(process.cwd(), "src/components");
const FICHIERS = [
  "home/AudienceSegments.tsx",
  "marketing/FeatureMediaCard.tsx",
  "marketing/ArticleCard.tsx",
  "formations/FormationDetailPage.tsx",
  "reviews/RatingBreakdown.tsx",
  "reviews/ReviewAvatar.tsx",
  "portail/SatisfactionPortailForm.tsx",
  "portail/SatisfactionV2PortailForm.tsx",
  "forms/JobApplicationForm.tsx",
  "forms/FormulaireFormateurFreelance.tsx",
];

describe("cartes et étoiles : charte 2027", () => {
  it.each(FICHIERS)("%s : aucun dégradé ni ambre/jaune", (f) => {
    const src = readFileSync(join(RACINE, f), "utf8");
    expect(src).not.toMatch(/bg-gradient-|<linearGradient|<radialGradient/);
    expect(src).not.toMatch(/(?:text|bg)-(?:amber|yellow)-\d/);
  });

  it("DarkTriadPanel : plus de halo radial (la trame de points reste)", () => {
    const src = readFileSync(join(RACINE, "marketing/DarkTriadPanel.tsx"), "utf8");
    expect(src).not.toMatch(/radial-gradient\(\d+%/);
  });
});
