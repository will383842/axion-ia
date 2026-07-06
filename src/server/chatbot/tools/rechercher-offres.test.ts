/**
 * T-35 — Outil `rechercher_offres` (multi-facettes, déterministe).
 *
 * Couvre : fourchette inclusive/exclusive · onQuote exclu des filtres prix ·
 * combinaison multi-facettes (prix+durée+effectif+sujet) · « le moins cher »
 * trie · Zod refuse payload invalide · chaque résultat porte urlFR.
 */

import { describe, it, expect } from "vitest";
import {
  filterOffers,
  searchOffers,
  rechercherOffres,
  toOfferResult,
  RechercherOffresInputSchema,
} from "@/server/chatbot/tools/rechercher-offres";
import { getOfferById, OFFERS } from "@/content/offers-catalog";

const ctx = { tenantId: "axion-ia" };

describe("T-35 filterOffers — fourchette de prix", () => {
  it("retourne les formations dont la fourchette chevauche [prixMin, prixMax]", () => {
    const res = filterOffers({ vertical: "formation", prixMin: 2400, prixMax: 2700 });
    const ids = res.map((o) => o.id);
    // intervention-essentielle (2450) et intervention-temps (2450) chevauchent.
    expect(ids).toContain("intervention-essentielle");
    // intervention-4h (1200) hors fourchette.
    expect(ids).not.toContain("intervention-4h");
  });

  it("borne basse exclusive : rien sous 1 200 € en formation", () => {
    const res = filterOffers({ vertical: "formation", prixMax: 600 });
    expect(res).toEqual([]);
  });

  it("exclut les offres onQuote des filtres prix", () => {
    const res = filterOffers({ prixMin: 0, prixMax: 1_000_000 });
    expect(res.every((o) => !o.onQuote)).toBe(true);
    expect(res.map((o) => o.id)).not.toContain("intervention-conference");
    expect(res.map((o) => o.id)).not.toContain("impl-mission-pme");
  });
});

describe("T-35 filterOffers — combinaison multi-facettes", () => {
  it("« 1 jour, 8 pers, sujet claude » → Intervention Claude", () => {
    const res = filterOffers({
      vertical: "formation",
      dureeMaxJours: 1,
      effectif: 8,
      sujet: "claude",
    });
    expect(res.map((o) => o.id)).toEqual(["intervention-claude"]);
  });

  it("effectif hors bornes exclut l'offre (50 pers > 30 max)", () => {
    const res = filterOffers({ vertical: "formation", effectif: 50 });
    expect(res.map((o) => o.id)).not.toContain("intervention-essentielle");
  });

  it("filtre format présentiel", () => {
    const res = filterOffers({ vertical: "formation", format: "presentiel" });
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((o) => o.format.includes("presentiel"))).toBe(true);
  });

  it("filtre audience tpe", () => {
    const res = filterOffers({ audience: "tpe" });
    expect(res.every((o) => o.audienceSizes?.includes("tpe"))).toBe(true);
    expect(res.length).toBeGreaterThan(0);
  });
});

describe("T-35 sortOffers — « le moins cher »", () => {
  it("prix_asc classe par prix croissant (sur-devis en fin)", () => {
    const res = searchOffers({ vertical: "formation", tri: "prix_asc" });
    const priced = res.filter((o) => !o.onQuote).map((o) => o.prixMin!);
    const sorted = [...priced].sort((a, b) => a - b);
    expect(priced).toEqual(sorted);
    // le 1er (le moins cher) en formation = intervention-4h (1 200 €).
    expect(res[0]?.id).toBe("intervention-4h");
  });

  it("prix_desc classe par prix décroissant", () => {
    const res = searchOffers({ tri: "prix_desc" }).filter((o) => !o.onQuote);
    const vals = res.map((o) => o.prixMax!);
    expect(vals).toEqual([...vals].sort((a, b) => b - a));
  });
});

describe("T-35 Zod — refuse les payloads invalides", () => {
  it("rejette une vertical inconnue", () => {
    expect(() => RechercherOffresInputSchema.parse({ vertical: "compta" })).toThrow();
  });
  it("rejette un prix négatif", () => {
    expect(() => RechercherOffresInputSchema.parse({ prixMax: -10 })).toThrow();
  });
  it("rejette une clé inconnue (strict)", () => {
    expect(() => RechercherOffresInputSchema.parse({ inconnu: 1 })).toThrow();
  });
  it("accepte un payload vide (toutes facettes optionnelles)", () => {
    expect(() => RechercherOffresInputSchema.parse({})).not.toThrow();
  });
});

describe("T-35 toOfferResult & handler", () => {
  it("chaque résultat porte une urlFR et un prix formaté", async () => {
    const { offres } = await rechercherOffres({ vertical: "formation" }, ctx);
    expect(offres.length).toBeGreaterThan(0);
    for (const o of offres) {
      expect(o.urlFR.startsWith("/fr")).toBe(true);
      expect(o.prix).toMatch(/€|Sur devis/);
    }
  });

  it("formate un prix flat, un range et un sur-devis", () => {
    expect(toOfferResult(getOfferById("intervention-4h")!).prix).toMatch(/1\s?200/);
    expect(toOfferResult(getOfferById("codage-web")!).prix).toMatch(/2\s?000.*30\s?000/);
    expect(toOfferResult(getOfferById("intervention-conference")!).prix).toBe("Sur devis");
  });

  it("handler : 0 match exact → repli (T-36), jamais une liste vide", async () => {
    const { offres, replied } = await rechercherOffres(
      { vertical: "formation", prixMax: 100 },
      ctx,
    );
    expect(replied).toBe(true);
    expect(offres.length).toBeGreaterThan(0);
  });

  it("toutes les offres du catalogue se mappent sans erreur", () => {
    for (const o of OFFERS) expect(() => toOfferResult(o)).not.toThrow();
  });
});
