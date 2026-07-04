import { describe, it, expect } from "vitest";
import { personKey, splitFullName } from "./person-key";

describe("personKey", () => {
  it("normalise accents/casse", () => {
    expect(personKey("DUPONT", "Jean")).toBe(personKey("Dupont", "jean"));
    expect(personKey("Tellier", "Hervé")).toBe(personKey("tellier", "herve"));
  });
  it("ordre des prénoms indifférent (triés)", () => {
    expect(personKey("Dupont", "Jean Pierre")).toBe(personKey("Dupont", "Pierre Jean"));
  });
  it("clé stable et distincte", () => {
    expect(personKey("Dupont", "Jean")).not.toBe(personKey("Durand", "Jean"));
  });
});

describe("splitFullName", () => {
  it("nom en MAJUSCULES = nom de famille (convention FR)", () => {
    expect(splitFullName("Jean DUPONT")).toEqual({ prenoms: "Jean", nom: "DUPONT" });
  });
  it("défaut : dernier mot = nom", () => {
    expect(splitFullName("Jean Dupont")).toEqual({ prenoms: "Jean", nom: "Dupont" });
  });
  it("prénom composé + nom MAJ", () => {
    expect(splitFullName("Marie Claire MARTIN")).toEqual({
      prenoms: "Marie Claire",
      nom: "MARTIN",
    });
  });
  it("mot unique", () => {
    expect(splitFullName("Dupont")).toEqual({ prenoms: "", nom: "Dupont" });
  });
});
