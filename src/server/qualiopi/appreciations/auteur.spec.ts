import { describe, expect, it } from "vitest";
import { auteurAppreciation, AUTEUR_NON_ETABLI } from "./auteur";

const stagiaire = { nom: "Martin", prenom: "Camille" };
const formateur = { nom: "Durand", prenom: "Luc" };
const raisons = new Map([["c1", "Acme SAS"]]);

describe("auteurAppreciation (ind. 30) : l'auteur suit la qualité déclarée", () => {
  it("stagiaire : le nom du stagiaire", () => {
    expect(
      auteurAppreciation(
        { source: "stagiaire", trainee: stagiaire, trainer: null, clientId: null },
        raisons,
      ),
    ).toBe("Camille Martin");
  });

  it("formateur avec stagiaire ET formateur : le formateur, jamais la stagiaire", () => {
    expect(
      auteurAppreciation(
        { source: "formateur", trainee: stagiaire, trainer: formateur, clientId: null },
        raisons,
      ),
    ).toBe("Luc Durand");
  });

  it("formateur sans formateur rattaché : non établi (pas de repli sur la stagiaire)", () => {
    expect(
      auteurAppreciation(
        { source: "formateur", trainee: stagiaire, trainer: null, clientId: null },
        raisons,
      ),
    ).toBe(AUTEUR_NON_ETABLI);
  });

  it("entreprise : « Entreprise : <raison sociale> »", () => {
    expect(
      auteurAppreciation(
        { source: "entreprise", trainee: stagiaire, trainer: null, clientId: "c1" },
        raisons,
      ),
    ).toBe("Entreprise : Acme SAS");
  });

  it("entreprise sans client lisible : non établi", () => {
    expect(
      auteurAppreciation(
        { source: "entreprise", trainee: null, trainer: null, clientId: "inconnu" },
        raisons,
      ),
    ).toBe("Non établi en base");
  });

  it("financeur : « Non établi en base » (aucune fiche ne l'identifie)", () => {
    expect(
      auteurAppreciation(
        { source: "financeur", trainee: stagiaire, trainer: null, clientId: "c1" },
        raisons,
      ),
    ).toBe("Non établi en base");
  });

  it("stagiaire effacé (nom vide) : non établi", () => {
    expect(
      auteurAppreciation(
        { source: "stagiaire", trainee: { nom: "", prenom: "" }, trainer: null, clientId: null },
        raisons,
      ),
    ).toBe("Non établi en base");
  });
});
