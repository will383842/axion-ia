import { describe, it, expect } from "vitest";
import { extractKeyFact, extractSources, sourcesToCitations, buildToc } from "./article-enrich";

describe("extractKeyFact", () => {
  it("extrait un pourcentage AVEC son unité (fact)", () => {
    const f = extractKeyFact({
      type: "fact",
      title: "L'Edge AI est adoptée par 19 % des implémentations industrielles en France.",
      excerpt: null,
    });
    expect(f?.value).toBe("19 %");
  });

  it("normalise '30%' collé en '30 %'", () => {
    const f = extractKeyFact({ type: "fact", title: "30% des PME", excerpt: null });
    expect(f?.value).toBe("30 %");
  });

  it("gère un multiplicateur préfixé (×4) et suffixé (3 fois)", () => {
    expect(extractKeyFact({ type: "fact", title: "Productivité ×4", excerpt: null })?.value).toBe(
      "×4",
    );
    expect(
      extractKeyFact({ type: "fact", title: "multiplié par 3 le ROI", excerpt: null })?.value,
    ).toBe("×3");
  });

  it("gère le monétaire avec échelle", () => {
    const f = extractKeyFact({
      type: "industry_use_case",
      title: "Un marché de 2,5 milliards d'euros en 2025.",
      excerpt: null,
    });
    expect(f?.value).toMatch(/2,5 milliards/);
  });

  it("détecte une source 'selon X' dans l'énoncé", () => {
    const f = extractKeyFact({
      type: "fact",
      title: "Le gain atteint 40 % selon McKinsey en 2024.",
      excerpt: null,
    });
    expect(f?.source).toContain("McKinsey");
  });

  it("privilégie l'excerpt comme phrase porteuse", () => {
    const f = extractKeyFact({
      type: "fact",
      title: "Titre sans chiffre",
      excerpt: "Réduction de 60 % du temps de traitement.",
    });
    expect(f?.value).toBe("60 %");
    expect(f?.context).toContain("60");
  });

  it("retourne null si type non éligible (anti-doorway)", () => {
    expect(extractKeyFact({ type: "guide", title: "73 % des gens", excerpt: null })).toBeNull();
  });

  it("retourne null si aucun chiffre détecté", () => {
    expect(
      extractKeyFact({ type: "fact", title: "Une affirmation sans chiffre.", excerpt: null }),
    ).toBeNull();
  });
});

describe("extractSources", () => {
  it("extrait les liens externes (pas Axion-IA, pas relatifs)", () => {
    const body =
      '<p>Voir <a href="https://insee.fr/etude">INSEE</a> et ' +
      '<a href="/interne">interne</a> et ' +
      '<a href="https://axion-ia.com/blog">nous</a>.</p>';
    const s = extractSources(body);
    expect(s).toHaveLength(1);
    expect(s[0]?.href).toBe("https://insee.fr/etude");
    expect(s[0]?.label).toBe("INSEE");
  });

  it("extrait une mention 'Source :' textuelle (sans href)", () => {
    const body = "<p><em>Source : Syntec Numérique — rapport 2024</em></p>";
    const s = extractSources(body);
    expect(s[0]?.label).toContain("Syntec Numérique");
    expect(s[0]?.href).toBeNull();
  });

  it("dédoublonne par href", () => {
    const body = '<a href="https://x.org">A</a><a href="https://x.org">A bis</a>';
    expect(extractSources(body)).toHaveLength(1);
  });

  it("retourne [] sans source (anti-doorway)", () => {
    expect(extractSources("<p>Texte sans lien ni source.</p>")).toEqual([]);
  });

  it("ignore une fausse mention 'Source :' en prose (faux positif)", () => {
    expect(extractSources("<p>Source : voir ci-dessous pour le détail.</p>")).toEqual([]);
  });

  it("garde une 'Source :' textuelle crédible (nom propre / année)", () => {
    expect(extractSources("<p>Source : Gartner 2024</p>")[0]?.label).toContain("Gartner");
    expect(extractSources("<p>Référence : étude INSEE</p>")[0]?.label).toContain("INSEE");
  });

  it("sourcesToCitations ne garde que les sources liées", () => {
    const c = sourcesToCitations([
      { label: "INSEE", href: "https://insee.fr" },
      { label: "Rapport interne", href: null },
    ]);
    expect(c).toEqual([{ url: "https://insee.fr", title: "INSEE" }]);
  });
});

describe("buildToc", () => {
  const guide =
    "<h2>Comprendre l'enjeu</h2><p>...</p>" +
    "<h2>Mettre en œuvre</h2><p>...</p>" +
    "<h2>Mesurer l'impact</h2><p>...</p>";

  it("injecte id + data-speakable et renvoie le sommaire (≥ 3 h2)", () => {
    const { html, toc } = buildToc(guide);
    expect(toc).toHaveLength(3);
    expect(toc[0]).toEqual({ id: "comprendre-l-enjeu", text: "Comprendre l'enjeu" });
    expect(html).toContain('<h2 id="comprendre-l-enjeu" data-speakable="true">');
    expect(html).toContain('<h2 id="mesurer-l-impact" data-speakable="true">');
  });

  it("ne touche RIEN si < 3 h2 (entrée courte → pas de TOC)", () => {
    const short = "<h2>Un seul titre</h2><p>corps</p>";
    const { html, toc } = buildToc(short);
    expect(toc).toEqual([]);
    expect(html).toBe(short);
  });

  it("dédoublonne les ancres de titres identiques", () => {
    const dup = "<h2>Étapes</h2><h2>Étapes</h2><h2>Étapes</h2>";
    const { toc } = buildToc(dup);
    expect(new Set(toc.map((t) => t.id)).size).toBe(3);
    expect(toc.map((t) => t.id)).toEqual(["etapes", "etapes-2", "etapes-3"]);
  });
});
