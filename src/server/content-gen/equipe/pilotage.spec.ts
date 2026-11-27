import { beforeEach, describe, expect, it, vi } from "vitest";

const lireMock = vi.fn();
vi.mock("../config-store", () => ({
  readContentGenConfigDirect: (...a: unknown[]) => lireMock(...a),
}));

import { equipeEnMarche, etatEquipe, lireMarche, marcheConsole, validerQuotas } from "./pilotage";

beforeEach(() => {
  lireMock.mockReset();
});

describe("lireMarche (lecture tolérante)", () => {
  it("absent, faux ou forme inattendue = arrêt", () => {
    for (const v of [undefined, null, false, 0, "true", [], {}, { marche: "true" }]) {
      expect(lireMarche(v)).toBe(false);
    }
  });
  it("true ou { marche: true } = marche", () => {
    expect(lireMarche(true)).toBe(true);
    expect(lireMarche({ marche: true })).toBe(true);
  });
});

describe("marche de l'équipe = variable ET console", () => {
  it("console sur arrêt (variable allumée) : aucune génération", async () => {
    lireMock.mockResolvedValue({ marche: false });
    expect(await equipeEnMarche({ CONTENT_EQUIPE_EDITORIALE: "true" })).toBe(false);
  });
  it("variable éteinte, console sur marche : aucune génération, sans même lire la console", async () => {
    lireMock.mockResolvedValue({ marche: true });
    expect(await equipeEnMarche({ CONTENT_EQUIPE_EDITORIALE: "false" })).toBe(false);
    expect(await equipeEnMarche({})).toBe(false);
    expect(lireMock).not.toHaveBeenCalled();
  });
  it("les deux réunies : en marche", async () => {
    lireMock.mockResolvedValue({ marche: true });
    expect(await equipeEnMarche({ CONTENT_EQUIPE_EDITORIALE: "true" })).toBe(true);
  });
  it("base illisible = arrêt", async () => {
    lireMock.mockRejectedValue(new Error("db"));
    expect(await marcheConsole()).toBe(false);
  });
});

describe("etatEquipe : état réel et raison", () => {
  it("arrêtée par la variable", () => {
    const e = etatEquipe(true, {});
    expect(e.active).toBe(false);
    expect(e.raison).toContain("CONTENT_EQUIPE_EDITORIALE");
  });
  it("arrêtée par la console", () => {
    const e = etatEquipe(false, { CONTENT_EQUIPE_EDITORIALE: "true" });
    expect(e.active).toBe(false);
    expect(e.raison).toContain("console");
  });
  it("en marche : pas de raison", () => {
    const e = etatEquipe(true, { CONTENT_EQUIPE_EDITORIALE: "true" });
    expect(e).toEqual({ active: true, variable: true, console: true });
  });
});

describe("bornes des quotas", () => {
  it("accepte les bornes incluses", () => {
    expect(validerQuotas({ articlesMaxJour: 0, majMaxJour: 0 })).toEqual({
      articlesMaxJour: 0,
      majMaxJour: 0,
    });
    expect(validerQuotas({ articlesMaxJour: 10, majMaxJour: 5 })).toEqual({
      articlesMaxJour: 10,
      majMaxJour: 5,
    });
  });
  it("refuse hors bornes, décimaux, non-nombres", () => {
    expect(() => validerQuotas({ articlesMaxJour: 11, majMaxJour: 1 })).toThrow(/quota_invalide/);
    expect(() => validerQuotas({ articlesMaxJour: -1, majMaxJour: 1 })).toThrow();
    expect(() => validerQuotas({ articlesMaxJour: 3, majMaxJour: 6 })).toThrow();
    expect(() => validerQuotas({ articlesMaxJour: 1.5, majMaxJour: 1 })).toThrow();
    expect(() => validerQuotas({ articlesMaxJour: "3", majMaxJour: 1 })).toThrow();
    expect(() => validerQuotas({ articlesMaxJour: NaN, majMaxJour: 1 })).toThrow();
  });
});
