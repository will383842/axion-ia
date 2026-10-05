import { describe, expect, it } from "vitest";

import {
  DECLARATIONS_MAX_PAR_JOUR,
  aujourdhuiParis,
  dateContactValide,
  etatPourApporteur,
  validerDeclaration,
} from "../declaration-regles";

const MAINTENANT = new Date("2026-10-05T10:00:00Z");
const BONNE = {
  siren: "732 829 320",
  denomination: "Boulangerie Martin",
  personneNom: "Claire Durand",
  personneFonction: "Gérante",
  personneEmail: "claire@exemple.fr",
  personneTelephone: "06 12 34 56 78",
  dateContact: "2026-10-01",
};

describe("déclaration d'entreprise — règles pures (art. 3.2)", () => {
  it("accepte une déclaration complète et nettoie le SIREN", () => {
    const r = validerDeclaration(BONNE, MAINTENANT);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valeur.siren).toBe("732829320");
  });

  it.each([
    ["siren", "123456789"],
    ["siren", "12345"],
    ["denomination", ""],
    ["personneNom", " "],
    ["personneFonction", ""],
    ["personneEmail", "pas-un-mail"],
    ["personneTelephone", ""],
    ["personneTelephone", "abc"],
    ["dateContact", ""],
  ])("refuse %s = « %s »", (cle, valeur) => {
    expect(validerDeclaration({ ...BONNE, [cle]: valeur }, MAINTENANT).ok).toBe(false);
  });

  it("refuse un champ absent ou d'un autre type", () => {
    const { personneFonction: _f, ...sans } = BONNE;
    expect(validerDeclaration(sans, MAINTENANT).ok).toBe(false);
    expect(validerDeclaration({ ...BONNE, personneNom: 42 }, MAINTENANT).ok).toBe(false);
  });

  it("refuse des longueurs excessives", () => {
    expect(validerDeclaration({ ...BONNE, personneNom: "x".repeat(151) }, MAINTENANT).ok).toBe(
      false,
    );
    expect(validerDeclaration({ ...BONNE, denomination: "x".repeat(251) }, MAINTENANT).ok).toBe(
      false,
    );
  });

  it("la date : aujourd'hui passe, demain et le 31 février non", () => {
    expect(aujourdhuiParis(MAINTENANT)).toBe("2026-10-05");
    expect(dateContactValide("2026-10-05", MAINTENANT)).toBe(true);
    expect(dateContactValide("2026-10-06", MAINTENANT)).toBe(false);
    expect(dateContactValide("2026-02-31", MAINTENANT)).toBe(false);
    expect(dateContactValide("05/10/2026", MAINTENANT)).toBe(false);
    expect(dateContactValide("2019-12-31", MAINTENANT)).toBe(false);
  });

  it("la limite est de 20 par jour", () => {
    expect(DECLARATIONS_MAX_PAR_JOUR).toBe(20);
  });

  it("l'état montré à l'apporteur", () => {
    expect(etatPourApporteur({ statut: "reservee", contactEnvoyeAt: null })).toBe("recue");
    expect(etatPourApporteur({ statut: "reservee", contactEnvoyeAt: new Date() })).toBe(
      "bien_recue",
    );
    expect(etatPourApporteur({ statut: "confirmee", contactEnvoyeAt: new Date() })).toBe(
      "bien_recue",
    );
    expect(etatPourApporteur({ statut: "deja_connue", contactEnvoyeAt: null })).toBe("deja_connue");
    expect(etatPourApporteur({ statut: "hors_champ", contactEnvoyeAt: null })).toBe("hors_champ");
    expect(etatPourApporteur({ statut: "dementie", contactEnvoyeAt: null })).toBeNull();
  });
});
