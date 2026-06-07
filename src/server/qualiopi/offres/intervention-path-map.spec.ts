import { describe, it, expect } from "vitest";
import {
  OFFRE_TIER_TO_INTERVENTION_PATH,
  interventionPathForTier,
  tierForInterventionPath,
} from "./intervention-path-map";
import { OFFRES_SEED } from "../../../../prisma/seeds/qualiopi/offres";

describe("intervention-path-map (harmonisation Option A)", () => {
  it("mappe les 11 offres du catalogue", () => {
    expect(Object.keys(OFFRE_TIER_TO_INTERVENTION_PATH)).toHaveLength(11);
  });

  it("chaque tierId du catalogue OFFRES_SEED a une fiche /interventions", () => {
    for (const o of OFFRES_SEED) {
      expect(interventionPathForTier(o.tierId), `tier ${o.tierId}`).toMatch(/^\/interventions\//);
    }
  });

  it("respecte les mappings confirmés par Will (slugs divergents)", () => {
    expect(interventionPathForTier("intervention-dirigeant-vision")).toBe(
      "/interventions/dirigeant-vision-strategique",
    );
    expect(interventionPathForTier("intervention-claude-dirigeant")).toBe(
      "/interventions/claude-dirigeant",
    );
    expect(interventionPathForTier("intervention-conference")).toBe("/interventions/collectives");
    expect(interventionPathForTier("intervention-membre-equipe")).toBe("/interventions/individuel");
    expect(interventionPathForTier("intervention-sur-demande")).toBe("/interventions/demande");
  });

  it("map inverse cohérente (chaque fiche retrouve une offre)", () => {
    for (const path of Object.values(OFFRE_TIER_TO_INTERVENTION_PATH)) {
      expect(tierForInterventionPath(path), `reverse ${path}`).not.toBeNull();
    }
  });

  it("retourne null pour un tier inconnu ou coaching (hors Qualiopi)", () => {
    expect(interventionPathForTier("coaching-decouverte")).toBeNull();
    expect(interventionPathForTier("inexistant")).toBeNull();
  });
});
