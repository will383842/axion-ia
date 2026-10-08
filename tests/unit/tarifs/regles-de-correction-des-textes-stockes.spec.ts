// Les règles de `scripts/tarifs/corriger-formules-erronees.ts` (2026-10-08) : elles remplacent
// SEULEMENT le montant et le nom de formule erronés, ne suppriment rien, et sont idempotentes.
import { describe, expect, it } from "vitest";

import { FORMATION_PRICE_MATRIX, formatAmount } from "@/content/pricing";

import {
  contientFormuleErronee,
  corrigerJson,
  corrigerTexte,
} from "../../../scripts/tarifs/formules-erronees-regles";

const UN_JOUR = formatAmount(FORMATION_PRICE_MATRIX.generale["1j"]!, "fr");
const DEUX_JOURS = formatAmount(FORMATION_PRICE_MATRIX.generale["2j"]!, "fr");

describe("corrigerTexte", () => {
  it.each([
    ["Réserver une formation · 2 450 €", `Réserver une formation · ${UN_JOUR}`],
    [
      "La formation Essentielle (2 450 € HT) dure une journée.",
      `La formation d'une journée (${UN_JOUR} HT) dure une journée.`,
    ],
    [
      "l'Approfondie à 3 250 € sur deux jours",
      `la formation de deux jours à ${DEUX_JOURS} sur deux jours`,
    ],
    ["L'Intervention Claude coûte 2 650 €.", `La formation d'une journée coûte ${UN_JOUR}.`],
    [
      "Prix : {{price:intervention-essentielle|flat}}",
      "Prix : {{price:formation-generale-1j|flat}}",
    ],
    ["Prix : {{price:intervention-approfondie}}", "Prix : {{price:formation-generale-2j}}"],
  ])("%s", (avant, apres) => {
    expect(corrigerTexte(avant).texte).toBe(apres);
  });

  it("ne touche à rien d'autre : codes postaux, autres montants, mots courants", () => {
    const t = "Bureau au 2450 route de Lyon, audit dès 1 190 €, pour gagner du temps au quotidien.";
    expect(corrigerTexte(t)).toEqual({ texte: t, changements: [] });
    expect(contientFormuleErronee(t)).toBe(false);
  });

  it("idempotent : un texte corrigé ne change plus", () => {
    const une = corrigerTexte("Essentielle à 2 450 € puis Approfondie à 3 250 €.").texte;
    expect(corrigerTexte(une)).toEqual({ texte: une, changements: [] });
    expect(contientFormuleErronee(une)).toBe(false);
  });

  it("ne raccourcit jamais un texte au-delà du remplacement (rien n'est supprimé)", () => {
    const t = "Avant. La journée Essentielle. Après, encore du texte.";
    const r = corrigerTexte(t).texte;
    expect(r.startsWith("Avant. ")).toBe(true);
    expect(r.endsWith(" Après, encore du texte.")).toBe(true);
  });
});

describe("corrigerJson", () => {
  it("corrige les chaînes, jamais les clés ni les autres valeurs", () => {
    const r = corrigerJson({
      Essentielle: 2450,
      faqs: [{ q: "Prix de l'Essentielle ?", a: "2 450 € la journée." }],
    });
    expect(r.valeur).toEqual({
      Essentielle: 2450,
      faqs: [{ q: "Prix de la formation d'une journée ?", a: `${UN_JOUR} la journée.` }],
    });
    expect(r.changements.length).toBeGreaterThan(0);
  });
});
