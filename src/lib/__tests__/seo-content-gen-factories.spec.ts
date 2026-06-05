/**
 * Sprint 1 Day 3 AGT-F — Tests factories JSON-LD content-gen.
 */

import { describe, expect, it } from "vitest";
import {
  buildPersonManonJsonLd,
  buildArticleJsonLd,
  buildBlogPostingJsonLd,
  buildNewsArticleJsonLd,
  buildQAPageJsonLd,
  buildHowToJsonLd,
  buildSpeakableSpec,
  buildCitationArray,
  buildIndexNowPayload,
  truncateHeadline,
} from "../seo-content-gen-factories";

const MANON_FIXTURE = {
  slug: "manon",
  displayName: "Manon",
  jobTitle: "Plume éditoriale d'Axion-IA",
  photoUrl1024: "/auteurs/manon.png",
  photoAlt: "Manon — portrait IA disclosed",
  knowsAbout: ["Intelligence artificielle opérationnelle"],
  personaDisclaimer: "Manon est une persona éditoriale fictive.",
};

describe("truncateHeadline (VIS-13)", () => {
  it("laisse intact un titre ≤ 110 caractères", () => {
    const t = "Audit IA pour PME à Lyon";
    expect(truncateHeadline(t)).toBe(t);
  });

  it("borne à 110 caractères max", () => {
    const long = "Mot ".repeat(60).trim(); // > 110 car.
    const out = truncateHeadline(long);
    expect(out.length).toBeLessThanOrEqual(110);
    expect(out.endsWith("…")).toBe(true);
  });

  it("coupe au mot complet (pas de mot tronqué)", () => {
    const long = `${"a".repeat(50)} ${"b".repeat(80)}`;
    const out = truncateHeadline(long);
    // Coupe après le 1er bloc (lastSpace > 40) → pas de "bbb…" tronqué au milieu.
    expect(out).toBe(`${"a".repeat(50)}…`);
  });
});

describe("buildPersonManonJsonLd", () => {
  it("emits valid Person JSON-LD with @id and no sameAs", () => {
    const ld = buildPersonManonJsonLd(MANON_FIXTURE);
    expect(ld["@type"]).toBe("Person");
    expect(ld["@id"]).toMatch(/\/fr\/equipe\/manon#person$/);
    expect(ld["name"]).toBe("Manon");
    expect(ld["sameAs"]).toBeUndefined(); // doctrine v2.1 — zéro réseau social
  });

  it("throws guard if slug !== 'manon'", () => {
    expect(() => buildPersonManonJsonLd({ ...MANON_FIXTURE, slug: "not-manon" })).toThrow(
      /non-manon/,
    );
  });
});

describe("buildArticleJsonLd / BlogPosting", () => {
  const input = {
    title: "Audit IA cabinets comptables 2026",
    description: "Découvrez 5 cas d'usage audit IA pour cabinets comptables.",
    slug: "audit-ia-cabinets-comptables",
    locale: "fr" as const,
    publishedAt: "2026-05-14T00:00:00Z",
    updatedAt: "2026-05-14T00:00:00Z",
  };

  it("Article includes datePublished + dateModified ISO", () => {
    const ld = buildArticleJsonLd(input);
    expect(ld["@type"]).toBe("Article");
    expect(ld["datePublished"]).toContain("2026-05-14");
    expect(ld["inLanguage"]).toBe("fr-FR");
  });

  it("BlogPosting uses BlogPosting type", () => {
    const ld = buildBlogPostingJsonLd(input);
    expect(ld["@type"]).toBe("BlogPosting");
  });
});

describe("buildNewsArticleJsonLd", () => {
  it("includes isBasedOn source + dateline", () => {
    const ld = buildNewsArticleJsonLd({
      title: "Anthropic Opus 4.7 sort en 1M context",
      description: "Article actualité IA.",
      slug: "anthropic-opus-47-1m-context",
      locale: "fr",
      publishedAt: "2026-05-14",
      updatedAt: "2026-05-14",
      dateline: "Paris, 2026-05-14",
      printSection: "Actualités IA",
      sourceUrl: "https://lemondeinformatique.fr/article-source",
      sourceName: "Le Monde Informatique",
    });
    expect(ld["@type"]).toBe("NewsArticle");
    expect(ld["dateline"]).toBe("Paris, 2026-05-14");
    expect(ld["isBasedOn"]).toBeDefined();
  });
});

describe("buildQAPageJsonLd", () => {
  it("emits Question + Answer + Speakable", () => {
    const ld = buildQAPageJsonLd({
      question: "Combien coûte un audit IA en PME ?",
      answerHtml: "<p>Un audit IA en PME coûte entre 690 et 990 €.</p>",
      slug: "audit-ia-pme-tarifs",
      locale: "fr",
      publishedAt: "2026-05-14",
    });
    expect(ld["@type"]).toBe("QAPage");
    const main = ld["mainEntity"] as Record<string, unknown>;
    expect(main["@type"]).toBe("Question");
    const speakable = ld["speakable"] as Record<string, unknown>;
    expect(speakable["@type"]).toBe("SpeakableSpecification");
  });
});

describe("buildHowToJsonLd", () => {
  it("emits HowTo with steps positionnés", () => {
    const ld = buildHowToJsonLd({
      name: "Comment déployer un chatbot IA en PME",
      description: "Guide pilier 2000 mots.",
      slug: "deployer-chatbot-pme",
      locale: "fr",
      publishedAt: "2026-05-14",
      updatedAt: "2026-05-14",
      totalTimeMinutes: 240,
      steps: [
        { name: "Cadrage", text: "Définir le besoin métier." },
        { name: "Choix techno", text: "Sélectionner LLM + RAG." },
        { name: "Déploiement", text: "Mettre en prod." },
      ],
    });
    expect(ld["@type"]).toBe("HowTo");
    expect(ld["totalTime"]).toBe("PT240M");
    const steps = ld["step"] as Array<Record<string, unknown>>;
    expect(steps.length).toBe(3);
    expect(steps[0]?.["position"]).toBe(1);
  });
});

describe("buildSpeakableSpec / buildCitationArray / buildIndexNowPayload", () => {
  it("SpeakableSpec emits cssSelector", () => {
    const spec = buildSpeakableSpec([".tldr", "[data-aeo='answer']"]);
    expect(spec["@type"]).toBe("SpeakableSpecification");
    expect(spec["cssSelector"]).toEqual([".tldr", "[data-aeo='answer']"]);
  });

  it("CitationArray emits CreativeWork array", () => {
    const arr = buildCitationArray([
      { url: "https://insee.fr/source-1", title: "Source INSEE", publisher: "INSEE" },
    ]);
    expect(arr).toHaveLength(1);
    expect(arr[0]?.["@type"]).toBe("CreativeWork");
  });

  it("IndexNow payload emits host + key + urlList (max 10000)", () => {
    const urls = Array.from({ length: 15000 }, (_, i) => `https://axion-ia.com/p${i}`);
    const payload = buildIndexNowPayload(urls);
    expect(payload.host).toBe("axion-ia.com");
    expect(payload.urlList).toHaveLength(10_000);
  });
});
