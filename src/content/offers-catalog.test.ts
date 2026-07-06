/**
 * T-33 — Catalogue typé requêtable `offers-catalog.ts` (ADR-CB-11, doc 16 G-1).
 *
 * Vérifie : complétude + URL résoluble · prix = SSOT (0 hardcodé) · inversion
 * ETI 1 900 € conservée · dérivation effectif/durée/format/sujet/vertical sur
 * un échantillon des 5 verticales.
 *
 * ⚠️ Toutes les assertions de prix lisent pricing.ts (SSOT) — JAMAIS de littéral
 * (les prix ont été refondus 2026-06-03 ; les littéraux des docs 16/10 sont périmés).
 */

import { describe, it, expect } from "vitest";
import {
  OFFERS,
  getOfferById,
  getOffersByVertical,
  parseEffectif,
  parseDuree,
  type OfferVertical,
} from "@/content/offers-catalog";
import { INTERVENTION_TIERS, AUDIT_TIERS, getTierById } from "@/content/pricing";
import { isKnownFrUrl } from "@/lib/offer-url";

describe("T-33 catalogue — complétude & URL", () => {
  it("contient des offres dans les 5 verticales métier", () => {
    const verticals = new Set(OFFERS.map((o) => o.vertical));
    for (const v of ["audit", "formation", "implementation", "sites-web", "un-a-un"] as const) {
      expect(verticals.has(v), `vertical ${v} absente`).toBe(true);
    }
  });

  it("chaque offre a une urlFR résoluble (∈ routes connues, FR)", () => {
    for (const o of OFFERS) {
      expect(o.urlFR.startsWith("/fr"), `${o.id} → ${o.urlFR}`).toBe(true);
      expect(isKnownFrUrl(o.urlFR), `${o.id} → ${o.urlFR} hors routes`).toBe(true);
    }
  });

  it("chaque offre a au moins un format (jamais vide)", () => {
    for (const o of OFFERS) {
      expect(o.format.length, `${o.id} sans format`).toBeGreaterThan(0);
    }
  });
});

describe("T-33 catalogue — prix = SSOT (0 hardcodé)", () => {
  it("audit-flash : prixFlat == pricing.ts", () => {
    const offer = getOfferById("audit-flash")!;
    const tier = getTierById(AUDIT_TIERS, "audit-flash");
    expect(offer.prixFlat).toBe(tier.priceFlat); // 1190 (SSOT)
  });

  it("intervention-essentielle : prixMin/prixMax dérivés des sous-tiers réels", () => {
    const offer = getOfferById("intervention-essentielle")!;
    const tier = getTierById(INTERVENTION_TIERS, "intervention-essentielle");
    const subPrices = (tier.subTiers ?? []).map((s) => s.priceFlat);
    expect(offer.prixMin).toBe(Math.min(tier.priceFlat!, ...subPrices));
    expect(offer.prixMax).toBe(Math.max(...subPrices));
  });

  it("intervention-claude : sujet=claude + prix sous-tiers SSOT", () => {
    const offer = getOfferById("intervention-claude")!;
    const tier = getTierById(INTERVENTION_TIERS, "intervention-claude");
    expect(offer.sujet).toBe("claude");
    expect(offer.prixMin).toBe(tier.priceFlat); // entrée = plus petit sous-tier
    expect(offer.prixMax).toBe(Math.max(...(tier.subTiers ?? []).map((s) => s.priceFlat)));
  });
});

describe("T-33 catalogue — inversion ETI assumée (D-ETI-PRIX 🔒)", () => {
  it("audit-strategique-eti garde son plancher 1 900 € (sous-tier réel, non masqué)", () => {
    const eti = getOfferById("audit-strategique-eti")!;
    const tier = getTierById(AUDIT_TIERS, "audit-strategique-eti");
    const etiSub = tier.subTiers![0]!.priceFlat; // 1900
    expect(eti.prixMin).toBe(etiSub);
    // L'inversion : l'ETI (plancher 1 900) n'est PAS artificiellement remontée
    // au-dessus de l'Audit Stratégique PME (qui monte à 9 900 via ses sous-tiers).
    const pme = getOfferById("audit-strategique-pme")!;
    expect(eti.prixMin).toBeLessThanOrEqual(pme.prixMax!);
  });
});

