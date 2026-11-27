// S6-1 — le maillage des pages villes ne pointe que vers des pages INDEXÉES.
import { describe, expect, it } from "vitest";

import { getNearbyVilles } from "@/lib/geo";
import { VILLES_CORE } from "@/content/villes/core";
import { VILLES_HORS_MAILLAGE, VILLES_INDEXEES } from "@/content/villes/villes-indexees";
import { villesPrincipalesIndexees } from "@/content/villes/principales-region";

describe("getNearbyVilles — option indexeesSeulement", () => {
  it("toute ville indexée ne lie que des villes indexées (aucune page noindex)", () => {
    for (const slug of VILLES_INDEXEES) {
      const v = VILLES_CORE.find((x) => x.slug === slug);
      expect(v, slug).toBeDefined();
      const proches = getNearbyVilles(v!.geo, 12, {
        excludeSlug: slug,
        sameRegion: v!.region,
        indexeesSeulement: true,
      });
      for (const p of proches) expect(VILLES_INDEXEES.has(p.ville.slug), p.ville.slug).toBe(true);
    }
  });

  it("la ville du siège n'apparaît dans aucune liste de voisines", () => {
    for (const slug of VILLES_INDEXEES) {
      const v = VILLES_CORE.find((x) => x.slug === slug)!;
      const proches = getNearbyVilles(v.geo, 50, { excludeSlug: slug, indexeesSeulement: true });
      for (const p of proches) expect(VILLES_HORS_MAILLAGE.has(p.ville.slug)).toBe(false);
    }
  });

  it("sans l'option, le comportement historique est inchangé (communes non indexées possibles)", () => {
    const paris = VILLES_CORE.find((x) => x.slug === "paris")!;
    const toutes = getNearbyVilles(paris.geo, 12, { excludeSlug: "paris", indexableOnly: true });
    expect(toutes.some((p) => !VILLES_INDEXEES.has(p.ville.slug))).toBe(true);
  });
});

describe("villesPrincipalesIndexees — pages région", () => {
  it("Île-de-France : seulement les villes indexées de la région, plus peuplées d'abord", () => {
    const idf = VILLES_CORE.filter((v) => v.region === "ile-de-france");
    const attendu = idf.filter((v) => VILLES_INDEXEES.has(v.slug));
    const liste = villesPrincipalesIndexees(idf, 12);
    expect(liste.map((v) => v.slug).sort()).toEqual(attendu.map((v) => v.slug).sort());
    expect(liste.length).toBeLessThanOrEqual(12);
    for (let i = 1; i < liste.length; i++)
      expect(liste[i - 1]!.population).toBeGreaterThanOrEqual(liste[i]!.population);
  });

  it("une région sans ville indexée rend une liste vide (jamais une page noindex)", () => {
    const sans = [{ slug: "commune-inconnue-xyz", population: 9_999 }];
    expect(villesPrincipalesIndexees(sans, 12)).toEqual([]);
  });

  it("ne mute pas le tableau reçu", () => {
    const entree = [
      { slug: "lyon", population: 1 },
      { slug: "paris", population: 2 },
    ];
    const copie = [...entree];
    villesPrincipalesIndexees(entree, 5);
    expect(entree).toEqual(copie);
  });
});
