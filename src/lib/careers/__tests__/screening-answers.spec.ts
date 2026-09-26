import { describe, expect, it } from "vitest";
import {
  collectAnswers,
  labeledAnswers,
  missingRequired,
  parseScreeningQuestions,
} from "../screening-answers";

const QUESTIONS = parseScreeningQuestions([
  { id: "prix_court", labelFr: "Prix vidéo verticale", required: true },
  { id: "liens", labelFr: "Liens d'exemples", required: false },
  { labelFr: "sans id — ignorée" },
  null,
]);

function form(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("questions propres à l'offre", () => {
  it("ignore les éléments sans id et un JSON qui n'est pas une liste", () => {
    expect(QUESTIONS.map((q) => q.id)).toEqual(["prix_court", "liens"]);
    expect(parseScreeningQuestions({ id: "x" })).toEqual([]);
    expect(parseScreeningQuestions(null)).toEqual([]);
  });

  it("une question obligatoire vide ou blanche est manquante", () => {
    const answers = collectAnswers(form({ answer_prix_court: "   ", answer_liens: "https://x" }));
    expect(missingRequired(QUESTIONS, answers).map((q) => q.id)).toEqual(["prix_court"]);
  });

  it("une question obligatoire remplie ne manque plus, la facultative peut rester vide", () => {
    const answers = collectAnswers(form({ answer_prix_court: "45 € HT" }));
    expect(missingRequired(QUESTIONS, answers)).toEqual([]);
  });

  it("les réponses partent avec leur libellé, dans l'ordre des questions, tronquées", () => {
    const answers = collectAnswers(
      form({ answer_liens: "https://a", answer_prix_court: "x".repeat(500), autre: "ignoré" }),
    );
    const out = labeledAnswers(QUESTIONS, answers, 10);
    expect(out).toEqual([
      { label: "Prix vidéo verticale", value: `${"x".repeat(10)}…` },
      { label: "Liens d'exemples", value: "https://a" },
    ]);
  });
});