describe("T-33 catalogue — dérivation facettes (échantillon 5 verticales)", () => {
  it("formation collective : intervention-claude → effectif 2-30, 1 jour, présentiel", () => {
    const o = getOfferById("intervention-claude")!;
    expect(o.vertical).toBe<OfferVertical>("formation");
    expect(o.effectifMin).toBe(2);
    expect(o.effectifMax).toBe(30);
    expect(o.dureeJours).toBe(1);
    expect(o.format).toContain("presentiel");
  });

  it("1-to-1 : intervention-dirigeants → effectif 1, vertical un-a-un", () => {
    const o = getOfferById("intervention-dirigeants")!;
    expect(o.effectifMin).toBe(1);
    expect(o.effectifMax).toBe(1);
    expect(o.vertical).toBe<OfferVertical>("un-a-un");
  });

  it("demi-journée : intervention-4h → 4 h / 0.5 j, effectif 2-30", () => {
    const o = getOfferById("intervention-4h")!;
    expect(o.dureeHeures).toBe(4);
    expect(o.dureeJours).toBe(0.5);
    expect(o.effectifMin).toBe(2);
    expect(o.effectifMax).toBe(30);
  });

  it("audit : audit-cible déduit distanciel + mixte (sous-tiers)", () => {
    const o = getOfferById("audit-cible")!;
    expect(o.vertical).toBe<OfferVertical>("audit");
    expect(o.format).toEqual(expect.arrayContaining(["distanciel", "mixte"]));
  });

  it("sites-web : codage-web → vertical sites-web, range 2000-30000", () => {
    const o = getOfferById("codage-web")!;
    expect(o.vertical).toBe<OfferVertical>("sites-web");
    expect(o.prixMin).toBe(2000);
    expect(o.prixMax).toBe(30000);
  });

  it("implementation : impl-ia-custom → onQuote, mixte", () => {
    const o = getOfferById("impl-ia-custom")!;
    expect(o.vertical).toBe<OfferVertical>("implementation");
    expect(o.onQuote).toBe(true);
    expect(o.prixMin).toBeUndefined();
  });

  it("un-à-un récurrent → vertical un-a-un, prixFlat 790, effectif 1", () => {
    const o = getOfferById("un-a-un-recurrent")!;
    expect(o.vertical).toBe<OfferVertical>("un-a-un");
    expect(o.prixFlat).toBe(790);
    expect(o.effectifMax).toBe(1);
  });

  it("onQuote exclut le prix : intervention-conference / sur-demande", () => {
    for (const id of ["intervention-conference", "intervention-sur-demande"]) {
      const o = getOfferById(id)!;
      expect(o.onQuote, `${id} devrait être onQuote`).toBe(true);
      expect(o.prixMin).toBeUndefined();
    }
  });
});

describe("T-33 helpers de parsing", () => {
  it("parseEffectif", () => {
    expect(parseEffectif("2 à 30 personnes")).toEqual({ min: 2, max: 30 });
    expect(parseEffectif("1 dirigeant (1-to-1)")).toEqual({ min: 1, max: 1 });
    expect(parseEffectif(undefined)).toEqual({});
  });
  it("parseDuree", () => {
    expect(parseDuree("1 journée")).toEqual({ jours: 1 });
    expect(parseDuree("2 jours")).toEqual({ jours: 2 });
    expect(parseDuree("Demi-journée (4 h)")).toEqual({ jours: 0.5, heures: 4 });
  });
  it("getOffersByVertical", () => {
    expect(getOffersByVertical("audit").length).toBeGreaterThanOrEqual(4);
  });
});
