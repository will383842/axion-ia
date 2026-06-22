import { describe, it, expect } from "vitest";
import { extractAnchorText, mapAuthorityToTrustTier } from "./persist-citations";
import type { ExternalLink } from "@/data/external-links/types";

function makeLink(over: Partial<ExternalLink>): ExternalLink {
  return {
    id: "x",
    url: "https://example.fr/page",
    title: "Titre",
    organization: "Org",
    category: "research_industry",
    scope: "national",
    verticales: [],
    topics: [],
    language: "fr",
    authority: 4,
    verifiedAt: "2026-05-22",
    lastCheckedAt: "2026-05-22",
    status: "active",
    isCompetitor: false,
    paywall: false,
    indexable: true,
    isHttps: true,
    usageCount: 0,
    ...over,
  };
}

describe("mapAuthorityToTrustTier", () => {
  it("classe les domaines publics FR/EU en official quelle que soit l'autorité", () => {
    expect(mapAuthorityToTrustTier(makeLink({ category: "gov_fr", authority: 3 }))).toBe(
      "official",
    );
    expect(mapAuthorityToTrustTier(makeLink({ category: "gov_eu", authority: 4 }))).toBe(
      "official",
    );
  });
  it("mappe l'autorité numérique vers high/standard/low", () => {
    expect(mapAuthorityToTrustTier(makeLink({ category: "academic", authority: 5 }))).toBe("high");
    expect(mapAuthorityToTrustTier(makeLink({ category: "press_top", authority: 3 }))).toBe(
      "standard",
    );
    expect(mapAuthorityToTrustTier(makeLink({ category: "press_top", authority: 2 }))).toBe("low");
  });
});

describe("extractAnchorText", () => {
  const url = "https://www.insee.fr/stats";
  it("récupère le texte d'ancre visible (HTML imbriqué nettoyé)", () => {
    const html = `<p>Selon <a href="${url}" rel="noopener noreferrer">l'<strong>INSEE</strong></a>, ...</p>`;
    expect(extractAnchorText(html, url)).toBe("l'INSEE");
  });
  it("gère les guillemets simples", () => {
    const html = `<a href='${url}'>données INSEE</a>`;
    expect(extractAnchorText(html, url)).toBe("données INSEE");
  });
  it("retourne null si le lien est absent du body", () => {
    expect(extractAnchorText("<p>aucun lien</p>", url)).toBeNull();
  });
  it("n'est pas trompé par les caractères spéciaux d'URL (regex-safe)", () => {
    const tricky = "https://ex.fr/a?b=1&c=2";
    const html = `<a href="${tricky}">x</a>`;
    expect(extractAnchorText(html, tricky)).toBe("x");
  });
});
