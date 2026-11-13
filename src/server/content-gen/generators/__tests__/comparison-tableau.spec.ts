/**
 * Comparatif : le tableau doit comparer (au moins 3 lignes de données).
 */
import { describe, it, expect } from "vitest";
import { MIN_LIGNES_TABLEAU, compterLignesTableau, tableauSuffisant } from "../comparison-tableau";

const ENTETE = "<tr><th>Option</th><th>Avantages</th><th>Inconvénients</th></tr>";
const ligne = (n: number) => `<tr><td>Option ${n}</td><td>a</td><td>b</td></tr>`;

describe("compterLignesTableau", () => {
  it("ne compte pas la ligne d'en-tête", () => {
    expect(compterLignesTableau(`<table>${ENTETE}</table>`)).toBe(0);
    expect(compterLignesTableau(`<table>${ENTETE}${ligne(1)}</table>`)).toBe(1);
  });

  it("gère thead/tbody et les attributs", () => {
    const html = `<table><thead>${ENTETE}</thead><tbody><tr class="x">\n<td>A</td></tr>${ligne(2)}${ligne(3)}</tbody></table>`;
    expect(compterLignesTableau(html)).toBe(3);
  });

  it("renvoie 0 sans tableau", () => {
    expect(compterLignesTableau("<p>Aucun tableau ici</p>")).toBe(0);
    expect(compterLignesTableau("")).toBe(0);
  });
});

describe("tableauSuffisant", () => {
  it("exige MIN_LIGNES_TABLEAU lignes de données", () => {
    expect(MIN_LIGNES_TABLEAU).toBe(3);
    expect(tableauSuffisant(`<table>${ENTETE}${ligne(1)}${ligne(2)}</table>`)).toBe(false);
    expect(tableauSuffisant(`<table>${ENTETE}${ligne(1)}${ligne(2)}${ligne(3)}</table>`)).toBe(
      true,
    );
  });
});
