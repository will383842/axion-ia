/**
 * KB V4 (Sprint KB-14) — Tests auto-SEO/AEO/GEO.
 */

import { describe, expect, it } from "vitest";
import { detectGeoEntities, extractFaqQA, generateSeoMeta, topKeywords } from "./seo-generator";

describe("generateSeoMeta", () => {
  it("seoTitle inchangé si déjà court", () => {
    const r = generateSeoMeta({ title: "IA générative en 2026", locale: "fr" });
    expect(r.seoTitle).toBe("IA générative en 2026");
  });

  it("seoTitle tronqué avec ellipse si > 60 chars", () => {
    const long =
      "L'intelligence artificielle générative en entreprise française : guide complet 2026";
    const r = generateSeoMeta({ title: long, locale: "fr" });
    expect(r.seoTitle.length).toBeLessThanOrEqual(60);
    expect(r.seoTitle.endsWith("…")).toBe(true);
  });

  it("seoDescription extrait premières phrases", () => {
    const r = generateSeoMeta({
      title: "Titre",
      excerpt: "Premier point. Deuxième point. Troisième point.",
      locale: "fr",
    });
    expect(r.seoDescription).toContain("Premier point");
    expect(r.seoDescription).toContain("Deuxième point");
    expect(r.seoDescription).not.toContain("Troisième point");
  });

  it("seoDescription fallback bodyText si excerpt vide", () => {
    const r = generateSeoMeta({
      title: "Titre",
      excerpt: null,
      bodyText: "Phrase issue du body. Suite.",
      locale: "fr",
    });
    expect(r.seoDescription).toContain("Phrase issue");
  });

  it("seoDescription = seoTitle si aucun content", () => {
    const r = generateSeoMeta({ title: "Solo", locale: "fr" });
    expect(r.seoDescription).toBe("Solo");
  });
});

describe("extractFaqQA", () => {
  it("retourne vide si bodyText vide", () => {
    expect(extractFaqQA(null)).toEqual([]);
    expect(extractFaqQA("")).toEqual([]);
  });

  it("extrait pattern Q: ... R: ...", () => {
    const text =
      "Q : Combien coûte un audit IA ? R : Un audit Express commence à 490 € HT. Q : Quelle durée ? R : Une demi-journée.";
    const r = extractFaqQA(text);
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r[0]!.question).toContain("audit IA");
  });

  it("fallback titre se terminant par ?", () => {
    const r = extractFaqQA(
      "Une intervention de conseil IA est un accompagnement opérationnel pour identifier les usages IA prioritaires.",
      "Qu'est-ce qu'un cabinet IA opérationnel ?",
    );
    expect(r).toHaveLength(1);
    expect(r[0]!.question).toContain("cabinet IA");
  });

  it("limite à 5 QA max", () => {
    const qa = "Q: q? R: r1 phrase suffisamment longue. ".repeat(10);
    const r = extractFaqQA(qa);
    expect(r.length).toBeLessThanOrEqual(5);
  });
});

describe("detectGeoEntities", () => {
  it("détecte région Île-de-France", () => {
    const r = detectGeoEntities("Intervention en Île-de-France pour PME industrielles.");
    expect(r.find((g) => g.name === "Île-de-France")).toBeDefined();
    expect(r.find((g) => g.kind === "region")).toBeDefined();
  });

  it("détecte ville Paris", () => {
    const r = detectGeoEntities("Notre client basé à Paris dans le 9e.");
    expect(r.find((g) => g.name === "Paris")).toBeDefined();
  });

  it("dedup si même nom multiple", () => {
    const r = detectGeoEntities("Paris est la capitale. À Paris on trouve... Paris Paris Paris.");
    const parisCount = r.filter((g) => g.name === "Paris").length;
    expect(parisCount).toBe(1);
  });

  it("fallback country=FR si France seul", () => {
    const r = detectGeoEntities("Disponible partout en France métropolitaine.");
    expect(r).toContainEqual({ kind: "country", name: "France", code: "FR" });
  });

  it("retourne vide si aucune géo détectée", () => {
    expect(detectGeoEntities("Article général sans contexte géo.")).toEqual([]);
  });
});

describe("topKeywords", () => {
  it("ignore stop-words FR", () => {
    const kw = topKeywords("le la les de des audit audit audit");
    expect(kw[0]).toBe("audit");
    expect(kw).not.toContain("les");
  });

  it("trie par fréquence desc", () => {
    const kw = topKeywords("react react react vue vue angular");
    expect(kw[0]).toBe("react");
  });
});
