import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildToc } from "@/lib/knowledge/article-enrich";
import { parseStepsFromBody } from "@/server/content-gen/guides/loader";

import {
  abaisserH1,
  ancrerSousTitres,
  controlerTitres,
  envelopperTableaux,
  idUniqueDepuis,
  marquerLiensExternes,
} from "../transformations";

const LIBELLE = "Tableau de données";

describe("envelopperTableaux", () => {
  it("enveloppe un tableau sans caption et lui donne un nom neutre", () => {
    const out = envelopperTableaux("<table><tr><td>a</td></tr></table>", LIBELLE);
    expect(out).toContain(
      '<div class="table-scroll" role="region" tabindex="0" aria-labelledby="cap-1">',
    );
    expect(out).toContain(`<caption class="sr-only" id="cap-1">${LIBELLE}</caption>`);
    expect(out.indexOf("<caption")).toBeGreaterThan(out.indexOf("<table"));
    expect(out.endsWith("</table></div>")).toBe(true);
  });

  it("réutilise la caption existante et lui pose un id", () => {
    const out = envelopperTableaux(
      "<table><caption>Prix HT</caption><tr><td>1</td></tr></table>",
      LIBELLE,
    );
    expect(out).toContain('aria-labelledby="cap-1"');
    expect(out).toContain('<caption id="cap-1">Prix HT</caption>');
    expect(out).not.toContain(LIBELLE);
  });

  it("conserve l'id d'une caption qui en a déjà un", () => {
    const out = envelopperTableaux('<table><caption id="mien">X</caption></table>', LIBELLE);
    expect(out).toContain('aria-labelledby="mien"');
    expect(out).not.toContain("cap-1");
  });

  it("numérote plusieurs tableaux et conserve colspan", () => {
    const out = envelopperTableaux(
      '<table><tr><td colspan="2">a</td></tr></table><p>x</p><table><tr><td>b</td></tr></table>',
      LIBELLE,
    );
    expect(out).toContain('aria-labelledby="cap-1"');
    expect(out).toContain('aria-labelledby="cap-2"');
    expect(out).toContain('colspan="2"');
    expect(out.match(/class="table-scroll"/g)).toHaveLength(2);
  });

  it("est idempotente", () => {
    const une = envelopperTableaux("<table><tr><td>a</td></tr></table>", LIBELLE);
    expect(envelopperTableaux(une, LIBELLE)).toBe(une);
  });

  it("n'entre pas en collision avec des cap-N existants", () => {
    const out = envelopperTableaux(
      '<div id="cap-1"></div><table><tr><td>a</td></tr></table>',
      LIBELLE,
    );
    expect(out).toContain('aria-labelledby="cap-2"');
  });

  it("échappe le libellé", () => {
    const out = envelopperTableaux("<table></table>", '<img src=x onerror="a">');
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
  });

  it("laisse un HTML malformé ou sans tableau intact, sans lever", () => {
    expect(envelopperTableaux("<p>rien</p>", LIBELLE)).toBe("<p>rien</p>");
    expect(envelopperTableaux("<table><tr><td>ouvert", LIBELLE)).toBe("<table><tr><td>ouvert");
    expect(envelopperTableaux("", LIBELLE)).toBe("");
  });
});

describe("abaisserH1", () => {
  it("transforme h1 en h2 en gardant les attributs, insensible à la casse", () => {
    expect(abaisserH1('<H1 class="x">T</H1><p>a</p><h1>U</h1>')).toBe(
      '<h2 class="x">T</h2><p>a</p><h2>U</h2>',
    );
  });
  it("ne touche pas aux balises voisines (hr, header…)", () => {
    const html = "<header><h1x>a</h1x></header><hr>";
    expect(abaisserH1(html)).toBe(html);
  });
  it("est idempotente", () => {
    const une = abaisserH1("<h1>T</h1>");
    expect(abaisserH1(une)).toBe(une);
  });
});

describe("controlerTitres", () => {
  it("ne signale rien sur une hiérarchie propre", () => {
    expect(controlerTitres("<h2>a</h2><h3>b</h3><h2>c</h2><h3>d</h3>")).toEqual([]);
  });
  it("signale un corps qui commence par un h3 (le h1 est dans l'en-tête)", () => {
    expect(controlerTitres("<h3>Début</h3>")).toEqual([
      { type: "saut", niveau: 3, niveauPrecedent: 1, texte: "Début" },
    ]);
  });
  it("signale un saut h2 → h4 et un h1 dans le corps, sans réécrire", () => {
    const html = "<h2>a</h2><h4><em>b</em></h4><h1>c</h1>";
    const copie = html;
    expect(controlerTitres(html)).toEqual([
      { type: "saut", niveau: 4, niveauPrecedent: 2, texte: "b" },
      { type: "h1", niveau: 1, niveauPrecedent: 4, texte: "c" },
    ]);
    expect(html).toBe(copie);
  });
  it("tolère le vide", () => {
    expect(controlerTitres("")).toEqual([]);
  });
});

