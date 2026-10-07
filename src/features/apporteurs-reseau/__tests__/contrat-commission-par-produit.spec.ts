import { describe, expect, it } from "vitest";

import { CONTRAT_V2_MARKDOWN, CONTRAT_VERSION } from "../contrat-v2";

// Décision de Will (07/10/2026) : la commission reste liée à CHAQUE produit, et un produit créé
// après la signature reçoit la commission publiée — sans avenant, jamais à zéro par défaut,
// jamais rétroactive. Le filet des soixante jours reste.
const texte = CONTRAT_V2_MARKDOWN.replace(/\s+/g, " ");

describe("contrat 2.1 : commission par produit et produits nouveaux", () => {
  it("la version du texte signé change", () => {
    // 2.1 a introduit A1.7 ; les versions suivantes le gardent (2.2 le 07/10).
    expect(Number(CONTRAT_VERSION)).toBeGreaterThanOrEqual(2.1);
  });

  it("A1.7 : produits listés, produits créés après la signature, non-rétroactivité, motivation", () => {
    expect(texte).toContain("A1.7 — Produits créés après la signature");
    expect(texte).toContain(
      "conserve la commission que lui attribue le présent contrat tant que la Société le propose",
    );
    expect(texte).toContain(
      "sa commission est celle que la grille de référence publiée par la Société lui attribue à la date de la vente",
    );
    expect(texte).toContain("la publie, datée, avant toute vente de ce produit");
    expect(texte).toContain("La commission ainsi publiée n'est jamais rétroactive");
    expect(texte).toContain("article 1164 du code civil");
  });

  it("le filet des soixante jours reste, et le retrait d'un produit ne retire rien", () => {
    expect(texte).toContain("La situation est réglée dans les soixante jours de l'encaissement");
    expect(texte).toContain("la commission est due au taux ou au forfait que la grille publiée");
    expect(texte).toContain(
      "Le retrait d'un produit de l'offre de la Société n'affecte ni les commissions acquises ni les attributions en cours",
    );
  });

  it("4.1, 13.1 et 17 renvoient à A1.7 (pas d'avenant pour un produit nouveau)", () => {
    expect(texte).toContain("Les produits créés après la signature relèvent de l'annexe 1, A1.7.");
    expect(texte).toContain(
      "La publication de la commission d'un produit créé après la signature (annexe 1, A1.7) n'est pas une modification du contrat.",
    );
    expect(texte).toContain(
      "et de la grille de référence publiée, pour les seuls produits créés après la signature (annexe 1, A1.7)",
    );
  });
});
