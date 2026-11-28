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

  it("exclut aussi résumé, bilan, verdict, « comment choisir », « ce qu'il faut retenir »", () => {
    const hors = [
      "En résumé",
      "Résumé",
      "Bilan",
      "Notre verdict",
      "Comment choisir un outil ?",
      "Ce qu’il faut retenir",
      "Récap",
    ];
    const html = `${hors.map((t) => h2(t)).join("")}${options(2)}`;
    const r = marquerOptions(html, { libelleSur: "sur", bandeau: "" });
    expect(r.total).toBe(2);
    expect(r.html.match(/data-option=/g)).toHaveLength(2);
  });

  it("ne confond pas un nom d'outil contenant un de ces mots avec une section hors liste", () => {
    const vrais = [
      "Mistral AI, l’alternative open source",
      "ChatGPT : résumé de réunions",
      "Claude : pourquoi les juristes l’adorent",
      "Notion AI pour la synthèse de notes",
      "Perplexity : recherche avec sources",
      "Fireflies, le récap automatique",
      "Make : la méthode no-code",
      "Tableau (Salesforce)",
      "3. Otter : résumé de réunions",
    ];
    const r = marquerOptions(vrais.map((t) => h2(t)).join(""), { libelleSur: "sur", bandeau: "" });
    expect(r.total).toBe(vrais.length);
  });

  it("exclut les variantes courantes : méthodologie, conclusions, pour conclure, récapitulons, quel outil choisir, comparatif", () => {
    const hors = [
      "Méthodologie",
      "Notre méthodologie",
      "Conclusions",
      "Pour conclure",
      "Récapitulons",
      "Quel outil choisir ?",
      "Comparatif",
      "Tableau récapitulatif",
      "Tableau de synthèse",
    ];
    const r = marquerOptions(`${hors.map((t) => h2(t)).join("")}${options(2)}`, {
      libelleSur: "sur",
      bandeau: "",
    });
    expect(r.total).toBe(2);
  });

  it("exclut les formules sans ambiguïté quelle que soit la longueur du titre", () => {
    const hors = [
      "Conclusion : quel outil pour votre PME ?",
      "FAQ sur les outils IA à Lyon",
      "Questions fréquentes sur les agences IA",
      "Comment choisir le bon outil IA ?",
      "Comment choisir son agence IA à Lyon ?",
      "Quelle solution choisir pour votre PME ?",
      "Pour aller plus loin avec l’IA à Lyon",
      "Comment nous avons sélectionné ces outils",
      "Pourquoi faire appel à une agence IA à Lyon ?",
      "Introduction",
      "Foire aux questions",
      "Ce tableau récapitulatif",
    ];
    const r = marquerOptions(`${hors.map((t) => h2(t)).join("")}${options(2)}`, {
      libelleSur: "sur",
      bandeau: "",
    });
    expect(r.total).toBe(2);
  });

  it("décode les entités avant de comparer (&nbsp;, &eacute;, &#39;)", () => {
    const hors = [
      "Tableau r&eacute;capitulatif&nbsp;:",
      "Ce qu&#39;il faut retenir",
      "Conclusion&nbsp;: et apr&egrave;s",
    ];
    const r = marquerOptions(`${hors.map((t) => h2(t)).join("")}${options(2)}`, {
      libelleSur: "sur",
      bandeau: "",
    });
    expect(r.total).toBe(2);
  });

  it("liste mêlant titres numérotés à la main et autres : aucun numéro CSS (compteur cohérent)", () => {
    const r = marquerOptions(`${h2("1. Zapier")}${h2("Make")}${h2("Airtable")}`, {
      libelleSur: "sur",
      bandeau: "",
    });
    expect(r.html).not.toContain('data-option="auto"');
    expect(r.html.match(/data-option="texte"/g)).toHaveLength(3);
  });

  it("un titre déjà numéroté en texte n'est pas numéroté par la CSS (pas de doublon)", () => {
    const r = marquerOptions(`${h2("1. Zapier")}${h2("2) Make")}${h2("Airtable")}`, {
      libelleSur: "sur",
      bandeau: "",
    });
    expect(r.total).toBe(3);
    expect(r.html.match(/data-option="texte"/g)).toHaveLength(3);
    expect(r.html).not.toContain('data-option="auto"');
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
      titreRetire: null,
    });
    expect(extrairePremierTableau("<p>rien</p>")).toBeNull();
    expect(extrairePremierTableau(`<p>a</p>${env}<p>b</p>`)?.titreRetire).toBeNull();
  });
  it("retire avec le tableau son titre « Tableau récapitulatif » et son introduction, et rend son ancre", () => {
    const h = `<p>a</p><h2 id="tableau-recapitulatif">Tableau récapitulatif</h2><p>Ci-dessous.</p>${t}<h2 id="z">Zapier</h2>`;
    const r = extrairePremierTableau(h);
    expect(r?.reste).toBe('<p>a</p><h2 id="z">Zapier</h2>');
    expect(r?.titreRetire).toBe("tableau-recapitulatif");
  });
  it("ne retire jamais le titre d'une vraie option qui précède un tableau", () => {
    for (const titre of ["Tableau (Salesforce)", "Notion AI pour la synthèse de notes"]) {
      const h = `<h2 id="o">${titre}</h2><p>Outil BI.</p>${t}`;
      const r = extrairePremierTableau(h);
      expect(r?.reste).toBe(`<h2 id="o">${titre}</h2><p>Outil BI.</p>`);
      expect(r?.titreRetire).toBeNull();
    }
    const marque = `<h2 id="o" data-option="auto">Tableau</h2><p>x</p>${t}`;
    expect(extrairePremierTableau(marque)?.titreRetire).toBeNull();
  });
  it("garde un titre qui n'est pas celui d'un tableau", () => {
    const r = extrairePremierTableau(`<h2 id="x">Zapier</h2><p>Texte.</p>${t}`);
    expect(r?.reste).toBe('<h2 id="x">Zapier</h2><p>Texte.</p>');
    expect(r?.titreRetire).toBeNull();
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
