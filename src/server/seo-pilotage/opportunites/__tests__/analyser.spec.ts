import { describe, expect, it } from "vitest";
import { analyser } from "../analyser";
import type { LigneRequete } from "../types";

describe("analyser (propriété)", () => {
  it("aucune sortie ne contient « grenoble » ni « nouvelleUrl », même avec des entrées hostiles", () => {
    const lignes: LigneRequete[] = [];
    for (let i = 0; i < 60; i++) {
      lignes.push({
        requete: i % 3 === 0 ? `formation ia grenoble ${i}` : `tarif formation ia ${i}`,
        url:
          i % 5 === 0 ? "https://axion-ia.com/fr/grenoble/x" : `https://axion-ia.com/fr/blog/p${i}`,
        typePage: "article",
        position: 5 + (i % 20),
        impressions: 150 + i,
        clics: i % 7,
        semainesPresentes: 4,
      });
    }
    const sortie = JSON.stringify(
      analyser({
        lignes,
        declin: [],
        pages: [],
        historiques: [],
        site: { clics: 1, clicsPrecedents: 1 },
      }),
    );
    expect(sortie.toLowerCase()).not.toContain("grenoble");
    expect(sortie).not.toContain("nouvelleUrl");
    expect(sortie).not.toContain("changer_url");
  });
  it("une page protégée ne produit que des signalements ; le reste est classé", () => {
    const base = {
      requete: "formation ia pme",
      typePage: "article" as const,
      position: 8,
      impressions: 400,
      clics: 12,
      semainesPresentes: 4,
    };
    const r = analyser({
      lignes: [
        { ...base, url: "https://axion-ia.com/fr/tarifs" },
        { ...base, url: "https://axion-ia.com/fr/blog/x", requete: "agent ia pme" },
      ],
      declin: [],
      pages: [],
      historiques: [],
      site: { clics: 1, clicsPrecedents: 1 },
    });
    expect(r.propositions.every((p) => !p.url.endsWith("/tarifs"))).toBe(true);
    expect(r.signalements.some((s) => s.kind === "page_protegee")).toBe(true);
    const pr = r.propositions.map((p) => p.priorite);
    expect([...pr].sort((a, b) => b - a)).toEqual(pr);
  });
  it("est déterministe", () => {
    const e = {
      lignes: [],
      declin: [],
      pages: [],
      historiques: [],
      site: { clics: 0, clicsPrecedents: 0 },
    };
    expect(analyser(e)).toEqual(analyser(e));
  });
});
