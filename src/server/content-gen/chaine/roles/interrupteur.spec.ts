import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ChaineEteinteError,
  INTERRUPTEUR_CHAINE,
  chaineAllumee,
  exigerChaineAllumee,
  roleAllume,
} from "./interrupteur";

afterEach(() => vi.unstubAllEnvs());

describe("interrupteur de la chaîne : éteint par défaut", () => {
  it("est éteint sans variable, vide, ou autre valeur que « true »", () => {
    expect(chaineAllumee()).toBe(false);
    for (const v of ["", "1", "TRUE", "oui", " true"]) {
      vi.stubEnv(INTERRUPTEUR_CHAINE, v);
      expect(chaineAllumee()).toBe(false);
    }
  });
  it("s'allume avec exactement « true », relu à chaque appel", () => {
    vi.stubEnv(INTERRUPTEUR_CHAINE, "true");
    expect(chaineAllumee()).toBe(true);
    vi.stubEnv(INTERRUPTEUR_CHAINE, "false");
    expect(chaineAllumee()).toBe(false);
  });
  it("exigerChaineAllumee lève quand c'est éteint", () => {
    expect(() => exigerChaineAllumee()).toThrow(ChaineEteinteError);
    vi.stubEnv(INTERRUPTEUR_CHAINE, "true");
    expect(() => exigerChaineAllumee()).not.toThrow();
  });
  it("un rôle exige l'interrupteur général ET le sien", () => {
    vi.stubEnv(INTERRUPTEUR_CHAINE, "true");
    expect(roleAllume("redacteur")).toBe(false);
    vi.stubEnv("CONTENT_CHAINE_ROLE_REDACTEUR", "true");
    expect(roleAllume("redacteur")).toBe(true);
    vi.stubEnv(INTERRUPTEUR_CHAINE, "false");
    expect(roleAllume("redacteur")).toBe(false);
  });
});
