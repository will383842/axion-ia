import { describe, expect, it } from "vitest";
import { calculerScore, effortSelonCanal, probabiliteSelonContexte } from "../score";

describe("calculerScore", () => {
  it("vaut pertinence × portée × probabilité / effort", () => {
    expect(calculerScore({ pertinence: 3, portee: 3, probabilite: 3, effort: 1 })).toBe(27);
    expect(calculerScore({ pertinence: 2, portee: 2, probabilite: 2, effort: 2 })).toBe(4);
    expect(calculerScore({ pertinence: 1, portee: 1, probabilite: 1, effort: 3 })).toBe(0.33);
  });
  it("est nul en cas d'opposition, quels que soient les autres termes", () => {
    expect(
      calculerScore({ pertinence: 3, portee: 3, probabilite: 3, effort: 1, opposition: true }),
    ).toBe(0);
  });
  it("refuse une valeur hors de 1 à 3 ou non entière", () => {
    expect(() => calculerScore({ pertinence: 0, portee: 1, probabilite: 1, effort: 1 })).toThrow(
      RangeError,
    );
    expect(() => calculerScore({ pertinence: 4, portee: 1, probabilite: 1, effort: 1 })).toThrow(
      RangeError,
    );
    expect(() => calculerScore({ pertinence: 1.5, portee: 1, probabilite: 1, effort: 1 })).toThrow(
      RangeError,
    );
    expect(() =>
      calculerScore({ pertinence: 1, portee: 1, probabilite: 1, effort: Number.NaN }),
    ).toThrow(RangeError);
  });
  it("est calculé même quand l'opposition rend les saisies inutiles : valeurs invalides ignorées", () => {
    expect(
      calculerScore({ pertinence: 9, portee: 1, probabilite: 1, effort: 1, opposition: true }),
    ).toBe(0);
  });
});

describe("probabiliteSelonContexte", () => {
  it("3 si le domaine nous cite déjà, 2 si une rubrique accepte les propositions, 1 sinon", () => {
    expect(probabiliteSelonContexte({ citeDeja: true, rubriqueAccepte: false })).toBe(3);
    expect(probabiliteSelonContexte({ citeDeja: true, rubriqueAccepte: true })).toBe(3);
    expect(probabiliteSelonContexte({ citeDeja: false, rubriqueAccepte: true })).toBe(2);
    expect(probabiliteSelonContexte({ citeDeja: false, rubriqueAccepte: false })).toBe(1);
  });
});

describe("effortSelonCanal", () => {
  it("1 formulaire public, 2 proposition à rédiger, 3 contenu à produire", () => {
    expect(effortSelonCanal("formulaire_public")).toBe(1);
    expect(effortSelonCanal("adresse_generique")).toBe(2);
    expect(effortSelonCanal("adresse_nominative")).toBe(2);
    expect(effortSelonCanal("aucun")).toBe(3);
  });
});
