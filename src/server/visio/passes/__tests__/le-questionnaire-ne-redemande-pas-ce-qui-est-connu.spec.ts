/**
 * ⛔ LE QUESTIONNAIRE NE REDEMANDE PAS CE QUI EST CONNU (PR 7, P6) — le versant
 * « passe » de `le-questionnaire-ne-repete-pas-ce-qu-a-dit-un-collegue` (la
 * règle commune G15 `repeteUnCollegue`, PR 6, testée dans `verification/`).
 *
 * Ce qui est déjà connu et validé — même dit par un AUTRE interlocuteur du
 * client — part dans `deja_connu` (références C…). Une question qui s'appuie
 * sur une référence C… est RETIRÉE par le code (`deja_connu`) ; seules les
 * questions ouvertes (Q…) et les rubriques jamais abordées (T…) peuvent
 * fonder une question. Et rien d'un autre projet n'est envoyé.
 *
 * Mutation qui rougit : retirer le test `nature === "connu"` de
 * `verifierQuestionnaire`, ou ranger un fait d'un autre projet dans l'entrée.
 * Contre-témoin : une question fondée sur une question ouverte est gardée, et
 * porte son fait source.
 * Angle mort : une question qui redemande un fait connu SANS le citer en
 * source n'est pas détectée par le code : la consigne l'interdit, et Will relit
 * le texte avant de le copier.
 */

import { describe, expect, it } from "vitest";

import type { QuestionnaireV1 } from "../../schemas/autres";
import {
  construireEntreeP6,
  verifierQuestionnaire,
  type FaitPourQuestionnaire,
} from "../p6-questionnaire";

const P = "projet-1";
const f = (
  p: Partial<FaitPourQuestionnaire> & Pick<FaitPourQuestionnaire, "id" | "type">,
): FaitPourQuestionnaire => ({
  portee: "projet",
  projetId: P,
  statut: "valide",
  suivi: null,
  enonce: "énoncé fictif",
  ...p,
});

const faits = [
  // Dit par un collègue (autre contact du client) : déjà connu.
  f({
    id: "nb",
    type: "nb_participants",
    enonce: "12 commerciaux à former",
    contactLocuteurId: "c-karim",
  }),
  f({ id: "q1", type: "question_ouverte", suivi: "ouvert", enonce: "Qui valide le budget ?" }),
  f({ id: "autre", type: "besoin", projetId: "projet-2", enonce: "Besoin d'un AUTRE projet" }),
];

function question(
  id: string,
  sources: string[],
  rubrique: QuestionnaireV1["questions"][number]["rubrique"],
) {
  return {
    id,
    texte: `Question ${id} ?`,
    type_reponse: "texte_court" as const,
    choix: [],
    aide: null,
    facultative: false,
    rubrique,
    sources,
    utilite_pour_williams: "pour chiffrer",
  };
}

describe("⛔ le questionnaire ne répète pas ce qu'a dit un collègue", () => {
  const { entree, refs } = construireEntreeP6({
    projet: { id: P, titre: "Formation" },
    faits,
    trous: [4],
  });

  it("ce qui est connu part en C…, rien d'un autre projet", () => {
    expect(entree).toMatch(/C001 \| nb_participants \| 12 commerciaux/);
    expect(entree).not.toContain("AUTRE projet");
    expect(entree).toMatch(/Q001 \| Qui valide le budget/);
    expect(entree).toMatch(/T04 \| besoins/);
  });

  it("une question fondée sur un fait connu est retirée", () => {
    const b = verifierQuestionnaire(
      { introduction: "", conclusion: "", questions: [question("Q1", ["C001"], "perimetre")] },
      refs,
    );
    expect(b.questions).toHaveLength(0);
    expect(b.retirees).toEqual([{ id: "Q1", motif: "deja_connu" }]);
  });

  it("G15 : une question qui reprend le nombre d'un collègue, même sans le citer, est retirée", () => {
    const repete = {
      ...question("Q1", ["T04"], "besoins"),
      texte: "Les 12 commerciaux sont-ils tous concernés ?",
    };
    const b = verifierQuestionnaire(
      { introduction: "", conclusion: "", questions: [repete] },
      refs,
      "c-sophie",
    );
    expect(b.retirees).toEqual([{ id: "Q1", motif: "repete_un_collegue" }]);
    // Ce que le destinataire a dit lui-même peut être repris.
    const admis = verifierQuestionnaire(
      { introduction: "", conclusion: "", questions: [repete] },
      refs,
      "c-karim",
    );
    expect(admis.questions).toHaveLength(1);
  });

  it("contre-témoin : une question ouverte et un trou fondent des questions", () => {
    const b = verifierQuestionnaire(
      {
        introduction: "",
        conclusion: "",
        questions: [question("Q1", ["Q001"], "decision"), question("Q2", ["T04"], "besoins")],
      },
      refs,
    );
    expect(b.questions.map((q) => q.faitSourceId)).toEqual(["q1", null]);
    expect(b.questions.map((q) => q.typeVise)).toEqual(["decideur", "besoin"]);
  });
});
