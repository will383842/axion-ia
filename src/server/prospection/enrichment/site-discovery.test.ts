import { describe, it, expect } from "vitest";
import { candidateDomains, discoverSiteWeb } from "./site-discovery";
import type { EnrichPage } from "./enrich-service";

describe("candidateDomains", () => {
  it("génère slug collé + tireté en .fr/.com, ignore la forme juridique", () => {
    const c = candidateDomains("ISERE CONSTRUCTION SARL");
    expect(c).toContain("https://isereconstruction.fr");
    expect(c).toContain("https://isere-construction.fr");
    expect(c.some((u) => u.includes("sarl"))).toBe(false);
    expect(c.length).toBeLessThanOrEqual(4);
  });
  it("dénomination vide → aucun candidat", () => {
    expect(candidateDomains(null)).toEqual([]);
    expect(candidateDomains("  ")).toEqual([]);
  });
});

function page(url: string, text: string): EnrichPage {
  return { url, ok: true, status: 200, text };
}

describe("discoverSiteWeb", () => {
  it("retient un domaine SEULEMENT s'il confirme le SIREN/dénomination", async () => {
    const fetchPage = async (url: string): Promise<EnrichPage | null> =>
      url === "https://isereconstruction.fr"
        ? page(url, "<p>ISERE CONSTRUCTION — SIREN 380000001</p>")
        : null;
    const url = await discoverSiteWeb(
      { siren: "380000001", denomination: "ISERE CONSTRUCTION" },
      fetchPage,
    );
    expect(url).toBe("https://isereconstruction.fr");
  });

  it("rejette un domaine parké/homonyme (pas de preuve) → null", async () => {
    const fetchPage = async (url: string): Promise<EnrichPage> =>
      page(url, "<p>Domaine à vendre</p>");
    const url = await discoverSiteWeb(
      { siren: "380000001", denomination: "ISERE CONSTRUCTION" },
      fetchPage,
    );
    expect(url).toBeNull();
  });
});
