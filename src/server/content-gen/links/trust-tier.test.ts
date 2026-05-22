import { describe, it, expect } from "vitest";
import { computeTrustTier, relAttrForExternalLink, extractDomain } from "./trust-tier";

describe("computeTrustTier (V-14 sprint UX 2026-05-22)", () => {
  it("retourne official pour les domaines gouv.fr", () => {
    expect(computeTrustTier("legifrance.gouv.fr")).toBe("official");
    expect(computeTrustTier("data.gouv.fr")).toBe("official");
    expect(computeTrustTier("cnil.fr")).toBe("official");
  });

  it("retourne official pour les domaines europa.eu", () => {
    expect(computeTrustTier("europa.eu")).toBe("official");
    expect(computeTrustTier("edpb.europa.eu")).toBe("official");
  });

  it("retourne official via TLD heuristique pour sous-domaines .gouv.fr", () => {
    expect(computeTrustTier("api.legifrance.gouv.fr")).toBe("official");
    expect(computeTrustTier("export.example.europa.eu")).toBe("official");
  });

  it("retourne high pour les standards et grandes institutions", () => {
    expect(computeTrustTier("iso.org")).toBe("high");
    expect(computeTrustTier("w3.org")).toBe("high");
    expect(computeTrustTier("nature.com")).toBe("high");
    expect(computeTrustTier("lemonde.fr")).toBe("high");
    expect(computeTrustTier("developer.mozilla.org")).toBe("high");
  });

  it("retourne excluded pour les domaines blacklistés UGC", () => {
    expect(computeTrustTier("reddit.com")).toBe("excluded");
    expect(computeTrustTier("medium.com")).toBe("excluded");
  });

  it("retourne standard par défaut pour les domaines inconnus", () => {
    expect(computeTrustTier("example.com")).toBe("standard");
    expect(computeTrustTier("blog-perso.fr")).toBe("standard");
  });

  it("normalise les domaines avec www. et casse", () => {
    expect(computeTrustTier("www.LEMONDE.fr")).toBe("high");
    expect(computeTrustTier("WWW.iso.org")).toBe("high");
  });
});

describe("relAttrForExternalLink", () => {
  it("dofollow pour official et high (link juice transmis)", () => {
    expect(relAttrForExternalLink("official")).toBe("noopener noreferrer");
    expect(relAttrForExternalLink("high")).toBe("noopener noreferrer");
  });

  it("nofollow pour standard / low / excluded (PageRank protection)", () => {
    expect(relAttrForExternalLink("standard")).toBe("nofollow noopener noreferrer");
    expect(relAttrForExternalLink("low")).toBe("nofollow noopener noreferrer");
    expect(relAttrForExternalLink("excluded")).toBe("nofollow noopener noreferrer");
  });
});

describe("extractDomain", () => {
  it("extrait le hostname depuis une URL absolue", () => {
    expect(extractDomain("https://www.example.com/path?q=1")).toBe("www.example.com");
    expect(extractDomain("http://blog.test.fr/article")).toBe("blog.test.fr");
  });

  it("retourne null pour des chaînes invalides", () => {
    expect(extractDomain("")).toBe(null);
    expect(extractDomain("not-a-url")).toBe(null);
  });
});
