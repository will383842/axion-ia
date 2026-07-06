/**
 * T-36 — Module de repli / cross-sell (doc 16 §3, G-5).
 *
 * Vérifie : « jamais de non sec » (toujours ≥ 1 offre proposée) · formation à
 * 400 € → entrée de gamme proche (1 200 €) · atelier 3 h → propose le 4 h (durée
 * voisine) · sujet inconnu → propose le voisin · tri sur sous-tiers réels
 * (inversion ETI) · intégration dans le handler rechercher_offres (replied=true).
 */

import { describe, it, expect } from "vitest";
import { repli } from "@/server/chatbot/catalog/repli";
import { rechercherOffres } from "@/server/chatbot/tools/rechercher-offres";

const ctx = { tenantId: "axion-ia" };

describe("T-36 repli — jamais de « non » sec", () => {
  it("formation à 400 € (rien sous 1 200) → propose le moins cher proche (intervention-4h 1 200)", () => {
    const r = repli({ vertical: "formation", prixMax: 400 });
    expect(r.offres.length).toBeGreaterThan(0);
    expect(r.offres.map((o) => o.id)).toContain("intervention-4h");
  });

  it("atelier de 3 h (0.375 j, aucune offre ≤) → propose la durée voisine (4 h)", () => {
    const r = repli({ vertical: "formation", dureeMaxJours: 0.375 });
    expect(r.strategy).toBe("nearest-duration");
    expect(r.offres[0]?.id).toBe("intervention-4h");
  });

  it("sujet inconnu (« chatgpt ») → relâche le sujet et propose des formations", () => {
    const r = repli({ vertical: "formation", sujet: "chatgpt" });
    expect(r.offres.length).toBeGreaterThan(0);
    expect(r.strategy).toBe("relaxed-sujet");
  });

  it("budget irréaliste sans vertical → entrée de gamme + RDV", () => {
    const r = repli({ prixMax: 10 });
    expect(r.offres.length).toBeGreaterThan(0);
    // ±25 % de 10 = 12 → toujours rien → proximité prix : la moins chère globale.
    expect(["nearest-price", "entry-level"]).toContain(r.strategy);
  });
});

describe("T-36 repli — tri sur sous-tiers réels (inversion ETI)", () => {
  it("audit ~2000 € → proximité de prix inclut l'ETI (plancher 1900) malgré l'inversion", () => {
    const r = repli({ vertical: "audit", prixMin: 1950, prixMax: 2050 });
    // audit-cible (1900-3900) chevauche après élargissement ±25 % (1462-2562).
    expect(r.offres.length).toBeGreaterThan(0);
    // Le tri proximité ne masque pas l'ETI : son prixMin réel (1900) est utilisé.
    const ids = r.offres.map((o) => o.id);
    expect(ids.some((id) => id.startsWith("audit"))).toBe(true);
  });
});

describe("T-36 repli — élargissement ±25 %", () => {
  it("formation 2200-2400 € (rien pile dedans) → élargit et trouve l'essentielle (2450)", () => {
    // 2400 * 1.25 = 3000 → intervention-essentielle (2450) entre.
    const r = repli({ vertical: "formation", prixMin: 2200, prixMax: 2400 });
    expect(r.strategy).toBe("widened-price");
    expect(r.offres.map((o) => o.id)).toContain("intervention-essentielle");
  });
});

describe("T-36 — intégration handler rechercher_offres", () => {
  it("0 match exact → replied=true + offres de repli + stratégie", async () => {
    const res = await rechercherOffres({ vertical: "formation", prixMax: 300 }, ctx);
    expect(res.replied).toBe(true);
    expect(res.offres.length).toBeGreaterThan(0);
    expect(res.repliStrategy).toBeDefined();
    // chaque offre de repli porte une urlFR.
    expect(res.offres.every((o) => o.urlFR.startsWith("/fr"))).toBe(true);
  });

  it("match exact → replied=false (pas de repli)", async () => {
    const res = await rechercherOffres(
      { vertical: "formation", prixMin: 1100, prixMax: 1300 },
      ctx,
    );
    expect(res.replied).toBe(false);
    expect(res.offres.map((o) => o.id)).toContain("intervention-4h");
  });
});
