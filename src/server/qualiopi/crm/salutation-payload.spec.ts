import { describe, expect, it } from "vitest";

import { salutationPourPayload } from "./salutation-payload";

describe("salutationPourPayload", () => {
  it("civilité + nom de famille → { civilite, nomFamille }", () => {
    expect(
      salutationPourPayload({
        clientNom: "Dupont SAS",
        contactCivilite: "madame",
        contactPrenom: "Léa",
        contactNomFamille: "Dupont",
      }),
    ).toEqual({ civilite: "madame", nomFamille: "Dupont" });
  });

  it("prénom seul → { prenom }", () => {
    expect(
      salutationPourPayload({ clientNom: "X", contactCivilite: null, contactPrenom: "Léa" }),
    ).toEqual({ prenom: "Léa" });
  });

  it("rien → {} (le gabarit rend « Bonjour, »)", () => {
    expect(salutationPourPayload({ clientNom: "X" })).toEqual({});
    expect(
      salutationPourPayload({
        clientNom: "X",
        contactCivilite: " ",
        contactPrenom: "",
        contactNomFamille: null,
      }),
    ).toEqual({});
  });

  it("civilité sans nom de famille → retombe sur le prénom, sinon {}", () => {
    expect(
      salutationPourPayload({ clientNom: "X", contactCivilite: "monsieur", contactPrenom: "Marc" }),
    ).toEqual({ prenom: "Marc" });
    expect(salutationPourPayload({ clientNom: "X", contactCivilite: "monsieur" })).toEqual({});
  });

  it("nom de famille sans civilité reconnue → jamais le nom seul", () => {
    expect(
      salutationPourPayload({
        clientNom: "X",
        contactCivilite: "docteur",
        contactNomFamille: "Dupont",
      }),
    ).toEqual({});
  });

  it("clientNom vide → clé absente", () => {
    expect(
      salutationPourPayload({
        clientNom: "",
        contactCivilite: "madame",
        contactNomFamille: "Dupont",
      }),
    ).toBeUndefined();
  });
});
