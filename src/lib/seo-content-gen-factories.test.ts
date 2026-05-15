// Tests factories JSON-LD content-gen — Pass B S6.1 fix P0-6.
//
// Verrouille la présence du champ `speakable` sur QAPage JSON-LD (§ 9bis.11B
// master prompt v1.7). Sans speakable, Google AI Overviews + Bing AI ne peuvent
// pas localiser la réponse directe à lire vocalement.

import { describe, it, expect } from "vitest";
import {
  buildQAPageJsonLd,
  buildNewsArticleJsonLd,
  buildArticleJsonLd,
  buildPersonManonJsonLd,
} from "./seo-content-gen-factories";

const FIXED_DATE = new Date("2026-05-14T12:00:00Z");

describe("buildQAPageJsonLd — speakable (Pass B P0-6)", () => {
  it("inclut speakable.cssSelector par défaut (anti-régression)", () => {
    const out = buildQAPageJsonLd({
      question: "Quelle est la durée d'une intervention Axion-IA ?",
      answerHtml: "<p>Entre 1 et 5 jours selon le format.</p>",
      slug: "duree-intervention-axion-ia",
      locale: "fr",
      publishedAt: FIXED_DATE,
    });

    // Audit AEO/GEO 2026-05-15 §3.5 — la liste par défaut a été étendue à
    // 4 sélecteurs pour couvrir AnswerCard / Canonical Answer pattern.
    expect(out["speakable"]).toEqual({
      "@type": "SpeakableSpecification",
      cssSelector: [".faq-answer", '[data-aeo="answer"]', ".tldr-answer", '[data-aeo="tldr"]'],
    });
  });

  it("respecte un cssSelector personnalisé fourni en input", () => {
    const out = buildQAPageJsonLd({
      question: "Q?",
      answerHtml: "A",
      slug: "q",
      locale: "fr",
      publishedAt: FIXED_DATE,
      speakableCssSelectors: ["#answer", ".my-aeo"],
    });

    expect((out["speakable"] as { cssSelector: string[] }).cssSelector).toEqual([
      "#answer",
      ".my-aeo",
    ]);
  });

  it("émet @type QAPage + mainEntity Question + acceptedAnswer", () => {
    const out = buildQAPageJsonLd({
      question: "Q",
      answerHtml: "<p>R</p>",
      slug: "q",
      locale: "fr",
      publishedAt: FIXED_DATE,
    });
    expect(out["@type"]).toBe("QAPage");
    const main = out["mainEntity"] as { "@type": string; acceptedAnswer: { "@type": string } };
    expect(main["@type"]).toBe("Question");
    expect(main.acceptedAnswer["@type"]).toBe("Answer");
  });

  it("strip HTML tags du answer text (§ 9bis.11B compliance)", () => {
    const out = buildQAPageJsonLd({
      question: "Q",
      answerHtml: '<p onclick="alert(1)">R <script>bad()</script></p>',
      slug: "q",
      locale: "fr",
      publishedAt: FIXED_DATE,
    });
    const text = (out["mainEntity"] as { acceptedAnswer: { text: string } }).acceptedAnswer.text;
    expect(text).not.toContain("<");
    expect(text).not.toContain("script");
  });
});

describe("buildNewsArticleJsonLd — urlSegment actualites (Pass B P0-2)", () => {
  it("construit URL canonical avec segment 'actualites' par défaut pour NewsArticle", () => {
    const out = buildNewsArticleJsonLd({
      title: "Mistral lève 500 M€",
      description: "Détails du tour",
      slug: "mistral-leve-500-meur",
      locale: "fr",
      publishedAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
      sourceUrl: "https://lemonde.fr/article",
      sourceName: "Le Monde Informatique",
    });

    expect(out["url"]).toMatch(/\/fr\/actualites\/mistral-leve-500-meur$/);
    expect(out["@type"]).toBe("NewsArticle");
  });

  it("inclut isBasedOn vers la source RSS (§ 28.3 citation obligatoire)", () => {
    const out = buildNewsArticleJsonLd({
      title: "T",
      description: "D",
      slug: "s",
      locale: "fr",
      publishedAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
      sourceUrl: "https://example.com/orig",
      sourceName: "Example",
    });
    expect(out["isBasedOn"]).toEqual({
      "@type": "CreativeWork",
      url: "https://example.com/orig",
      publisher: "Example",
    });
  });
});

describe("buildArticleJsonLd — urlSegment blog default", () => {
  it("garde le segment 'blog' pour Article standard (rétro-compat)", () => {
    const out = buildArticleJsonLd({
      title: "T",
      description: "D",
      slug: "s",
      locale: "fr",
      publishedAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    });
    expect(out["url"]).toMatch(/\/fr\/blog\/s$/);
  });

  it("respecte urlSegment 'actualites' si forcé en input", () => {
    const out = buildArticleJsonLd({
      title: "T",
      description: "D",
      slug: "s",
      locale: "fr",
      publishedAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
      urlSegment: "actualites",
    });
    expect(out["url"]).toMatch(/\/fr\/actualites\/s$/);
  });
});

describe("buildPersonManonJsonLd — doctrine v2.1 (zéro réseau social)", () => {
  it("émet Person sans sameAs (doctrine intouchable § 21)", () => {
    const out = buildPersonManonJsonLd({
      slug: "manon",
      displayName: "Manon",
      jobTitle: "Plume éditoriale Axion-IA",
      photoUrl1024: "/auteurs/manon.png",
      photoAlt: null,
      knowsAbout: ["IA opérationnelle", "RAG"],
      personaDisclaimer: null,
    });
    expect(out["@type"]).toBe("Person");
    expect("sameAs" in out).toBe(false);
  });

  it("throw si slug !== manon (garde-fou v2.1)", () => {
    expect(() =>
      buildPersonManonJsonLd({
        slug: "other",
        displayName: "Other",
        jobTitle: "X",
        photoUrl1024: "/x.png",
        photoAlt: null,
        knowsAbout: [],
        personaDisclaimer: null,
      }),
    ).toThrow(/non-manon slug/);
  });
});