describe("ancrerSousTitres", () => {
  it("pose un id stable sur les h3 et ne touche pas aux h2 de buildToc", () => {
    const base = "<h2>Un</h2><h3>Détail é</h3><h2>Deux</h2><h3>Détail é</h3><h2>Trois</h2><p>x</p>";
    const { html: avecToc, toc } = buildToc(base);
    expect(toc).toHaveLength(3);
    const out = ancrerSousTitres(avecToc);
    expect(out).toContain('<h2 id="un" data-speakable="true">Un</h2>');
    expect(out).toContain('<h2 id="deux" data-speakable="true">Deux</h2>');
    expect(out).toContain('<h3 id="detail-e">Détail é</h3>');
    expect(out).toContain('<h3 id="detail-e-2">Détail é</h3>');
  });

  it("évite une collision avec un id de h2 ou fourni", () => {
    const out = ancrerSousTitres('<h2 id="un">Un</h2><h3>Un</h3><h3>Autre</h3>', ["autre"]);
    expect(out).toContain('<h3 id="un-2">Un</h3>');
    expect(out).toContain('<h3 id="autre-2">Autre</h3>');
  });

  it("conserve l'id d'un h3 existant et ancre un h2 sans id (h1 abaissé)", () => {
    const out = ancrerSousTitres('<h3 id="garde">X</h3>' + abaisserH1("<h1>Titre</h1>"));
    expect(out).toContain('<h3 id="garde">X</h3>');
    expect(out).toContain('<h2 id="titre">Titre</h2>');
  });

  it("laisse un titre vide sans id et est idempotente", () => {
    const une = ancrerSousTitres("<h3></h3><h3>A</h3>");
    expect(une).toContain("<h3></h3>");
    expect(ancrerSousTitres(une)).toBe(une);
  });

  it("idUniqueDepuis sert aux questions et étapes et alimente l'ensemble", () => {
    const utilises = new Set<string>();
    expect(idUniqueDepuis("Étape 1 : Préparer", utilises)).toBe("etape-1-preparer");
    expect(idUniqueDepuis("Étape 1 : Préparer", utilises)).toBe("etape-1-preparer-2");
  });

  it("garantit l'unicité des ids d'étapes issues de parseStepsFromBody", () => {
    const etapes = parseStepsFromBody(
      "## Étape 1 : Cadrer\nTexte un assez long.\n\n## Étape 2 : Cadrer\nTexte deux assez long pour passer.",
    );
    expect(etapes.length).toBeGreaterThanOrEqual(2);
    const utilises = new Set<string>();
    const ids = etapes.map((e) => idUniqueDepuis(e.name, utilises));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("marquerLiensExternes", () => {
  const L = "(nouvelle fenêtre)";
  it("ajoute la mention masquée aux seuls liens target=_blank", () => {
    const out = marquerLiensExternes(
      '<a href="https://a.fr" target="_blank" rel="noopener">A</a> <a href="/b">B</a>',
      L,
    );
    expect(out).toContain(
      'A<span class="sr-only" data-nouvelle-fenetre=""> (nouvelle fenêtre)</span></a>',
    );
    expect(out).toContain('<a href="/b">B</a>');
  });
  it("est idempotente et échappe le libellé", () => {
    const une = marquerLiensExternes('<a target="_blank" href="x">A</a>', "<b>");
    expect(une).not.toContain("<b>");
    expect(marquerLiensExternes(une, "<b>")).toBe(une);
  });
  it("tolère un lien non fermé", () => {
    const html = '<a target="_blank" href="x">A';
    expect(marquerLiensExternes(html, L)).toBe(html);
  });
});

describe("contrat du module", () => {
  const source = readFileSync(join(__dirname, "../transformations.ts"), "utf8");
  it("est pur : pas de DOM, pas de client, pas d'interrupteur, pas de base", () => {
    expect(source).not.toMatch(
      /"use client"|document\.|window\.|jsdom|DOMPurify|prisma|process\.env/,
    );
  });
});
