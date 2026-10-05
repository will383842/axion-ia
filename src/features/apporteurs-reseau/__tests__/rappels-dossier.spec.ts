import { describe, expect, it } from "vitest";

import { rappelDossierDu } from "../passage-quotidien";

const envoye = new Date("2026-10-01T09:00:00Z");
const apres = (jours: number) => new Date(envoye.getTime() + jours * 86_400_000);

describe("rappel du dossier non complété : J+3 puis J+7, jamais au-delà", () => {
  it("rien avant J+3", () => {
    expect(rappelDossierDu(envoye, apres(0))).toBeNull();
    expect(rappelDossierDu(envoye, apres(2.9))).toBeNull();
  });
  it("premier rappel de J+3 à J+7", () => {
    expect(rappelDossierDu(envoye, apres(3))).toBe(1);
    expect(rappelDossierDu(envoye, apres(6.9))).toBe(1);
  });
  it("second rappel de J+7 à J+14", () => {
    expect(rappelDossierDu(envoye, apres(7))).toBe(2);
    expect(rappelDossierDu(envoye, apres(13.9))).toBe(2);
  });
  it("plus rien à partir de J+14 : un vieux lien oublié n'est pas relancé", () => {
    expect(rappelDossierDu(envoye, apres(14))).toBeNull();
    expect(rappelDossierDu(envoye, apres(60))).toBeNull();
  });
});
