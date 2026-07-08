/**
 * Tests — deck-pdf : le diaporama 16:9 se rend en vrai PDF.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { construireDeck } from "./deck-builder";
import { DeckPdf } from "./deck-pdf";
import { CONTENU_DETAILLE_VERSION, type ContenuDetaille } from "../../engine/content-schema";

const CONTENU: ContenuDetaille = {
  version: CONTENU_DETAILLE_VERSION,
  modalite: "presentiel",
  modules: [
    {
      moduleId: "M1",
      titre: "Bien démarrer avec l'IA",
      introduction: "Comprendre à quoi sert l'IA au quotidien professionnel.",
      sequences: [
        {
          titre: "Un premier prompt utile",
          dureeMin: 30,
          concepts: [
            { titre: "Le contexte", explication: "Donner le rôle et le but améliore le résultat." },
          ],
          exempleConcret: "Reformuler un email client trop direct.",
          pointsVigilance: [],
          noteFormateur: "Faire tester en direct.",
        },
      ],
      synthese: "Un bon prompt commence par le contexte.",
      quiz: [
        {
          question: "Par quoi commencer un prompt ?",
          options: ["Le contexte", "La conclusion"],
          bonneReponseIndex: 0,
          explication: "Le contexte cadre la réponse.",
        },
      ],
    },
  ],
};

describe("deck-pdf", () => {
  it("rend un buffer PDF 16:9 (%PDF)", async () => {
    const deck = construireDeck({ titreFormation: "IA Express", contenuDetaille: CONTENU });
    const { buffer, sizeBytes } = await renderPdfToBuffer(React.createElement(DeckPdf, { deck }));
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(sizeBytes).toBeGreaterThan(1000);
  });
});
