// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildOrganizationJsonLd, buildWebsiteJsonLd } from "@/lib/seo";

describe("nom de site : WebSite et Organization portent les mêmes noms alternatifs", () => {
  const site = buildWebsiteJsonLd({ locale: "fr" });
  const org = buildOrganizationJsonLd({ locale: "fr" });
  it("WebSite : name, alternateName (Axion IA, AxionIA, domaine), url", () => {
    expect(site.name).toBe("Axion-IA");
    expect(site.alternateName).toEqual(
      expect.arrayContaining(["Axion IA", "AxionIA", "axion-ia.com"]),
    );
    expect(site.url).toMatch(/\/fr$/);
  });
  it("Organization : mêmes alternateName, logo et sameAs présents", () => {
    expect(org.alternateName).toEqual(site.alternateName);
    expect(org.logo).toBeTruthy();
    expect(org.sameAs.length).toBeGreaterThan(0);
  });
});
