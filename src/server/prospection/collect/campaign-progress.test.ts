import { describe, it, expect } from "vitest";
import { decideCampaignAction } from "./campaign-progress";

describe("decideCampaignAction", () => {
  it("cellules a_faire restantes → ré-orchestrer (draine quota/crash)", () => {
    expect(decideCampaignAction({ aFaire: 12, enCours: 3 })).toBe("reorchestrate");
    expect(decideCampaignAction({ aFaire: 1, enCours: 0 })).toBe("reorchestrate");
  });
  it("plus rien à faire ni en vol → terminée", () => {
    expect(decideCampaignAction({ aFaire: 0, enCours: 0 })).toBe("complete");
  });
  it("plus de a_faire mais collecte en vol → attendre", () => {
    expect(decideCampaignAction({ aFaire: 0, enCours: 5 })).toBe("wait");
  });
});
