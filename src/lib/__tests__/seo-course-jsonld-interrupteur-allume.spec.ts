// R7 — contre-épreuve de `seo-course-jsonld.spec.ts` : interrupteur des prix publics
// ALLUMÉ, la formation réémet son Offer chiffrée telle qu'avant. Fichier séparé parce que
// `vi.mock` vaut pour tout le fichier.

import { describe, it, expect, vi } from "vitest";

vi.mock("@/content/pricing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/content/pricing")>()),
  PRIX_PUBLICS_AFFICHES: true,
}));

import { buildCourseJsonLd } from "../seo";

describe("buildCourseJsonLd — interrupteur des prix publics allumé (R7)", () => {
  it("réémet l'Offer avec son prix HT", () => {
    const out = buildCourseJsonLd({
      locale: "fr",
      path: "/interventions/collectives/1-jour",
      name: "X",
      description: "Description complète intervention 1 jour pour test offre prix HT.",
      priceEurHt: 1990,
    });
    const offers = (out as Record<string, unknown>).offers as Record<string, unknown> | undefined;
    expect(offers?.["@type"]).toBe("Offer");
    expect(offers?.priceCurrency).toBe("EUR");
    expect(offers?.price).toBe("1990");
  });
});
