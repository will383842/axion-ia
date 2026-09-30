/**
 * G11 — UN FAIT ANCIEN N'EST JAMAIS RECONFIRMÉ SANS CITATION DU JOUR : un
 * `suivi_du_connu` (engagement tenu, question répondue) exige une preuve
 * VÉRIFIÉE de l'échange du jour, et une référence `H…` réellement envoyée.
 */

import { describe, expect, it } from "vitest";

import { FAITS, verifier } from "./outils";

describe("un fait ancien n'est jamais reconfirmé sans citation du jour", () => {
  it("preuve introuvable, ou référence inconnue → le suivi est rejeté", () => {
    const b = verifier(FAITS, {
      suivi_du_connu: [
        {
          connu_ref: "H001",
          statut: "tenu",
          preuve: { segment_ids: ["S0010"], citation: "je vous ai envoyé le programme" },
        },
        {
          connu_ref: "H777",
          statut: "tenu",
          preuve: {
            segment_ids: ["S0010"],
            citation: "Je vous envoie le programme de la formation vendredi",
          },
        },
      ],
    });
    expect(b.suivis).toEqual([]);
    expect(b.suivisRejetes).toBe(2);
  });

  it("contre-témoin : une preuve du jour vérifiée et un H connu → admis", () => {
    const b = verifier(FAITS, {
      suivi_du_connu: [
        {
          connu_ref: "H001",
          statut: "en_cours",
          preuve: {
            segment_ids: ["S0010"],
            citation: "Je vous envoie le programme de la formation vendredi",
          },
        },
      ],
    });
    expect(b.suivis).toEqual([{ connuRef: "H001", statut: "en_cours" }]);
  });
});
