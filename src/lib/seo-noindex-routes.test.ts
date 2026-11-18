/**
 * Tests de sync — garantit que la whitelist Edge de `seo-noindex-routes.ts`
 * (fichier généré `src/generated/indexable-villes.ts`) reste en sync avec la
 * liste unique `src/content/villes/villes-indexees.ts` via `isVilleIndexable()`.
 * Échec → `pnpm tsx scripts/gen-indexable-villes.ts`.
 */
import { describe, it, expect } from "vitest";

import { getIndexableVilles, isVilleIndexable } from "@/content/villes";
import { getIndexableRegions } from "@/content/regions";
import { __INTERNAL, isNoindexStubRoute } from "./seo-noindex-routes";

describe("seo-noindex-routes — sync vs content datas", () => {
  it("INDEXABLE_VILLE_SLUGS = le CAP d'indexation (isVilleIndexable), pas « a un copy »", () => {
    // Audit indexation GSC 2026-07-31 — la whitelist Edge dérive désormais du
    // MÊME ensemble que le `<meta robots>` des pages (`isVilleIndexable`,
    // déterministe depuis le 2026-06-14) : header et meta ne peuvent plus se
    // contredire. Si ce test échoue : les données villes ont changé sans
    // régénération → `pnpm tsx scripts/gen-indexable-villes.ts`.
    const fromData = new Set(
      getIndexableVilles()
        .map((v) => v.slug)
        .filter((slug) => isVilleIndexable(slug)),
    );
    expect([...__INTERNAL.INDEXABLE_VILLE_SLUGS].sort()).toEqual([...fromData].sort());
  });

  it("GARDE-FOU CRITIQUE : aucune ville indexable ne reçoit le header noindex", () => {
    // Un faux positif (X-Robots-Tag noindex sur une page `index:true`) ferait
    // désindexer une page voulue en index — c'est LE risque interdit de ce
    // fichier (cf. son en-tête « Faux positifs CRITIQUE »).
    for (const v of getIndexableVilles()) {
      if (!isVilleIndexable(v.slug)) continue;
      expect(
        isNoindexStubRoute(`/fr/implantations/${v.region}/${v.slug}`),
        `ville indexable ${v.slug} recevrait X-Robots-Tag noindex`,
      ).toBe(false);
    }
  });

  it("INDEXABLE_REGION_SLUGS = régions non noindex", () => {
    const fromData = new Set(getIndexableRegions().map((r) => r.slug));
    expect([...__INTERNAL.INDEXABLE_REGION_SLUGS].sort()).toEqual([...fromData].sort());
  });

  it("toute ville hors liste qui a un copy reçoit le header noindex", () => {
    for (const v of getIndexableVilles()) {
      if (isVilleIndexable(v.slug)) continue;
      expect(
        isNoindexStubRoute(`/fr/implantations/${v.region}/${v.slug}`),
        `ville hors liste ${v.slug} sans X-Robots-Tag noindex`,
      ).toBe(true);
    }
  });

  it("toutes les URL par-ville / by-city des 8 sections reçoivent le header noindex", () => {
    const sections = [
      ["audit", "par-ville"],
      ["interventions", "par-ville"],
      ["implementation", "par-ville"],
      ["formations", "par-ville"],
      ["un-a-un", "par-ville"],
      ["sites-web-augmentes", "par-ville"],
      ["audit", "by-city"],
      ["implementation", "by-city"],
      ["formations", "by-city"],
      ["one-to-one", "by-city"],
      ["ai-augmented-websites", "by-city"],
    ] as const;
    for (const [section, segment] of sections) {
      for (const ville of ["paris", "lyon", "grenoble", "acheres", "lestrem"]) {
        for (const locale of ["fr", "en"]) {
          expect(
            isNoindexStubRoute(`/${locale}/${section}/${segment}/${ville}`),
            `/${locale}/${section}/${segment}/${ville}`,
          ).toBe(true);
        }
      }
    }
  });
});

describe("isNoindexStubRoute — logique", () => {
  it("hub ville CAPPÉE : reçoit le X-Robots-Tag (aligné sur le cap 2026-07-03)", () => {
    // Sémantique CHANGÉE par l'audit indexation GSC 2026-07-31 : la whitelist
    // suit désormais le cap `isVilleIndexable` (~480 villes premium/curées),
    // plus « a un copy » (~2 157). Lestrem (T4, non premium) est `noindex` au
    // niveau `<meta>` depuis le cap du 2026-07-03 — le header Edge doublonne
    // ENFIN ce signal, ce qui économise le rendu HTML côté Googlebot (c'était
    // tout l'objet du X-Robots-Tag, jamais effectif sur les villes cappées).
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

  it("retourne true pour service×ville même pour Paris (toutes en noindex, 18/11/2026)", () => {
    expect(isNoindexStubRoute("/fr/audit/par-ville/paris")).toBe(true);
    expect(isNoindexStubRoute("/fr/interventions/par-ville/paris")).toBe(true);
    expect(isNoindexStubRoute("/en/implementation/by-city/paris")).toBe(true);
    expect(isNoindexStubRoute("/fr/formations/par-ville/lyon")).toBe(true);
  });

  it("la page ville gardée n'est pas touchée (Lyon, Brest, Montreuil, Grenoble)", () => {
    expect(isNoindexStubRoute("/fr/implantations/auvergne-rhone-alpes/lyon")).toBe(false);
    expect(isNoindexStubRoute("/fr/implantations/bretagne/brest")).toBe(false);
    expect(isNoindexStubRoute("/fr/implantations/ile-de-france/montreuil")).toBe(false);
    expect(isNoindexStubRoute("/fr/implantations/auvergne-rhone-alpes/grenoble")).toBe(false);
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
