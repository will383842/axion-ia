/**
 * ⛔ LE QUESTIONNAIRE NE CONTIENT NI LIEN NI PRIX (PR 7, G14 et G15).
 *
 * Le texte part chez un client : une question qui porte un montant, un mot de
 * prix (tarif, TVA, HT, budget…), un lien, une adresse e-mail ou un téléphone
 * est RETIRÉE — jamais réécrite en silence. Les sujets interdits (objections,
 * concurrence) aussi, et les types interdits ne sont même pas envoyés.
 * 12 questions au plus.
 *
 * Mutation qui rougit : retirer `contientUnPrix` ou `contientUneAdresse` de
 * `verifierQuestionnaire`.
 * Contre-témoin : une question neutre passe.
 * Angle mort : un prix écrit en toutes lettres sans « euro » (« deux mille »)
 * n'est pas reconnu par le motif : la consigne l'interdit, et Will relit.
 */

import { describe, expect, it } from "vitest";

import type { QuestionnaireV1 } from "../../schemas/autres";
import { contientUneAdresse, contientUnPrix } from "../gardes-texte";
import {
  construireEntreeP6,
  MAX_QUESTIONS,
  TYPES_INTERDITS_QUESTIONNAIRE,
  verifierQuestionnaire,
} from "../p6-questionnaire";

const { refs, entree } = construireEntreeP6({
  projet: { id: "p", titre: "Projet fictif" },
  faits: [
    {
      id: "b",
      type: "budget",
      portee: "projet",
      projetId: "p",
      statut: "valide",
      suivi: null,
      enonce: "budget de 3 000 euros",
    },
  ],
  trous: [4, 7, 8],
});

function q(
  id: string,
  texte: string,
  rubrique: QuestionnaireV1["questions"][number]["rubrique"] = "besoins",
) {
  return {
    id,
    texte,
    type_reponse: "texte_court" as const,
    choix: [],
    aide: null,
    facultative: false,
    rubrique,
    sources: ["T04"],
    utilite_pour_williams: "x",
  };
}

describe("⛔ le questionnaire ne contient ni lien ni prix", () => {
  it("les types interdits ne sont pas envoyés, ni la rubrique objections", () => {
    expect(TYPES_INTERDITS_QUESTIONNAIRE.has("budget")).toBe(true);
    expect(entree).not.toContain("3 000");
    expect(entree).not.toMatch(/T08/);
  });

  it.each([
    ["Quel budget prévoyez-vous ?", "prix"],
    ["Un tarif à 1 900 € HT vous convient-il ?", "prix"],
    ["Pouvez-vous lire https://exemple.invalid/fiche ?", "adresse"],
    ["Écrivez-nous à contact@exemple.invalid ?", "adresse"],
    ["Pouvez-vous rappeler au 06 12 34 56 78 ?", "adresse"],
  ])("« %s » est retirée (%s)", (texte, motif) => {
    const b = verifierQuestionnaire(
      { introduction: "", conclusion: "", questions: [q("Q1", texte)] },
      refs,
    );
    expect(b.questions).toHaveLength(0);
    expect(b.retirees[0]?.motif).toBe(motif);
  });

  it("une question sur la concurrence est retirée", () => {
    const b = verifierQuestionnaire(
      {
        introduction: "",
        conclusion: "",
        questions: [q("Q1", "Qui d'autre consultez-vous ?", "objections_concurrence")],
      },
      refs,
    );
    expect(b.retirees[0]?.motif).toBe("sujet_interdit");
  });

  it("12 questions au plus", () => {
    const questions = Array.from({ length: 15 }, (_, i) =>
      q(`Q${i + 1}`, `Combien de personnes, groupe ${i + 1} ?`),
    );
    const b = verifierQuestionnaire({ introduction: "", conclusion: "", questions }, refs);
    expect(b.questions).toHaveLength(MAX_QUESTIONS);
    expect(b.retirees.filter((r) => r.motif === "trop_de_questions")).toHaveLength(3);
  });

  it("contre-témoin : une question neutre passe, les gardes jugent juste", () => {
    const b = verifierQuestionnaire(
      {
        introduction: "",
        conclusion: "",
        questions: [q("Q1", "Quels outils utilisez-vous au quotidien ?")],
      },
      refs,
    );
    expect(b.questions).toHaveLength(1);
    expect(contientUnPrix("Quels outils utilisez-vous ?")).toBe(false);
    expect(contientUneAdresse("Pour quelle date ?")).toBe(false);
  });
});
