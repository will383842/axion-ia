import { describe, it, expect } from "vitest";
import {
  chapoDeRepli,
  compterMotsTexte,
  nomDeDomaine,
  unSeulBlocSources,
} from "./sources-et-chapo";

const CORPS =
  '<h2>Intro</h2><p>Texte.</p><section id="sources-axion"><h2>Sources</h2><ul>' +
  '<li><a href="https://www.cnil.fr/fr/ia" target="_blank">https://www.cnil.fr/fr/ia</a></li>' +
  '<li><a href="https://france-num.fr/x">Guide France Num</a></li></ul></section>';

describe("unSeulBlocSources", () => {
  it("retire la section (et son H2) quand l'article a des citations en base", () => {
    const r = unSeulBlocSources(CORPS, true);
    expect(r).not.toContain("sources-axion");
    expect(r).not.toContain("<h2>Sources</h2>");
    expect(r).toContain("<h2>Intro</h2>");
  });

  it("garde la section sans citations, et remplace l'adresse brute par le domaine", () => {
    const r = unSeulBlocSources(CORPS, false);
    expect(r).toContain('id="sources-axion"');
    expect(r).toContain(">cnil.fr</a>");
    expect(r).toContain('href="https://www.cnil.fr/fr/ia"');
    expect(r).toContain(">Guide France Num</a>"); // vrai titre conservé
  });

  it("ne touche pas un corps sans section", () => {
    expect(unSeulBlocSources("<p>a</p>", true)).toBe("<p>a</p>");
    expect(unSeulBlocSources("<p>a</p>", false)).toBe("<p>a</p>");
  });
});

describe("nomDeDomaine", () => {
  it("retire www et rend null si illisible", () => {
    expect(nomDeDomaine("https://www.exemple.fr/a?b=1")).toBe("exemple.fr");
    expect(nomDeDomaine("pas une url")).toBeNull();
  });
});

describe("chapoDeRepli", () => {
  it("préfère l'excerpt, sinon la meta-description, sinon vide", () => {
    expect(chapoDeRepli(" Chapô ", "Meta")).toBe("Chapô");
    expect(chapoDeRepli("", "Meta")).toBe("Meta");
    expect(chapoDeRepli(null, null)).toBe("");
  });
});

describe("compterMotsTexte", () => {
  it("compte les mots du texte, pas les balises", () => {
    const html = '<p class="a">un deux</p><a href="https://x.fr/très/long/chemin">trois</a>';
    expect(compterMotsTexte(html)).toBe(3);
    expect(compterMotsTexte("")).toBe(0);
  });
});
