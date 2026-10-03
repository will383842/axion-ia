/**
 * Lot OPCO A1 — rapprochement LECTURE SEULE du texte libre `opcoIdentifie`
 * vers l'un des 11 OPCO typés. Ne propose qu'en cas de correspondance UNIQUE.
 */
import { describe, expect, it } from "vitest";
import { suggererOpco } from "./opco-suggestion";

describe("suggererOpco", () => {
  it.each([
    ["atlas", "atlas"],
    ["opco_ep", "opco_ep"],
    ["OPCO EP", "opco_ep"],
    ["OPCO Santé", "opco_sante"],
    ["opco sante", "opco_sante"],
    ["OPCO Atlas", "atlas"],
    ["  Akto ", "akto"],
    ["Opcommerce", "opcommerce"],
    ["OPCO 2i", "opco2i"],
    ["Mobilités", "mobilites"],
  ])("« %s » → %s", (texte, attendu) => {
    expect(suggererOpco({ opco: null, opcoIdentifie: texte })).toBe(attendu);
  });

  it.each([["Akto / Atlas"], ["OPCO"], ["à déterminer"], [""], ["   "], ["Agefice"]])(
    "« %s » → aucune suggestion (ambigu ou inconnu)",
    (texte) => {
      expect(suggererOpco({ opco: null, opcoIdentifie: texte })).toBeNull();
    },
  );

  it("ne suggère rien quand l'OPCO typé est déjà renseigné", () => {
    expect(suggererOpco({ opco: "akto", opcoIdentifie: "atlas" })).toBeNull();
  });

  it("ne suggère rien sans texte libre", () => {
    expect(suggererOpco({ opco: null, opcoIdentifie: null })).toBeNull();
  });
});
