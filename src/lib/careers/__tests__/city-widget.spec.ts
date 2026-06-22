import { describe, it, expect } from "vitest";
import {
  resolveWidgetCity,
  offerMatchesCity,
  filterOffersByCity,
  CAREER_WIDGET_CITIES,
} from "../city-widget";
import type { JobOffer } from "../../../../prisma/generated/client";

const mk = (o: Partial<JobOffer>): JobOffer => o as JobOffer;

describe("resolveWidgetCity", () => {
  it("inclut Grenoble (siège) + des hubs", () => {
    expect(CAREER_WIDGET_CITIES).toContain("Grenoble");
    expect(CAREER_WIDGET_CITIES.length).toBeGreaterThan(10);
  });

  it("résout casse/accents/séparateurs vers le nom canonique", () => {
    expect(resolveWidgetCity("grenoble")).toBe("Grenoble");
    expect(resolveWidgetCity("GRENOBLE")).toBe("Grenoble");
  });

  it("renvoie null pour une ville inconnue ou vide (anti-injection titre)", () => {
    expect(resolveWidgetCity("zzztopia")).toBeNull();
    expect(resolveWidgetCity("")).toBeNull();
    expect(resolveWidgetCity(undefined)).toBeNull();
  });
});

describe("offerMatchesCity — ville OU multi-villes OU remote", () => {
  it("remote = pertinent partout", () => {
    expect(
      offerMatchesCity(mk({ city: null, workMode: "remote", jobLocations: null }), "Lyon"),
    ).toBe(true);
  });

  it("ville principale", () => {
    expect(
      offerMatchesCity(mk({ city: "Lyon", workMode: "on_site", jobLocations: null }), "Lyon"),
    ).toBe(true);
  });

  it("annonce multi-villes (jobLocations) → visible dans chaque ville listée", () => {
    const offer = mk({
      city: "Valence",
      workMode: "on_site",
      jobLocations: [{ city: "Grenoble" }, { city: "Lyon" }],
    });
    expect(offerMatchesCity(offer, "Lyon")).toBe(true);
    expect(offerMatchesCity(offer, "Grenoble")).toBe(true);
  });

  it("offre sur site ailleurs = pas de match", () => {
    expect(
      offerMatchesCity(mk({ city: "Paris", workMode: "on_site", jobLocations: null }), "Lyon"),
    ).toBe(false);
  });
});

describe("filterOffersByCity", () => {
  const offers = [
    mk({ id: "a", city: "Lyon", workMode: "on_site", jobLocations: null }),
    mk({ id: "b", city: null, workMode: "remote", jobLocations: null }),
    mk({ id: "c", city: "Paris", workMode: "on_site", jobLocations: null }),
    mk({ id: "d", city: "Valence", workMode: "on_site", jobLocations: [{ city: "Lyon" }] }),
  ];

  it("ville null = aucune restriction", () => {
    expect(filterOffersByCity(offers, null)).toHaveLength(4);
  });

  it("Lyon = locale + remote + multi-villes (pas Paris)", () => {
    const r = filterOffersByCity(offers, "Lyon").map((o) => o.id);
    expect(r).toEqual(["a", "b", "d"]);
  });
});
