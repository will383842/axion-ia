/**
 * consoliderFaits — une question passée `repondu` (ou un engagement `tenu`)
 * ne revient plus dans les suivis ouverts.
 *
 * Mutation qui fait rougir : retenir tous les faits suivables, quel que soit
 * leur suivi.
 * Contre-témoin : la question encore `ouvert` y est.
 * Angle mort : une question jamais validée (proposée) n'y est pas non plus ;
 * c'est voulu (l'IA propose, Will valide).
 */

import { describe, expect, it } from "vitest";
import { consoliderFaits } from "../consolider-faits";
import { MAINTENANT, faitProjet } from "./_faits";

const P = "p-1";

describe("une question répondue ne revient pas", () => {
  it("seule la question ouverte est un suivi ouvert", () => {
    const ouverte = faitProjet(P, {
      type: "question_ouverte",
      enonce: "Combien de sites ?",
      suivi: "ouvert",
    });
    const repondue = faitProjet(P, {
      type: "question_ouverte",
      cle: "q2",
      enonce: "Quel OPCO ?",
      suivi: "repondu",
    });
    const tenu = faitProjet(P, {
      type: "engagement_axion",
      enonce: "Envoyer le programme",
      suivi: "tenu",
    });
    const c = consoliderFaits(
      [ouverte, repondue, tenu],
      [{ id: P, derniereReouvertureLe: null }],
      MAINTENANT,
    );
    expect(c.projets[P]?.suivisOuverts.map((f) => f.id)).toEqual([ouverte.id]);
  });
});
