import { describe, it, expect } from "vitest";
import {
  articlePageSeoDefaults,
  qualityFromScores,
  appendSourcesSection,
} from "../article-quality";

describe("appendSourcesSection — citations d'autorité garanties (round 4)", () => {
  const links = [
    { url: "https://www.insee.fr/x", title: "INSEE" },
    { url: "https://dares.travail-emploi.gouv.fr/y", title: "DARES" },
  ];

  it("ajoute des <a href=https> comptés comme citations", () => {
    const out = appendSourcesSection("<p>corps</p>", links);
    const httpsLinks = (out.match(/<a\b[^>]*href="https?:\/\//gi) ?? []).length;
    expect(httpsLinks).toBe(2);
    expect(out).toContain("INSEE");
  });

  it("est idempotent (pas de double section)", () => {
    const once = appendSourcesSection("<p>x</p>", links);
    const twice = appendSourcesSection(once, links);
    expect((twice.match(/id="sources-axion"/g) ?? []).length).toBe(1);
  });

  it("no-op si aucun lien", () => {
    expect(appendSourcesSection("<p>x</p>", [])).toBe("<p>x</p>");
  });
});

describe("articlePageSeoDefaults — SEO page-level garanti", () => {
  it("crédite Person Manon + H1 + canonical + hero, et dérive le contentKind", () => {
    const d = articlePageSeoDefaults("audit-ia-grenoble", "faq_geo");
    expect(d.hasPersonManonJsonLd).toBe(true);
    expect(d.hasPageH1).toBe(true);
    expect(d.canonical).toBe("https://axion-ia.com/fr/blog/audit-ia-grenoble");
    expect(d.imageCount).toBe(1);
    expect(d.imagesWithAlt).toBe(1);
    expect(d.contentKind).toBe("faq"); // faq_geo → faq
  });

  it("mappe le contentKind par type", () => {
    expect(articlePageSeoDefaults("x", "guide_pilier").contentKind).toBe("guide");
    expect(articlePageSeoDefaults("x", "landing_ville").contentKind).toBe("landing");
    expect(articlePageSeoDefaults("x", "comparison").contentKind).toBe("comparison");
    expect(articlePageSeoDefaults("x", "blog_article").contentKind).toBe("article");
  });
});

describe("qualityFromScores — formule centralisée (lisibilité bande + doctrine)", () => {
  it("utilise le fitness de lisibilité, pas le Flesch brut", () => {
    // SEO 70, Flesch 40 → fit 80 → (70+80)/2 = 75 (vs ancien (70+40)/2 = 55).
    expect(qualityFromScores(70, 40, true)).toBe(75);
  });

  it("applique -30 quand la doctrine échoue", () => {
    expect(qualityFromScores(70, 40, false)).toBe(45); // 75 - 30
  });

  it("ne descend pas sous 0", () => {
    expect(qualityFromScores(10, 10, false)).toBe(0);
  });
});
