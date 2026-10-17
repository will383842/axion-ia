/** Chantier QNC, L03 — le GABARIT fixe des rubriques Qualiopi du recueil. */
import { describe, expect, it } from "vitest";

import { decouperQuestion } from "@/server/visio/questionnaire-en-ligne/decouper";

import { MENTION_RGPD, questionsDuGabarit, RUBRIQUES_GABARIT } from "../gabarit";

const toutLeTexte = () =>
  questionsDuGabarit()
    .map((q) => q.texte)
    .join("\n");

describe("gabarit du recueil", () => {
  it("couvre les sept rubriques exigées", () => {
    expect(RUBRIQUES_GABARIT).toEqual([
      "objectifs",
      "participants",
      "niveau_ia",
      "contraintes",
      "financeur",
      "logistique",
      "adaptation",
    ]);
    const rubriques = new Set(questionsDuGabarit().map((q) => q.rubrique));
    for (const r of RUBRIQUES_GABARIT) expect(rubriques.has(r)).toBe(true);
  });

  it("est FIXE : deux appels rendent la même chose, ordre 1..n sans trou", () => {
    expect(questionsDuGabarit()).toEqual(questionsDuGabarit());
    expect(questionsDuGabarit().map((q) => q.ordre)).toEqual(
      questionsDuGabarit().map((_, i) => i + 1),
    );
  });

  it("borne l'effectif de 2 à 15", () => {
    expect(toutLeTexte()).toMatch(/2 à 15/);
  });

  it("demande dates, lieu et présentiel/distanciel", () => {
    const t = toutLeTexte().toLowerCase();
    expect(t).toMatch(/dates/);
    expect(t).toMatch(/lieu/);
    expect(t).toMatch(/présentiel/);
    expect(t).toMatch(/distanciel/);
  });

  it("demande le financeur (OPCO ou paiement direct)", () => {
    expect(toutLeTexte()).toMatch(/OPCO/);
    expect(toutLeTexte().toLowerCase()).toMatch(/paiement direct/);
  });

  it("pose la question de l'adaptation SANS appeler de donnée médicale", () => {
    const q = questionsDuGabarit().find((x) => x.rubrique === "adaptation")!;
    expect(q.texte).toMatch(/adaptation/i);
    expect(q.texte).toMatch(/sans (aucune )?information médicale/i);
    expect(q.texte).toMatch(/ne (précisez|donnez) (ni|pas)/i);
  });

  it("porte la mention RGPD, dans la première question (visible sur la page)", () => {
    expect(MENTION_RGPD).toMatch(/RGPD|données personnelles/i);
    expect(questionsDuGabarit()[0]!.texte).toContain(MENTION_RGPD);
  });

  it("ne demande jamais de prix ni de budget (le devis vient après)", () => {
    expect(toutLeTexte().toLowerCase()).not.toMatch(/budget|tarif|prix/);
  });

  it("chaque question est lisible par la page publique (titre + aide éventuelle)", () => {
    for (const q of questionsDuGabarit()) {
      const d = decouperQuestion(q.texte);
      expect(d.titre.length).toBeGreaterThan(10);
      expect(q.texte.length).toBeLessThanOrEqual(600);
    }
  });
});
