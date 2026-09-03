/**
 * Garde — aucun type de pièce ne se présente au certificateur sous sa valeur
 * d'énumération.
 *
 * ## Ce que cette garde a vu rougir avant d'être écrite
 *
 * Sur les huit types réellement affichés à l'auditrice le 2026-09-02, SEPT
 * retombaient sur le repli `« ${type} »` : la vue manifeste et le Markdown remis
 * en séance écrivaient « programme » : 578 pièces, « emargement » : 501 pièces.
 *
 * ## Pourquoi cette garde, alors que le `Record<DocumentType, string>` suffit
 *
 * Le type interdit d'OUBLIER une entrée ; il n'interdit pas d'en écrire une
 * mauvaise. Deux fautes restaient donc possibles, et ce sont exactement celles
 * qui s'étaient produites :
 *   - poser la valeur brute comme libellé (`programme: "programme"`) ;
 *   - laisser une entrée vide.
 * Cette garde-ci les refuse. La liste des types est DÉRIVÉE de l'énumération
 * Prisma, jamais recopiée.
 */

import { describe, it, expect } from "vitest";

import { DocumentType } from "../../../../prisma/generated/client";
import { LIBELLES_TYPE_DOCUMENT, libelleTypeDocument } from "./libelles-type-document";

const TOUS_LES_TYPES = Object.values(DocumentType) as string[];

describe("libellés de type de document", () => {
  it("couvre TOUS les types de l'énumération Prisma (liste dérivée, jamais recopiée)", () => {
    const manquants = TOUS_LES_TYPES.filter(
      (t) => LIBELLES_TYPE_DOCUMENT[t as DocumentType] === undefined,
    );
    expect(manquants).toEqual([]);
    // Témoin de non-vacuité : une énumération vide passerait le test ci-dessus.
    expect(TOUS_LES_TYPES.length).toBeGreaterThan(20);
  });

  it("ne laisse AUCUN libellé égal à sa valeur d'énumération ni vide", () => {
    const fautifs = TOUS_LES_TYPES.filter((t) => {
      const libelle = LIBELLES_TYPE_DOCUMENT[t as DocumentType] ?? "";
      return libelle.trim().length === 0 || libelle === t;
    });
    expect(fautifs).toEqual([]);
  });

  it("n'écrit jamais de snake_case dans un libellé — c'est le symptôme du défaut", () => {
    const fautifs = TOUS_LES_TYPES.filter((t) =>
      /_/.test(LIBELLES_TYPE_DOCUMENT[t as DocumentType] ?? ""),
    );
    expect(fautifs).toEqual([]);
  });

  it("signale VISIBLEMENT un type inconnu au lieu de le faire passer pour un intitulé", () => {
    expect(libelleTypeDocument("type_qui_nexiste_pas")).toBe("« type_qui_nexiste_pas »");
  });

  it("rend le libellé français des types que l'auditrice voit le plus", () => {
    expect(libelleTypeDocument("programme")).toBe("Programme de l'action");
    expect(libelleTypeDocument("emargement")).toBe("Feuille d'émargement");
    expect(libelleTypeDocument("convention")).toBe("Convention de formation");
    expect(libelleTypeDocument("grille_evaluation")).toBe("Grille d'évaluation");
  });
});
