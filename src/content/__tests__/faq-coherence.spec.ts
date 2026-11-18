/**
 * Deux questions identiques (une fois normalisées) posées sur deux pages doivent
 * recevoir la même réponse : une question partagée vient de `questions-reference.ts`.
 * Chaque PR de la série ajoute ici le tableau FAQ de sa page.
 */
import { describe, it, expect } from "vitest";
import { QUESTIONS_REFERENCE } from "../questions-reference";
import { remplacerJetons } from "../journee-ia-commun";
import { CONTENU as ACCUEIL } from "../../app/[locale]/_accueil/contenu";
import { CONTENU as JOURNEE } from "../../app/[locale]/journee-ia/contenu";

interface Entree {
  page: string;
  question: string;
  reponse: string;
}

const normaliser = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const entrees: Entree[] = [
  ...Object.values(QUESTIONS_REFERENCE).map((q) => ({
    page: "référence",
    question: q.question,
    reponse: q.reponse,
  })),
  ...ACCUEIL.faq.questions.map((q) => ({
    page: "accueil",
    question: q.question,
    reponse: q.reponse,
  })),
  ...JOURNEE.faq.map((q) => ({ page: "journee-ia", question: q.question, reponse: q.reponse })),
];

describe("cohérence des FAQ", () => {
  it("une même question reçoit la même réponse partout", () => {
    const parQuestion = new Map<string, Entree[]>();
    for (const e of entrees) {
      const cle = normaliser(e.question);
      parQuestion.set(cle, [...(parQuestion.get(cle) ?? []), e]);
    }
    for (const [cle, liste] of parQuestion) {
      const reponses = new Set(liste.map((e) => normaliser(remplacerJetons(e.reponse))));
      expect(reponses.size, `${cle} : ${liste.map((e) => e.page).join(", ")}`).toBe(1);
    }
  });
});
