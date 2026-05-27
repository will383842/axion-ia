/**
 * Tests de sync — garantit que les whitelists hardcodées de
 * `seo-noindex-routes.ts` (Edge-safe) restent en sync avec la source de vérité
 * des datas (`getIndexableVilles()` / `getIndexableRegions()`).
 *
 * Toute promotion d'une ville pilote (ajout dans `COPY_BY_SLUG`) doit aussi
 * mettre à jour `INDEXABLE_VILLE_SLUGS` (et `INDEXABLE_SERVICE_VILLE_SLUGS` si
 * elle porte `copy.services.*`). Ce test fail → ajouter la ville dans
 * `seo-noindex-routes.ts`.
 */
import { describe, it, expect } from "vitest";

import { getIndexableVilles } from "@/content/villes";
import { getIndexableRegions } from "@/content/regions";
import { __INTERNAL, isNoindexStubRoute } from "./seo-noindex-routes";

describe("seo-noindex-routes — sync vs content datas", () => {
  it("INDEXABLE_VILLE_SLUGS = villes avec copy", () => {
    const fromData = new Set(getIndexableVilles().map((v) => v.slug));
    expect([...__INTERNAL.INDEXABLE_VILLE_SLUGS].sort()).toEqual([...fromData].sort());
  });

  it("INDEXABLE_REGION_SLUGS = régions non noindex", () => {
    const fromData = new Set(getIndexableRegions().map((r) => r.slug));
    expect([...__INTERNAL.INDEXABLE_REGION_SLUGS].sort()).toEqual([...fromData].sort());
  });

  it("INDEXABLE_SERVICE_VILLE_SLUGS reflète copy.services par service", () => {
    for (const service of ["audit", "interventions", "implementation"] as const) {
      const fromData = new Set(
        getIndexableVilles()
          .filter((v) => !!v.copy?.services?.[service])
          .map((v) => v.slug),
      );
      expect([...__INTERNAL.INDEXABLE_SERVICE_VILLE_SLUGS[service]].sort()).toEqual(
        [...fromData].sort(),
      );
    }
  });
});

describe("isNoindexStubRoute — logique", () => {
  it("retourne true pour ville stub sans copy", () => {
    // lestrem = commune T4 (<20k hab) volontairement non traitée par le batch T3 LLM
    // 2026-05-27 — reste en stub noindex (anti-doorway HCU 2024).
    expect(isNoindexStubRoute("/fr/implantations/hauts-de-france/lestrem")).toBe(true);
    expect(isNoindexStubRoute("/en/locations/hauts-de-france/lestrem")).toBe(true);
  });

  it("retourne false pour ville pilote (Paris)", () => {
    expect(isNoindexStubRoute("/fr/implantations/ile-de-france/paris")).toBe(false);
    expect(isNoindexStubRoute("/en/locations/ile-de-france/paris")).toBe(false);
  });

  it("retourne false pour les 13 régions indexables (Will 2026-05-26 — Corse réintégrée)", () => {
    expect(isNoindexStubRoute("/fr/implantations/ile-de-france")).toBe(false);
    expect(isNoindexStubRoute("/fr/implantations/corse")).toBe(false);
    expect(isNoindexStubRoute("/en/locations/corse")).toBe(false);
  });

  it("retourne true pour service×ville stub", () => {
    // lestrem = T4 stub, pau et compiegne désormais en hub auto (services pas long-form)
    // donc service×ville reste stub car copy.services absent. petite-foret = T4 stub.
    expect(isNoindexStubRoute("/fr/audit/par-ville/lestrem")).toBe(true);
    expect(isNoindexStubRoute("/fr/interventions/par-ville/petite-foret")).toBe(true);
    expect(isNoindexStubRoute("/en/implementation/by-city/lestrem")).toBe(true);
  });

  it("retourne false pour service×ville pilote (Paris)", () => {
    expect(isNoindexStubRoute("/fr/audit/par-ville/paris")).toBe(false);
    expect(isNoindexStubRoute("/fr/interventions/par-ville/paris")).toBe(false);
    expect(isNoindexStubRoute("/en/implementation/by-city/paris")).toBe(false);
  });

  it("retourne false pour routes hors scope", () => {
    expect(isNoindexStubRoute("/fr")).toBe(false);
    expect(isNoindexStubRoute("/fr/blog")).toBe(false);
    expect(isNoindexStubRoute("/fr/blog/un-article")).toBe(false);
    expect(isNoindexStubRoute("/fr/contact")).toBe(false);
    expect(isNoindexStubRoute("/")).toBe(false);
  });

  it("retourne false pour locale invalide", () => {
    expect(isNoindexStubRoute("/de/implantations/auvergne-rhone-alpes/lyon")).toBe(false);
  });
});
