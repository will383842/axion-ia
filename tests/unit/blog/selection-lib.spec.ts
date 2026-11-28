/** Gabarit Sélection (M-G4) — fonctions pures : repérage des options, bandeau à mi-liste, tableau remonté. */
import { describe, expect, it } from "vitest";
import { ancreLibre, echapper, extrairePremierTableau, marquerOptions } from "@/lib/blog/selection";

const h2 = (t: string, id = t.toLowerCase().replace(/\W+/g, "-")) =>
  `<h2 id="${id}">${t}</h2><p>x</p>`;
const options = (n: number) =>
  Array.from({ length: n }, (_, i) => h2(`Outil ${String.fromCharCode(65 + i)}`)).join("");

describe("marquerOptions", () => {
  it("marque chaque H2 d'option et compte le total ; exclut FAQ, sources, méthode, conclusion, tableau", () => {
    const html = `${h2("Comment nous avons choisi")}${options(3)}${h2("Questions fréquentes")}${h2("Sources et méthode")}${h2("Conclusion")}${h2("Tableau de synthèse")}`;
    const r = marquerOptions(html, { libelleSur: "sur", bandeau: "" });
    expect(r.total).toBe(3);
    expect(r.html.match(/data-option="auto"/g)).toHaveLength(3);
    expect(r.html).toContain('<h2 id="outil-a" data-option="auto" data-sur="sur">');
    expect(r.html).not.toMatch(/<h2 id="questions-frequentes"[^>]*data-option/);
    expect(r.html).not.toMatch(/<h2 id="conclusion"[^>]*data-option/);
  });

  it("un titre déjà numéroté en texte n'est pas numéroté par la CSS (pas de doublon)", () => {
    const r = marquerOptions(`${h2("1. Zapier")}${h2("2) Make")}${h2("Airtable")}`, {
      libelleSur: "sur",
      bandeau: "",
    });
    expect(r.total).toBe(3);
    expect(r.html.match(/data-option="texte"/g)).toHaveLength(2);
    expect(r.html.match(/data-option="auto"/g)).toHaveLength(1);
  });

  it("moins de deux options : rien n'est marqué", () => {
    const html = `${h2("Conclusion")}${h2("Seule option")}`;
    expect(marquerOptions(html, { libelleSur: "sur", bandeau: "" })).toEqual({ html, total: 0 });
    expect(marquerOptions("", { libelleSur: "sur", bandeau: "" })).toEqual({ html: "", total: 0 });
  });

  it("insère le bandeau une fois, entre la 5e et la 6e option sur 10 ; pas sous 4 options", () => {
    const b = '<aside class="par-ou">PAR-OU</aside>';
    const dix = marquerOptions(options(10), { libelleSur: "sur", bandeau: b });
    expect(dix.total).toBe(10);
    expect(dix.html.match(/PAR-OU/g)).toHaveLength(1);
    expect(dix.html.indexOf("PAR-OU")).toBeGreaterThan(dix.html.indexOf('id="outil-e"'));
    expect(dix.html.indexOf("PAR-OU")).toBeLessThan(dix.html.indexOf('id="outil-f"'));
    expect(marquerOptions(options(3), { libelleSur: "sur", bandeau: b }).html).not.toContain(
      "PAR-OU",
    );
  });

  it("les balises dans le titre ne gênent pas le repérage", () => {
    const r = marquerOptions(`${h2("<em>A</em>", "a")}${h2("B", "b")}`, {
      libelleSur: "sur",
      bandeau: "",
    });
    expect(r.total).toBe(2);
  });
});

describe("extrairePremierTableau / ancreLibre / echapper", () => {
  const t = "<table><tbody><tr><td>x</td></tr></tbody></table>";
  it("sépare le premier tableau, imbriqués et enveloppe défilante compris", () => {
    const env = `<div class="table-scroll" role="region" tabindex="0">${t}</div>`;
    expect(extrairePremierTableau(`<p>a</p>${env}<p>b</p>`)).toEqual({
      tableau: t,
      reste: "<p>a</p><p>b</p>",
    });
    expect(extrairePremierTableau("<p>rien</p>")).toBeNull();
  });
  it("ancreLibre saute les ancres prises (sommaire ou corps)", () => {
    expect(ancreLibre("a", null, [])).toBe("a");
    expect(ancreLibre("a", '<h2 id="a">', [])).toBe("a-2");
    expect(ancreLibre("a", null, [{ anchor: "a" }, { anchor: "a-2" }])).toBe("a-3");
  });
  it("echapper neutralise le HTML", () => {
    expect(echapper(`<b>"&'`)).toBe("&lt;b&gt;&quot;&amp;&#39;");
  });
});
