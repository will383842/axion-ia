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
  it("Île-de-France : exactement les 5 villes indexées, plus peuplées d'abord", () => {
    const idf = VILLES_CORE.filter((v) => v.region === "ile-de-france");
    const liste = villesPrincipalesIndexees(idf, 12).map((v) => v.slug);
    expect(liste).toEqual([
      "paris",
      "saint-denis",
      "boulogne-billancourt",
      "montreuil",
      "argenteuil",
    ]);
  });

  it("aucune région, hors celle du siège, ne cite la ville du siège", () => {
    for (const r of new Set(VILLES_CORE.map((v) => v.region))) {
      if (r === "auvergne-rhone-alpes") continue;
      const liste = villesPrincipalesIndexees(
        VILLES_CORE.filter((v) => v.region === r),
        12,
      );
      for (const v of liste)
        expect(VILLES_HORS_MAILLAGE.has(v.slug), `${r} : ${v.slug}`).toBe(false);
    }
  });

  it("la Corse n'a aucune ville indexée : liste vide, section masquée", () => {
    const corse = VILLES_CORE.filter((v) => v.region === "corse");
    expect(corse.length).toBeGreaterThan(0);
    expect(villesPrincipalesIndexees(corse, 12)).toEqual([]);
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
