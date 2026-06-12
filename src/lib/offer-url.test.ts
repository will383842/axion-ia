/**
 * T-34 — Résolveur d'URL FR `offer-url.ts` (ADR-CB-11, doc 16 G-2).
 *
 * Garanties testées :
 *  - toute offre `pricing.ts` (SSOT) a une URL FR résoluble (complétude, 0 oubli) ;
 *  - toute URL résolue ∈ routes connues (0 lien mort), y compris les 3 offres
 *    sans page propre (membre-equipe, sur-demande, conférence) ;
 *  - aucune URL /en/ (FR-only) ; throw sur id inconnu ; isKnownFrUrl correct.
 */

import { describe, it, expect } from "vitest";
import {
  resolveOfferUrl,
  hasResolvableUrl,
  isKnownFrUrl,
  KNOWN_FR_PATHS,
  RESOLVABLE_OFFER_IDS,
} from "@/lib/offer-url";
import { PRICING_CATEGORIES, UN_A_UN_RECURRING_TIER } from "@/content/pricing";

// Tous les ids d'offre réels de la SSOT pricing.ts.
const allPricingOfferIds = [
  ...Object.values(PRICING_CATEGORIES).flatMap((tiers) => tiers.map((t) => t.id)),
  UN_A_UN_RECURRING_TIER.id,
];
// dédoublonne (UN_A_UN_TIERS réexpose intervention-dirigeants).
const uniquePricingIds = [...new Set(allPricingOfferIds)];

describe("T-34 offer-url — complétude SSOT", () => {
  it("toute offre pricing.ts a une URL FR résoluble (0 offre orpheline)", () => {
    const missing = uniquePricingIds.filter((id) => !hasResolvableUrl(id));
    expect(missing, `offres sans URL : ${missing.join(", ")}`).toEqual([]);
  });

  it("le résolveur ne mappe que des ids réels de pricing.ts (pas d'id fantôme)", () => {
    const ghost = RESOLVABLE_OFFER_IDS.filter((id) => !uniquePricingIds.includes(id));
    expect(ghost, `ids fantômes : ${ghost.join(", ")}`).toEqual([]);
  });
});

describe("T-34 offer-url — zéro lien mort", () => {
  it("toute URL résolue pointe vers une route FR connue", () => {
    for (const id of RESOLVABLE_OFFER_IDS) {
      const url = resolveOfferUrl(id);
      expect(url.startsWith("/fr"), `${id} → ${url}`).toBe(true);
      const bare = url.replace(/^\/fr(?=\/|$)/, "") || "/";
      expect(KNOWN_FR_PATHS.has(bare), `${id} → ${url} hors routes`).toBe(true);
    }
  });

  it("les offres sans page propre résolvent vers une route live (pas un 404/301)", () => {
    expect(resolveOfferUrl("intervention-membre-equipe")).toBe("/fr/un-a-un");
    expect(resolveOfferUrl("intervention-sur-demande")).toBe("/fr/demande-devis");
    // Conférence : ancienne offre collective sans page → hub /formations (post-refonte V2).
    expect(resolveOfferUrl("intervention-conference")).toBe("/fr/formations");
  });

  it("couvre les 5+ verticales", () => {
    expect(resolveOfferUrl("audit-cible")).toBe("/fr/audit/cible");
    expect(resolveOfferUrl("intervention-claude")).toBe("/fr/formations");
    expect(resolveOfferUrl("impl-ia-custom")).toBe("/fr/implementation/ia-custom");
    expect(resolveOfferUrl("codage-web")).toBe("/fr/sites-web-augmentes");
    expect(resolveOfferUrl("un-a-un-recurrent")).toBe("/fr/un-a-un");
  });
});

describe("T-34 offer-url — FR-only & robustesse", () => {
  it("ne produit jamais d'URL /en/", () => {
    for (const id of RESOLVABLE_OFFER_IDS) {
      expect(resolveOfferUrl(id)).not.toContain("/en/");
    }
  });

  it("throw sur un id d'offre inconnu (fail-fast, pas de lien deviné)", () => {
    expect(() => resolveOfferUrl("offre-inexistante")).toThrow(/inconnue/);
  });

  it("option absolute préfixe l'origin", () => {
    expect(resolveOfferUrl("audit-cible", { absolute: true, origin: "https://axion-ia.com" })).toBe(
      "https://axion-ia.com/fr/audit/cible",
    );
  });

  it("isKnownFrUrl : accepte les routes connues, rejette l'inconnu et /en/", () => {
    expect(isKnownFrUrl("/fr/audit/cible")).toBe(true);
    expect(isKnownFrUrl("/audit/cible")).toBe(true);
    expect(isKnownFrUrl("https://axion-ia.com/fr/un-a-un?utm=x")).toBe(true);
    expect(isKnownFrUrl("/fr/route-inventee-par-le-llm")).toBe(false);
    expect(isKnownFrUrl("/en/audit/targeted")).toBe(false);
  });
});
