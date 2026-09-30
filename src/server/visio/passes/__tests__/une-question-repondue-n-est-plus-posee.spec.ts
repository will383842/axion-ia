/**
 * Une question répondue n'est plus posée (PR 7, P6).
 *
 *   · une `question_ouverte` dont le suivi n'est plus « ouvert » (répondue,
 *     levée…) n'est pas envoyée à P6 ;
 *   · une question « posée de vive voix » sort du texte à copier.
 *
 * Mutation qui rougit : envoyer toutes les `question_ouverte` validées, quel
 * que soit leur suivi ; ou ignorer `poseeDeViveVoix` dans `texteACopier`.
 * Contre-témoin : la question encore ouverte est bien envoyée.
 */

import { describe, expect, it } from "vitest";

import { construireEntreeP6, texteACopier } from "../p6-questionnaire";

const base = { portee: "projet" as const, projetId: "p", statut: "valide" as const };

describe("une question répondue n'est plus posée", () => {
  it("seules les questions encore ouvertes partent", () => {
    const { entree } = construireEntreeP6({
      projet: { id: "p", titre: "Projet fictif" },
      faits: [
        { ...base, id: "a", type: "question_ouverte", suivi: "repondu", enonce: "Déjà répondue" },
        { ...base, id: "b", type: "question_ouverte", suivi: "ouvert", enonce: "Encore ouverte" },
      ],
      trous: [],
    });
    expect(entree).not.toContain("Déjà répondue");
    expect(entree).toContain("Encore ouverte");
  });

  it("une question posée de vive voix n'est pas dans le texte à copier", () => {
    const t = texteACopier([
      { texte: "Combien de personnes ?", poseeDeViveVoix: true },
      { texte: "Pour quelle date ?", poseeDeViveVoix: false },
    ]);
    expect(t).not.toContain("Combien de personnes");
    expect(t).toContain("1. Pour quelle date ?");
  });
});
