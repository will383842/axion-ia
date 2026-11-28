/** Gabarit Comparatif (M-G3) — fonctions pures : face-à-face, tableau remonté, cellules Oui/Non/Partiel. */
import { describe, expect, it } from "vitest";
import { extraireDuel, marquerCellules, remonterPremierTableau } from "@/lib/blog/comparatif";

describe("extraireDuel", () => {
  it("sépare un titre « A ou B » et ignore la fin après les deux-points", () => {
    expect(extraireDuel("ChatGPT ou Copilot : lequel choisir pour une PME ?")).toEqual({
      a: "ChatGPT",
      b: "Copilot",
    });
  });
  it("accepte vs, contre et versus", () => {
    expect(extraireDuel("Zapier vs Make")).toEqual({ a: "Zapier", b: "Make" });
    expect(extraireDuel("Cloud contre local")).toEqual({ a: "Cloud", b: "local" });
    expect(extraireDuel("Excel versus Sheets")).toEqual({ a: "Excel", b: "Sheets" });
  });
  it("rend null sans séparateur net, ou avec plus de deux camps", () => {
    expect(extraireDuel("Quel outil d’IA choisir ?")).toBeNull();
    expect(extraireDuel("A ou B ou C")).toBeNull();
    expect(extraireDuel("")).toBeNull();
  });
  it("rend null si un camp est vide ou démesuré", () => {
    expect(extraireDuel("ou Copilot")).toBeNull();
    expect(extraireDuel(`${"x".repeat(90)} ou B`)).toBeNull();
  });
});

describe("remonterPremierTableau", () => {
  const t1 =
    "<table><thead><tr><th>Critère</th></tr></thead><tbody><tr><td>Oui</td></tr></tbody></table>";
  const t2 = "<table><tbody><tr><td>second</td></tr></tbody></table>";
  it("extrait le premier tableau et le retire du corps (une seule occurrence)", () => {
    const r = remonterPremierTableau(`<h2 id="a">A</h2><p>x</p>${t1}<p>y</p>${t2}`);
    expect(r).not.toBeNull();
    expect(r!.tableau).toBe(t1);
    expect(r!.reste).toBe(`<h2 id="a">A</h2><p>x</p><p>y</p>${t2}`);
  });
  it("rend null sans tableau", () => {
    expect(remonterPremierTableau("<p>rien</p>")).toBeNull();
    expect(remonterPremierTableau("")).toBeNull();
  });
  it("garde un tableau imbriqué avec son parent", () => {
    const imbrique =
      "<table><tbody><tr><td><table><tbody><tr><td>i</td></tr></tbody></table></td></tr></tbody></table>";
    const r = remonterPremierTableau(`<p>a</p>${imbrique}<p>b</p>`);
    expect(r!.tableau).toBe(imbrique);
    expect(r!.reste).toBe("<p>a</p><p>b</p>");
  });
  it("retire aussi l'enveloppe défilante qui entoure exactement le tableau", () => {
    const env = `<div class="table-scroll" role="region" tabindex="0" aria-labelledby="cap-1">${t1}</div>`;
    const r = remonterPremierTableau(`<p>a</p>${env}<p>b</p>`);
    expect(r!.tableau).toBe(t1);
    expect(r!.reste).toBe("<p>a</p><p>b</p>");
  });
});

describe("marquerCellules", () => {
  it("pose une classe sur les cellules Oui / Non / Partiel et garde le texte", () => {
    const h = marquerCellules(
      "<table><tbody><tr><th>x</th><td>Oui</td><td> non. </td><td>Partiel</td><td>Autre</td></tr></tbody></table>",
    );
    expect(h).toContain('<td class="cellule cellule--oui">Oui</td>');
    expect(h).toContain('<td class="cellule cellule--non"> non. </td>');
    expect(h).toContain('<td class="cellule cellule--partiel">Partiel</td>');
    expect(h).toContain("<td>Autre</td>");
  });
  it("conserve les autres attributs de la cellule", () => {
    expect(marquerCellules('<td data-col="A" class="z">Oui</td>')).toContain(
      'data-col="A" class="z cellule cellule--oui"',
    );
  });
});
