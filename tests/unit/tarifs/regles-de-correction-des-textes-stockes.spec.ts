// Les règles de `scripts/tarifs/corriger-formules-erronees.ts` (2026-10-08) : elles remplacent
// SEULEMENT le montant et le nom de formule erronés, ne suppriment rien, et sont idempotentes.
import { describe, expect, it } from "vitest";

import { FORMATION_PRICE_MATRIX } from "@/content/pricing";
import { fmtNumber } from "@/lib/intl";

import {
  contientFormuleErronee,
  corrigerJson,
  corrigerTexte,
} from "../../../scripts/tarifs/formules-erronees-regles";

const UN_JOUR = `${fmtNumber(FORMATION_PRICE_MATRIX.generale["1j"]!, "fr")} €`;
const UN_JOUR_EN = `€${fmtNumber(FORMATION_PRICE_MATRIX.generale["1j"]!, "en")}`;
const DEUX_JOURS = `${fmtNumber(FORMATION_PRICE_MATRIX.generale["2j"]!, "fr")} €`;

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
    const une = corrigerTexte(
      "La formule Essentielle à 2 450 € puis la formule Approfondie à 3 250 €.",
    ).texte;
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

// Relecture de a1 (08/10) : jamais un mot ni un montant hors contexte.
describe("hors contexte : rien ne bouge", () => {
  it.each([
    "Une Analyse Approfondie des données révèle trois gisements.",
    "Notre démarche Essentielle : écouter avant de proposer.",
    "Un loyer de 2 450 € par mois pour ces bureaux.",
    "Budget marketing annuel : 3 250 €.",
  ])("%s", (t) => {
    expect(corrigerTexte(t)).toEqual({ texte: t, changements: [] });
    expect(contientFormuleErronee(t)).toBe(false);
  });
});

describe("en contexte : le nom et le montant", () => {
  it("« Essentielle (1 jour) »", () => {
    expect(corrigerTexte("Essentielle (1 jour) pour 2 à 15 personnes.").texte).toBe(
      "formation d'une journée (1 jour) pour 2 à 15 personnes.",
    );
  });
  it("« « Approfondie » » entre guillemets", () => {
    expect(corrigerTexte("Le format « Approfondie » dure deux jours.").texte).toBe(
      "Le format de deux jours dure deux jours.",
    );
  });
  it("montant en ANGLAIS repéré et corrigé (« €2,450 »)", () => {
    expect(corrigerTexte("One training day costs €2,450 per group.").texte).toBe(
      `One training day costs ${UN_JOUR_EN} per group.`,
    );
  });
  it("« 2 450 € » dans une phrase de formation : corrigé", () => {
    expect(corrigerTexte("La journée de formation est à 2 450 € HT.").texte).toBe(
      `La journée de formation est à ${UN_JOUR} HT.`,
    );
  });
});
