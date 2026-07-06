/**
 * T-39 — output-guard : vérification post-génération prix/URL (doc 16 G-4).
 *
 * Garantit zéro hallucination : prix inventé → bloqué ; URL inexistante → bloquée ;
 * prix SSOT + URL connue → OK. Robustesse : « 290 €/mois » ne flague pas « /mois » ;
 * URL externe ignorée ; range validé des deux côtés.
 */

import { describe, it, expect } from "vitest";
import {
  verifyOutput,
  extractCitedPrices,
  extractCitedUrls,
  KNOWN_PRICES,
} from "@/server/chatbot/security/output-guard";

describe("T-39 prix", () => {
  it("laisse passer un prix SSOT (1 190 € HT)", () => {
    const r = verifyOutput("L'audit sur place est à 1 190 € HT.");
    expect(r.ok).toBe(true);
  });

  it("bloque un prix inventé (1 234 €)", () => {
    const r = verifyOutput("Cette formation coûte 1 234 € HT.");
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.type === "price" && v.value.includes("1234"))).toBe(true);
  });

  it("valide les deux bornes d'un range (2 000 € → 30 000 €)", () => {
    const r = verifyOutput("Le développement va de 2 000 € à 30 000 € HT.");
    expect(r.ok).toBe(true);
  });

  it("ne flague pas « /mois » dans « 290 € HT/mois »", () => {
    const r = verifyOutput("La maintenance est à 290 € HT/mois.");
    expect(r.ok).toBe(true);
  });

  it("extractCitedPrices normalise les espaces", () => {
    expect(extractCitedPrices("1 190 € et 2 450 €")).toEqual([1190, 2450]);
  });

  it("KNOWN_PRICES contient les prix réels de pricing.ts", () => {
    expect(KNOWN_PRICES.has(1190)).toBe(true);
    expect(KNOWN_PRICES.has(2450)).toBe(true);
    expect(KNOWN_PRICES.has(1200)).toBe(true);
    expect(KNOWN_PRICES.has(790)).toBe(true);
    expect(KNOWN_PRICES.has(1234)).toBe(false);
  });
});

describe("T-39 URL", () => {
  it("laisse passer une URL connue", () => {
    expect(verifyOutput("Voir /fr/audit/cible pour les détails.").ok).toBe(true);
  });

  it("bloque une URL inventée", () => {
    const r = verifyOutput("Découvrez /fr/audit/super-premium !");
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.type === "url")).toBe(true);
  });

  it("bloque un lien markdown vers une route inexistante", () => {
    const r = verifyOutput("[Notre offre](/fr/offre-magique-inexistante)");
    expect(r.ok).toBe(false);
  });

  it("laisse passer un lien markdown vers une route connue", () => {
    expect(verifyOutput("[Audit Ciblé](/fr/audit/cible)").ok).toBe(true);
  });

  it("ignore les URLs externes (autre domaine)", () => {
    expect(verifyOutput("Source : https://www.anthropic.com/claude").ok).toBe(true);
  });

  it("bloque une URL absolue inventée sur notre domaine", () => {
    const r = verifyOutput("https://axion-ia.com/fr/page-qui-nexiste-pas");
    expect(r.ok).toBe(false);
  });

  it("extractCitedUrls n'extrait pas « /mois »", () => {
    expect(extractCitedUrls("290 € HT/mois")).not.toContain("/mois");
  });
});

describe("T-39 combiné", () => {
  it("réponse 100 % groundée → ok", () => {
    const r = verifyOutput(
      "L'audit ciblé (2 450 € HT, 1 journée) : voir /fr/audit/cible pour les détails.",
    );
    expect(r.ok).toBe(true);
  });
});
