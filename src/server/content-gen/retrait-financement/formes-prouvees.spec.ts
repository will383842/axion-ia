/**
 * Principe « formes prouvées » : le script ne RÉÉCRIT une énumération que dans des formes simples
 * (phrase entière, parenthèse, énumération française « A, B, X et C. », puces). Tout le reste est
 * ambigu (tranché à la main par override). Un ambigu de trop coûte une minute ; un texte faux en
 * production est inacceptable.
 */
import { describe, expect, it } from "vitest";
import { reecrireHtml, reecrireTexte } from "./regles";

const ambigu = (r: { ambigus: string[]; modifie: boolean; valeur: string }, origine: string) => {
  expect(r.ambigus.length).toBeGreaterThan(0);
  expect(r.modifie).toBe(false);
  expect(r.valeur).toBe(origine);
};

describe("formes NON prouvées → ambigu", () => {
  it.each([
    "We offer audit, training, OPCO funding and follow-up.",
    "Nous proposons audit, formation, financement OPCO et suivi, puis un bilan.",
    "Nous proposons audit, formation, financement OPCO ou France Travail et suivi.",
    "Nous proposons audit, formation ainsi que financement OPCO et suivi.",
    "Nous proposons audit, financement OPCO, financement CPF et suivi.",
  ])("%s", (entree) => {
    ambigu(reecrireTexte(entree, "fr"), entree);
  });

  it("balise en ligne dans un paragraphe dont la mention n'est pas la phrase entière", () => {
    const html =
      "<p>Nous proposons audit, <strong>formation</strong>, financement OPCO et suivi.</p>";
    ambigu(reecrireHtml(html, "fr"), html);
  });
});

describe("formes prouvées → réécrites", () => {
  it.each([
    [
      "Nous proposons audit, formation, financement OPCO et suivi.",
      "Nous proposons audit, formation et suivi.",
    ],
    [
      "Nous proposons l'audit, la formation, le financement OPCO et le suivi.",
      "Nous proposons l'audit, la formation et le suivi.",
    ],
    ["Les 3 piliers sont audit, financement OPCO et suivi.", "Les 2 piliers sont audit et suivi."],
    [
      "Nos 4 offres : audit, formation, financement OPCO et suivi.",
      "Nos 3 offres : audit, formation et suivi.",
    ],
  ])("%s", (entree, attendu) => {
    const r = reecrireTexte(entree, "fr");
    expect(r.ambigus).toEqual([]);
    expect(r.valeur).toBe(attendu);
  });
});

describe("propriété : aucune perte de mot hors élément visé", () => {
  const PHRASES = [
    "We offer audit, training, OPCO funding and follow-up.",
    "We offer audit, OPCO funding, training and coaching.",
    "Our team provides audit or OPCO funding.",
    "You get coaching, CPF funding and a final report.",
    "Nous proposons audit, formation, financement OPCO et suivi.",
    "Nous proposons audit, financement OPCO, formation et suivi.",
    "Nous proposons audit, formation et financement OPCO.",
    "Nous proposons audit, formation, financement OPCO et suivi, puis un bilan.",
    "Nous proposons audit, formation, financement OPCO ou France Travail et suivi.",
    "Nous proposons audit, formation ainsi que financement OPCO et suivi.",
    "Nous proposons l'audit, la formation, le financement OPCO et le suivi.",
    "Nos 4 offres : audit, formation, financement OPCO et suivi.",
    "Les 3 piliers sont audit, financement OPCO et suivi.",
    "Éligible au CPF, la formation est courte.",
    "Nos audits Qualiopi sont réalisés sur site.",
    "La formation dure 3 jours (financement OPCO possible) et s'adapte à vous.",
    "Audit, financement OPCO ou suivi.",
    "La formation se déroule chez vous, elle est finançable par un OPCO, et un rapport est remis.",
    "Nous réalisons un audit et un financement OPCO sont possibles.",
    "Des aides comme BPI France, les fonds de votre OPCO ou France Num existent.",
    "Vous gérez les dossiers CPF, la facturation et les relances clients.",
    "We run audits, handle CPF files and send weekly reports.",
    "Le suivi, la prise en charge OPCO et le bilan final sont inclus.",
    "Nous vous accompagnons, nous montons le dossier OPCO et nous suivons le résultat.",
    "Formation courte, financement OPCO, accompagnement personnalisé et bilan.",
    "Training, coaching and CPF funding are available for all teams.",
    "Notre équipe réalise l'audit, la mise en place et le financement OPCO.",
    "Offres : audit, formation, financement OPCO, suivi.",
    "Nous proposons audit, formation, financement OPCO, financement CPF et suivi.",
    "Prenez rendez-vous, nous étudions votre financement OPCO et nous vous rappelons.",
  ];
  const mots = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,:;()!?]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  const VISES = /financ|opco|cpf|qualiopi|travail|charge|funding|ligible/;

  it.each(PHRASES)("%s", (entree) => {
    const r = reecrireTexte(entree, "fr");
    if (r.ambigus.length > 0) return;
    // Mots de l'entrée absents de la sortie (multiensemble), hors connecteur et nombre ajustés.
    const reste = mots(r.valeur);
    const perdus: string[] = [];
    for (const m of mots(entree)) {
      const k = reste.indexOf(m);
      if (k >= 0) reste.splice(k, 1);
      else if (!/^(et|ou|\d+)$/.test(m)) perdus.push(m);
    }
    if (perdus.length === 0) return;
    // Ce qui disparaît est UN seul fragment contigu (l'élément visé) et il porte la mention visée.
    const m = mots(entree);
    const idx = perdus.map((x) => m.indexOf(x)).sort((x, y) => x - y);
    expect(perdus.some((x) => VISES.test(x))).toBe(true);
    expect(idx[idx.length - 1]! - idx[0]! + 1).toBeLessThanOrEqual(perdus.length + 2);
  });

  it("verbe après le dernier élément : ambigu, rien n'est perdu", () => {
    const e = "Des aides comme BPI France, les fonds de votre OPCO ou France Num existent.";
    ambigu(reecrireTexte(e, "fr"), e);
  });
});
