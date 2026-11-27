import { describe, expect, it } from "vitest";
import { lireJournalEquipe } from "./journal-equipe";

describe("lireJournalEquipe", () => {
  it("rend null sans journal (job d'avant)", () => {
    expect(lireJournalEquipe(null)).toBeNull();
    expect(lireJournalEquipe({ title: "x" })).toBeNull();
    expect(lireJournalEquipe({ equipe: "x" })).toBeNull();
    expect(lireJournalEquipe({ equipe: { entrees: "x" } })).toBeNull();
  });
  it("lit le journal et ignore les entrées invalides", () => {
    const j = lireJournalEquipe({
      equipe: {
        issue: "publier",
        renvois: 1,
        coutTotalUsd: 1.5,
        plafondUsd: 3,
        entrees: [
          { role: "gardien", decision: "feu_vert", dureeMs: 12, coutUsd: 0.01, passe: 0 },
          "n'importe quoi",
        ],
      },
    });
    expect(j?.entrees).toHaveLength(1);
    expect(j).toMatchObject({ issue: "publier", renvois: 1, coutTotalUsd: 1.5 });
  });
});
