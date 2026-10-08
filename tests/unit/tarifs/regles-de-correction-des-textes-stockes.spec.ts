// Les règles de `scripts/tarifs/corriger-formules-erronees.ts` (2026-10-08, relectures de a1) :
// LISTER tout ancien montant, ne CORRIGER automatiquement que le SÛR — un montant COLLÉ à un nom
// de formule —, ne rien supprimer, être idempotent. Le reste est « à revoir » : Will tranche.
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

describe("corrigé automatiquement : le SÛR (nom de formule collé au montant, noms, jetons)", () => {
  it.each([
    [
      "La formation Essentielle (2 450 € HT) dure une journée.",
      `La formation d'une journée (${UN_JOUR} HT) dure une journée.`,
    ],
    [
      "l'Approfondie à 3 250 € sur deux jours",
      `la formation de deux jours à ${DEUX_JOURS} sur deux jours`,
    ],
    ["L'Intervention Claude coûte 2 650 €.", `La formation d'une journée coûte ${UN_JOUR}.`],
    // Le point de milliers ne coupe pas la phrase.
    ["La formule Essentielle coûte 2.450 € HT.", `La formule d'une journée coûte ${UN_JOUR} HT.`],
    [
      "Prix : {{price:intervention-essentielle|flat}}",
      "Prix : {{price:formation-generale-1j|flat}}",
    ],
    ["Prix : {{price:intervention-approfondie}}", "Prix : {{price:formation-generale-2j}}"],
    // Majuscule de tête.
    ["Formule Essentielle pour 8 personnes.", "Formule d'une journée pour 8 personnes."],
    ["Formation Approfondie sur site.", "Formation de deux jours sur site."],
    // Guillemets avec espaces insécables.
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
    // Relecture 2 de a1 : « formation » seul, ou un nom loin du montant, ne suffisent pas.
    "Une Analyse Approfondie du budget : 2 450 € par mois.",
    "Une formation IA coûte en moyenne 2 450 € chez les concurrents.",
    "Une analyse approfondie du budget : 2 450 € par mois.",
    "Loyer de 3 250 €.",
    "Prix : 2 450 € HT",
    "Réserver une formation · 2 450 €",
    "One training day costs €2,450 per group.",
  ])("%s", (t) => {
    const a = analyserTexte(t);
    expect(a.texte).toBe(t);
    expect(a.changements).toEqual([]);
    expect(a.aRevoir).toHaveLength(1);
    expect(contientFormuleErronee(t)).toBe(true);
  });

  it("la phrase ne déborde pas d'un paragraphe HTML sur l'autre", () => {
    const t = "<p>Découvrez la formule Essentielle.</p><p>Loyer de 3 250 €</p>";
    const a = analyserTexte(t);
    expect(a.texte).toContain("Loyer de 3 250 €"); // montant intact
    expect(a.aRevoir).toEqual(["Loyer de 3 250 €"]);
  });
});

describe("jamais touché, jamais listé", () => {
  it.each([
    "Une Analyse Approfondie des données révèle trois gisements.",
    "Notre démarche Essentielle : écouter avant de proposer.",
    "Bureau au 2450 route de Lyon, audit dès 1 190 €, pour gagner du temps au quotidien.",
    // Un nombre plus long n'est pas le nôtre.
    "A €2,450,000 budget for the whole group.",
    "Une levée de 2 450 000 € pour la formation.",
    "Un chiffre d'affaires de 12 450 € en formation.",
  ])("%s", (t) => {
    expect(analyserTexte(t)).toEqual({ texte: t, changements: [], aRevoir: [] });
    expect(contientFormuleErronee(t)).toBe(false);
  });
});

describe("idempotence et intégrité", () => {
  it("un texte corrigé ne change plus", () => {
    const une = corrigerTexte(
      "La formule Essentielle à 2 450 € puis la formule Approfondie à 3 250 €.",
    ).texte;
    expect(une).toBe(
      `La formule d'une journée à ${UN_JOUR} puis la formule de deux jours à ${DEUX_JOURS}.`,
    );
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
