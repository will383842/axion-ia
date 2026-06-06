/**
 * Tests — anti-hallucination.ts
 *
 * Vérifie :
 * - Détection de « 80% »
 * - Détection de « ROI »
 * - Détection de « nous garantissons »
 * - Détection d'autres patterns (€, $, garantir, assurer, certifier, promettre, aucun risque)
 * - Texte neutre : aucune détection
 * - hasUnsourcedClaims retourne true/false
 */

import { describe, it, expect } from "vitest";
import { detectUnsourcedClaims, hasUnsourcedClaims } from "./anti-hallucination";

describe("detectUnsourcedClaims", () => {
  it("détecte un pourcentage : « 80% »", () => {
    const claims = detectUnsourcedClaims("Nos formations augmentent la productivité de 80%.");
    expect(claims.length).toBeGreaterThanOrEqual(1);
    const types = claims.map((c) => c.type);
    expect(types).toContain("chiffre_pourcentage");
  });

  it("détecte « ROI »", () => {
    const claims = detectUnsourcedClaims("Le ROI de cette formation est exceptionnel.");
    const types = claims.map((c) => c.type);
    expect(types).toContain("roi_non_source");
  });

  it("détecte « nous garantissons »", () => {
    const claims = detectUnsourcedClaims(
      "Nous garantissons votre succès à l'issue de la formation.",
    );
    const types = claims.map((c) => c.type);
    expect(types).toContain("promesse_absolue_garantir");
  });

  it("détecte « garanti » (adjectif)", () => {
    const claims = detectUnsourcedClaims("Résultat garanti en 3 semaines.");
    const types = claims.map((c) => c.type);
    expect(types).toContain("promesse_absolue_garantir");
  });

  it("détecte un montant en euros : « 500€ »", () => {
    const claims = detectUnsourcedClaims("Économisez 500€ grâce à cette formation.");
    const types = claims.map((c) => c.type);
    expect(types).toContain("montant_monetaire");
  });

  it("détecte un montant en dollars : « $200 »", () => {
    const claims = detectUnsourcedClaims("Save $200 with our program.");
    const types = claims.map((c) => c.type);
    expect(types).toContain("montant_monetaire");
  });

  it("détecte « assurer » (verbe)", () => {
    const claims = detectUnsourcedClaims("Nous assurons une montée en compétence rapide.");
    const types = claims.map((c) => c.type);
    expect(types).toContain("promesse_absolue_assurer");
  });

  it("détecte « certifier » (variante)", () => {
    const claims = detectUnsourcedClaims("Nous certifions votre expertise.");
    const types = claims.map((c) => c.type);
    expect(types).toContain("promesse_absolue_certifier");
  });

  it("détecte « promettons »", () => {
    const claims = detectUnsourcedClaims("Nous promettons des résultats visibles.");
    const types = claims.map((c) => c.type);
    expect(types).toContain("promesse_absolue_promettre");
  });

  it("détecte « aucun risque »", () => {
    const claims = detectUnsourcedClaims("Il n'y a aucun risque à se lancer.");
    const types = claims.map((c) => c.type);
    expect(types).toContain("promesse_zero_risque");
  });

  it("texte neutre : aucune détection", () => {
    const texte = `
Ce module aborde les fondamentaux de l'IA générative.
Les participants explorent des cas d'usage métier et réalisent des exercices pratiques.
La progression pédagogique suit la taxonomie de Bloom.
    `.trim();
    const claims = detectUnsourcedClaims(texte);
    expect(claims).toHaveLength(0);
  });

  it("retourne le fragment exact dans claim", () => {
    const claims = detectUnsourcedClaims("Gain de productivité de 45%.");
    const found = claims.find((c) => c.type === "chiffre_pourcentage");
    expect(found?.claim).toContain("45");
    expect(found?.claim).toContain("%");
  });
});

describe("hasUnsourcedClaims", () => {
  it("retourne true si allégation détectée", () => {
    expect(hasUnsourcedClaims("ROI garanti à 100%")).toBe(true);
  });

  it("retourne false pour texte neutre", () => {
    expect(
      hasUnsourcedClaims("Cette formation aborde les bonnes pratiques de la gestion de projet."),
    ).toBe(false);
  });
});
