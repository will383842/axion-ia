import { describe, it, expect } from "vitest";
import {
  LOCAL_CITATIONS_FR,
  buildLocalBusinessSameAsFR,
  getLocalCitationsCoverage,
} from "../local-citations";

describe("Phase 14 Local SEO citations FR", () => {
  it("LC1: LOCAL_CITATIONS_FR contient ≥ 10 annuaires FR", () => {
    expect(LOCAL_CITATIONS_FR.length).toBeGreaterThanOrEqual(10);
  });

  it("LC2: chaque entry a slug + name + directoryUrl + priority + category", () => {
    for (const entry of LOCAL_CITATIONS_FR) {
      expect(entry.slug).toBeDefined();
      expect(entry.name).toBeDefined();
      expect(entry.directoryUrl).toMatch(/^https?:\/\//);
      expect([1, 2, 3, 4, 5]).toContain(entry.priority);
      expect(entry.category).toBeDefined();
    }
  });

  it("LC3: slugs uniques (anti-doublon catalog)", () => {
    const slugs = LOCAL_CITATIONS_FR.map((c) => c.slug);
    const uniques = new Set(slugs);
    expect(uniques.size).toBe(slugs.length);
  });

  it("LC4: priorité 1 inclut PagesJaunes + Google Business + Bing Places (NAP critique)", () => {
    const p1Slugs = LOCAL_CITATIONS_FR.filter((c) => c.priority === 1).map((c) => c.slug);
    expect(p1Slugs).toContain("pages-jaunes");
    expect(p1Slugs).toContain("google-business");
    expect(p1Slugs).toContain("bing-places");
  });

  // 🔴 LC5/LC6 REECRITS 2026-08-16 (audit GEO/AEO, GEO-046).
  //
  // Les deux assertions d'origine figeaient un RESULTAT — `toEqual([])` et
  // `listed === 0` — c'est-a-dire l'etat inerte du module. Le verrou interdisait
  // donc exactement le progres qu'il etait cense proteger : renseigner un seul
  // `listingUrl` faisait rougir la suite, sans cause apparente, et poussait a
  // annuler le progres plutot qu'a mettre le test a jour.
  //
  // Ils verifient desormais la COHERENCE : toute entree avec un `listingUrl`
  // non nul doit etre comptee, et reciproquement. La propriete reste vraie que
  // le module soit vide, a moitie rempli ou complet.
  it("LC5: buildLocalBusinessSameAsFR expose exactement les entrees ayant un listingUrl", () => {
    const attendues = LOCAL_CITATIONS_FR.filter((c) => c.listingUrl !== null).map(
      (c) => c.listingUrl,
    );
    expect([...buildLocalBusinessSameAsFR()].sort()).toEqual([...attendues].sort());
  });

  it("LC5b: aucune URL vide ou non http(s) ne peut se glisser dans le sameAs", () => {
    // Un `sameAs` invalide est pire qu'un `sameAs` absent : il declare une
    // corroboration qui n'existe pas.
    for (const url of buildLocalBusinessSameAsFR()) {
      expect(url.startsWith("https://") || url.startsWith("http://"), url).toBe(true);
    }
  });

  it("LC6: getLocalCitationsCoverage compte ce qui est reellement renseigne", () => {
    const cov = getLocalCitationsCoverage();
    const renseignees = LOCAL_CITATIONS_FR.filter((c) => c.listingUrl !== null);

    expect(cov.total).toBe(LOCAL_CITATIONS_FR.length);
    expect(cov.total).toBeGreaterThanOrEqual(10);
    expect(cov.listed, "le compte ne suit plus les donnees").toBe(renseignees.length);
    expect(cov.listed).toBeLessThanOrEqual(cov.total);

    // Au moins une entree en priorite 1 — la couverture P1 suit la meme regle.
    expect(cov.byPriority[1].total).toBeGreaterThanOrEqual(3);
    expect(cov.byPriority[1].listed).toBe(renseignees.filter((c) => c.priority === 1).length);
  });
});
