/**
 * G15 — LE QUESTIONNAIRE NE RÉPÈTE PAS CE QU'A DIT UN COLLÈGUE : une question
 * ne reprend aucun nombre ni nom propre dit par une AUTRE personne que son
 * destinataire (P6, PR 7 ; la fonction est posée ici avec les autres gardes).
 */

import { describe, expect, it } from "vitest";

import { repeteUnCollegue } from "../regles";

const VALEURS = [
  { texte: "Le budget est de 3000 euros selon Karim Fictif.", ditParContactId: "c-karim" },
  { texte: "Nous serions 12 personnes.", ditParContactId: "c-sophie" },
];

describe("le questionnaire ne répète pas ce qu'a dit un collègue", () => {
  it("reprendre le montant ou le nom dit par un collègue → retiré", () => {
    expect(repeteUnCollegue("Confirmez-vous le budget de 3000 € ?", "c-sophie", VALEURS)).toBe(
      true,
    );
    expect(repeteUnCollegue("Karim doit-il valider ?", "c-sophie", VALEURS)).toBe(true);
  });

  it("contre-témoin : reprendre ce que le destinataire a dit lui-même est admis", () => {
    expect(repeteUnCollegue("Vous confirmez être 12 personnes ?", "c-sophie", VALEURS)).toBe(false);
    expect(repeteUnCollegue("Quel budget envisagez-vous ?", "c-sophie", VALEURS)).toBe(false);
  });
});
