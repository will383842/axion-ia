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
  it("laisse passer le seul prix public : la Journée IA (1 490 € HT)", () => {
    const r = verifyOutput("La Journée IA est à 1 490 € HT.");
    expect(r.ok).toBe(true);
  });

  it("R7 : bloque un prix de la grille interne masqué au public (1 190 € HT)", () => {
    const r = verifyOutput("L'audit sur place est à 1 190 € HT.");
    expect(r.ok).toBe(false);
    expect(r.violations[0]?.reason).toMatch(/sur devis/);
  });

  it("bloque un prix inventé (1 234 €)", () => {
    const r = verifyOutput("Cette formation coûte 1 234 € HT.");
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.type === "price" && v.value.includes("1234"))).toBe(true);
  });

  it("R7 : bloque les deux bornes d'un range masqué (2 000 € → 30 000 €)", () => {
    const r = verifyOutput("Le développement va de 2 000 € à 30 000 € HT.");
    expect(r.violations.filter((v) => v.type === "price")).toHaveLength(2);
  });

  it("ne flague pas « /mois » dans « 290 € HT/mois » comme URL", () => {
    const r = verifyOutput("La maintenance est à 290 € HT/mois.");
    expect(r.violations.some((v) => v.type === "url")).toBe(false);
  });

  it("extractCitedPrices normalise les espaces", () => {
    expect(extractCitedPrices("1 190 € et 2 450 €")).toEqual([1190, 2450]);
  });

  it("KNOWN_PRICES contient les prix réels de pricing.ts", () => {
    expect(KNOWN_PRICES.has(1190)).toBe(true);
    expect(KNOWN_PRICES.has(1900)).toBe(true);
    // 2026-10-08 : les prix erronés des anciennes formules ne sont plus « connus » — le
    // chatbot qui les citerait serait arrêté par la garde de sortie.
    expect(KNOWN_PRICES.has(2450)).toBe(false);
    expect(KNOWN_PRICES.has(2650)).toBe(false);
    expect(KNOWN_PRICES.has(3250)).toBe(false);
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
      "La Journée IA (1 490 € HT) ; les formations sont sur devis : voir /fr/formations pour les détails.",
    );
    expect(r.ok).toBe(true);
  });
});

describe("doctrine des interdits en sortie (lot R3)", () => {
  it("bloque une réponse qui cite Qualiopi", () => {
    const r = verifyOutput(`Notre formation est ${"certifi" + "ée"} Qualiopi.`);
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.type === "interdit" && v.value === "qualiopi")).toBe(true);
  });

  it("bloque un financement présenté comme intégral", () => {
    const r = verifyOutput("Votre formation est financée à 100 % par votre OPCO.");
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.type === "interdit")).toBe(true);
  });

  it("laisse passer « Réservez votre créneau de 45 minutes » (parcours principal)", () => {
    expect(verifyOutput("Réservez votre créneau de 45 minutes.").ok).toBe(true);
  });

  // Indépendant de l'ordre de fusion avec le lot R6 (filtre local de l'étiquette).
  it("laisse passer « …les TPE et PME… » et bloque l'étiquette « TPE/PME »", () => {
    expect(verifyOutput("Axion-IA accompagne les TPE et PME françaises.").ok).toBe(true);
    const r = verifyOutput("Axion-IA accompagne les TPE/PME françaises.");
    expect(r.violations.some((v) => v.type === "interdit" && v.value === "etiquette-tpe-pme")).toBe(
      true,
    );
  });

  it("laisse passer une réponse propre", () => {
    expect(verifyOutput("Réservons un rendez-vous gratuit de 45 minutes.").ok).toBe(true);
  });
});
