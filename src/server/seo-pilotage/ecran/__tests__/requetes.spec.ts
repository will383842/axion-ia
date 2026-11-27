import { describe, expect, it } from "vitest";

import { PLANCHER_IMPRESSIONS_REQUETE, composerRequetes } from "../requetes";

const l = (requete: string, chemin: string, impressions: number, clics: number, pos: number) => ({
  requete,
  chemin,
  impressions,
  clics,
  positionSum: pos * impressions,
});

describe("composerRequetes", () => {
  it("regroupe par requête, désigne la page propriétaire et signale la cannibalisation", () => {
    const r = composerRequetes([
      l("formation ia lyon", "/fr/a", 100, 5, 6),
      l("formation ia lyon", "/fr/b", 40, 1, 12),
      l("tarif formation ia", "/fr/c", 50, 2, 4),
    ]);
    const lyon = r.find((x) => x.requete === "formation ia lyon");
    expect(lyon?.pageProprietaire).toBe("/fr/a");
    expect(lyon?.nbPages).toBe(2);
    expect(lyon?.cannibalisation).toBe(true);
    expect(lyon?.impressions).toBe(140);
    expect(lyon?.position).toBeCloseTo((600 + 480) / 140);
    expect(r.find((x) => x.requete === "tarif formation ia")?.cannibalisation).toBe(false);
  });

  it("donne l'intention en français", () => {
    const r = composerRequetes([l("tarif formation ia", "/fr/c", 50, 2, 4)]);
    expect(r[0]?.intention).toBe("transactionnelle");
  });

  it("n'affiche pas les requêtes sous le plancher d'impressions (données personnelles)", () => {
    const r = composerRequetes([
      l("marie dupont avocate", "/fr/a", PLANCHER_IMPRESSIONS_REQUETE - 1, 0, 9),
      l("formation ia", "/fr/a", PLANCHER_IMPRESSIONS_REQUETE, 0, 9),
    ]);
    expect(r.map((x) => x.requete)).toEqual(["formation ia"]);
  });

  it("trie par impressions décroissantes", () => {
    const r = composerRequetes([l("a b", "/x", 5, 0, 1), l("c d", "/y", 50, 0, 1)]);
    expect(r.map((x) => x.requete)).toEqual(["c d", "a b"]);
  });
});
