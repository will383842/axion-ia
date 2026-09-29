/**
 * Le nom normalisé ignore la forme juridique, la casse, les accents et la
 * ponctuation (plan §3.17 point 3, signal 4) ; une faute de frappe (distance
 * ≤ 2) est tolérée pour un nom d'au moins 5 lettres.
 *
 * Mutation qui fait rougir : retirer « sas » de `MOTS_RETIRES_DU_NOM`, ou
 * retirer les formes en SOUS-CHAÎNE (« Sabatier » deviendrait « batier »).
 * Contre-témoin : deux noms vraiment différents ne sont pas proches ; un nom
 * vide ne rapproche rien.
 */

import { describe, expect, it } from "vitest";
import { distanceEdition, nomsProches, normaliserNom, normaliserVille } from "../normaliser-nom";

describe("le nom normalisé ignore la forme juridique", () => {
  it.each([
    ["Martin SAS", "martin"],
    ["SARL Martin", "martin"],
    ["Société Martin", "martin"],
    ["ETS. MARTIN", "martin"],
    ["Groupe Martin & Fils", "martin fils"],
    ["  Émile—Durand  EURL ", "emile durand"],
  ])("« %s » → « %s »", (brut, attendu) => {
    expect(normaliserNom(brut)).toBe(attendu);
  });

  it("une forme n'est retirée qu'en MOT entier (« Sabatier » reste « sabatier »)", () => {
    expect(normaliserNom("Sabatier SA")).toBe("sabatier");
  });

  it("une faute de frappe est tolérée, deux noms différents ne le sont pas", () => {
    expect(nomsProches("Boulangerie Martin", "Boulangeri Martin SARL")).toBe(true);
    expect(nomsProches("Martin", "Dupont")).toBe(false);
    // Noms courts : deux lettres de distance ne prouvent rien.
    expect(nomsProches("ABC", "ABD")).toBe(false);
    expect(nomsProches("SAS", "SARL")).toBe(false);
  });

  it("outils : distance d'édition et ville normalisée", () => {
    expect(distanceEdition("martin", "martinn")).toBe(1);
    expect(distanceEdition("", "abc")).toBe(3);
    expect(normaliserVille("Saint-Étienne")).toBe("saint etienne");
  });
});
