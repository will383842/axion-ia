/**
 * Sprint v7 Phase 12 — Tests extended schema.org helpers.
 */

import { describe, it, expect } from "vitest";
import {
  buildDefinedTermJsonLd,
  buildSoftwareApplicationJsonLd,
  buildVideoObjectJsonLd,
  buildClaimReviewJsonLd,
  buildSiteNavigationJsonLd,
  buildSpecialAnnouncementJsonLd,
} from "../extended-schemas";

describe("Phase 12 — Extended schema.org helpers", () => {
  it("X1: DefinedTerm — type + name + définition + URL", () => {
    const result = buildDefinedTermJsonLd({
      term: "RAG",
      definition: "Retrieval-Augmented Generation",
      url: "https://axion-ia.com/glossaire/rag",
      termCode: "rag",
    });
    expect(result["@type"]).toBe("DefinedTerm");
    expect(result.name).toBe("RAG");
    expect(result.url).toBe("https://axion-ia.com/glossaire/rag");
    expect(result.termCode).toBe("rag");
  });

  it("X2: DefinedTerm — inDefinedTermSet présent si fourni", () => {
    const result = buildDefinedTermJsonLd({
      term: "LLM",
      definition: "Large Language Model",
      url: "https://axion-ia.com/glossaire/llm",
      inDefinedTermSet: "https://axion-ia.com/glossaire",
    });
    expect(result.inDefinedTermSet).toBeDefined();
    expect(result.inDefinedTermSet?.url).toBe("https://axion-ia.com/glossaire");
  });

  it("X3: SoftwareApplication — defaults Web + Offer si price fourni", () => {
    const result = buildSoftwareApplicationJsonLd({
      name: "Calculateur ROI IA Axion-IA",
      description: "Estime le ROI d'un projet IA",
      url: "https://axion-ia.com/calculateur-roi",
      applicationCategory: "BusinessApplication",
      price: "0",
    });
    expect(result["@type"]).toBe("SoftwareApplication");
    expect(result.operatingSystem).toBe("Web");
    expect("offers" in result).toBe(true);
  });

  it("X4: VideoObject — props minimales + optionnels", () => {
    const result = buildVideoObjectJsonLd({
      name: "Cas concret IA Lyon",
      description: "Story 3 min ROI 250%",
      thumbnailUrl: "https://axion-ia.com/og/case-lyon.jpg",
      uploadDate: "2026-05-23",
      duration: "PT3M",
    });
    expect(result["@type"]).toBe("VideoObject");
    expect(result.duration).toBe("PT3M");
  });

  it("X5: ClaimReview — fact-check structure complète", () => {
    const result = buildClaimReviewJsonLd({
      url: "https://axion-ia.com/fact-check/ia-remplace-humains",
      claimReviewed: "L'IA va remplacer 80% des emplois en 5 ans",
      reviewRating: 1, // faux
      itemReviewedAuthor: "Some Pundit",
      itemReviewedDatePublished: "2026-01-15",
      reviewBody: "Étude OCDE 2024 : 27% des tâches automatisables (≠ emplois).",
    });
    expect(result["@type"]).toBe("ClaimReview");
    expect(result.reviewRating.ratingValue).toBe(1);
    expect(result.reviewRating.bestRating).toBe(5);
  });

  it("X6: SiteNavigationElement — hasPart array avec positions", () => {
    const items = [
      { name: "Audit", url: "https://axion-ia.com/audit", position: 1 },
      { name: "Interventions", url: "https://axion-ia.com/interventions", position: 2 },
      { name: "Blog", url: "https://axion-ia.com/blog", position: 3 },
    ];
    const result = buildSiteNavigationJsonLd(items);
    expect(result["@type"]).toBe("SiteNavigationElement");
    expect(result.hasPart.length).toBe(3);
    expect(result.hasPart[0]?.position).toBe(1);
  });

  it("X7: SpecialAnnouncement — France country location forcé", () => {
    const result = buildSpecialAnnouncementJsonLd({
      name: "Nouveau Code IA UE",
      text: "L'AI Act EU entre en vigueur le 2026-08-02",
      url: "https://axion-ia.com/news/ai-act-eu",
      datePosted: "2026-05-23",
    });
    expect(result["@type"]).toBe("SpecialAnnouncement");
    expect(result.announcementLocation.name).toBe("France");
    expect(result.announcementLocation.identifier).toBe("FR");
  });
});
