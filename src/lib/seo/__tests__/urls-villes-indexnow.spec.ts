import { describe, it, expect } from "vitest";

import { urlsVillesIndexNow } from "../urls-villes-indexnow";

describe("urlsVillesIndexNow", () => {
  const urls = urlsVillesIndexNow("https://x.test", ["fr"]);

  it("contient les 40 villes de la liste, Grenoble comprise", () => {
    expect(urls).toHaveLength(40);
    expect(urls).toContain("https://x.test/fr/implantations/auvergne-rhone-alpes/grenoble");
    expect(urls).toContain("https://x.test/fr/implantations/ile-de-france/paris");
  });

  it("ne contient aucune URL service × ville ni ville hors liste", () => {
    expect(urls.filter((u) => /par-ville|by-city/.test(u))).toEqual([]);
    expect(urls.filter((u) => /\/(acheres|poitiers|versailles)$/.test(u))).toEqual([]);
  });
});
