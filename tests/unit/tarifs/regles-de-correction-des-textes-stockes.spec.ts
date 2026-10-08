// Les règles de `scripts/tarifs/corriger-formules-erronees.ts` (2026-10-08, relecture de a1) :
// LISTER tout ancien montant, ne CORRIGER automatiquement que le SÛR, ne rien supprimer, être
// idempotent. Les cas non sûrs sont rendus « à revoir » : Will tranche sur l'essai à blanc.
import { describe, expect, it } from "vitest";

import { FORMATION_PRICE_MATRIX } from "@/content/pricing";
import { fmtNumber } from "@/lib/intl";

import {
  analyserTexte,
  contientFormuleErronee,
  corrigerJson,
  corrigerTexte,
} from "../../../scripts/tarifs/formules-erronees-regles";

const UN_JOUR = `${fmtNumber(FORMATION_PRICE_MATRIX.generale["1j"]!, "fr")} €`;
const DEUX_JOURS = `${fmtNumber(FORMATION_PRICE_MATRIX.generale["2j"]!, "fr")} €`;
const UN_JOUR_EN = `€${fmtNumber(FORMATION_PRICE_MATRIX.generale["1j"]!, "en")}`;

describe("corrigé automatiquement : le SÛR", () => {
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
    ["L'Intervention Claude coûte 2 650 €.", `La formation d'une journée coûte ${UN_JOUR}.`],
    [
      "Prix : {{price:intervention-essentielle|flat}}",
      "Prix : {{price:formation-generale-1j|flat}}",
    ],
    ["Prix : {{price:intervention-approfondie}}", "Prix : {{price:formation-generale-2j}}"],
    ["One training day costs €2,450 per group.", `One training day costs ${UN_JOUR_EN} per group.`],
    // (5) Le point de milliers ne coupe plus la phrase.
    ["La formation coûte 2.450 € HT.", `La formation coûte ${UN_JOUR} HT.`],
    // (3) Majuscule de tête.
    ["Formule Essentielle pour 8 personnes.", "Formule d'une journée pour 8 personnes."],
    ["Formation Approfondie sur site.", "Formation de deux jours sur site."],
    // (4) Guillemets avec espaces insécables.
    ["La formule « Essentielle » convient.", "La formule d'une journée convient."],
    [
      "Essentielle (1 jour) pour 2 à 15 personnes.",
      "formation d'une journée (1 jour) pour 2 à 15 personnes.",
    ],
  ])("%s", (avant, apres) => {
    expect(corrigerTexte(avant).texte).toBe(apres);
  });
});

describe("listé mais NON corrigé : à revoir par Will", () => {
  it.each([
    // (1) Contexte trop faible : pas de nom de formule, pas de « formation ».
    "Une analyse approfondie du budget : 2 450 € par mois.",
    "Loyer de 3 250 €.",
    // (5) Un champ qui ne contient que le prix.
    "Prix : 2 450 € HT",
  ])("%s", (t) => {
    const a = analyserTexte(t);
    expect(a.texte).toBe(t);
    expect(a.changements).toEqual([]);
    expect(a.aRevoir).toHaveLength(1);
    expect(contientFormuleErronee(t)).toBe(true);
  });
});

describe("jamais touché, jamais listé", () => {
  it.each([
    "Une Analyse Approfondie des données révèle trois gisements.",
    "Notre démarche Essentielle : écouter avant de proposer.",
    "Bureau au 2450 route de Lyon, audit dès 1 190 €, pour gagner du temps au quotidien.",
    // (2) Un nombre plus long n'est pas le nôtre.
    "A €2,450,000 budget for the whole group.",
    "Une levée de 2 450 000 € pour la formation.",
    "Un chiffre d'affaires de 12 450 € en formation.",
  ])("%s", (t) => {
    const a = analyserTexte(t);
    expect(a).toEqual({ texte: t, changements: [], aRevoir: [] });
    expect(contientFormuleErronee(t)).toBe(false);
  });
});

describe("idempotence et intégrité", () => {
  it("un texte corrigé ne change plus", () => {
    const une = corrigerTexte(
      "La formule Essentielle à 2 450 € puis la formule Approfondie à 3 250 €.",
    ).texte;
    expect(analyserTexte(une)).toEqual({ texte: une, changements: [], aRevoir: [] });
  });

  it("rien n'est supprimé autour du remplacement", () => {
    const r = corrigerTexte("Avant. La journée Essentielle. Après, encore du texte.").texte;
    expect(r).toBe("Avant. La formation d'une journée. Après, encore du texte.");
  });
});

describe("corrigerJson", () => {
  it("corrige les chaînes sûres, liste les autres, ne touche jamais les clés", () => {
    const r = corrigerJson({
      Essentielle: 2450,
      faqs: [{ q: "Prix de l'Essentielle ?", a: "2 450 € la journée." }],
    });
    expect(r.valeur).toEqual({
      Essentielle: 2450,
      faqs: [{ q: "Prix de la formation d'une journée ?", a: "2 450 € la journée." }],
    });
    expect(r.changements.length).toBeGreaterThan(0);
    expect(r.aRevoir).toEqual(["2 450 € la journée."]);
  });
});
