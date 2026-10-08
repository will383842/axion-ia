import { describe, expect, it } from "vitest";

import {
  aujourdhuiParis,
  dateContactValide,
  etatPourApporteur,
  LIBELLE_ETAT_DECLARATION,
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

  it("aucun plafond de déclarations par apporteur n'est exporté (art. 3.7)", async () => {
    const regles = await import("../declaration-regles");
    expect(Object.keys(regles).filter((k) => /MAX|PLAFOND|LIMITE/i.test(k))).toEqual([]);
  });

  // 2026-10-07 (décision de Will) : un état EN CLAIR, avec la date de fin.
  it("l'état montré à l'apporteur : À l'étude, Réservée jusqu'au …, Non disponible, Expirée", () => {
    const recueAt = new Date("2026-10-05T09:00:00Z");
    const base = { recueAt, protegeeJusquAt: null as Date | null };
    const le = new Date("2026-10-07T12:00:00Z");
    // Pas encore traitée : à l'étude, sans date.
    expect(etatPourApporteur({ ...base, statut: "reservee", contactEnvoyeAt: null }, le)).toEqual({
      etat: "a_l_etude",
      jusquAu: null,
    });
    // Contact envoyé : réservée 6 mois À COMPTER DE LA DÉCLARATION.
    expect(etatPourApporteur({ ...base, statut: "reservee", contactEnvoyeAt: le }, le)).toEqual({
      etat: "reservee",
      jusquAu: new Date("2027-04-05T09:00:00Z"),
    });
    // Confirmée : la date de fin enregistrée fait foi.
    const fin = new Date("2027-04-20T00:00:00Z");
    expect(
      etatPourApporteur(
        { ...base, statut: "confirmee", contactEnvoyeAt: le, protegeeJusquAt: fin },
        le,
      ),
    ).toEqual({ etat: "reservee", jusquAu: fin });
    // Échue : expirée, avec sa date de fin.
    expect(
      etatPourApporteur(
        { ...base, statut: "confirmee", contactEnvoyeAt: le, protegeeJusquAt: fin },
        new Date("2027-05-01T00:00:00Z"),
      ),
    ).toEqual({ etat: "expiree", jusquAu: fin });
    expect(
      etatPourApporteur(
        { ...base, statut: "terminee", contactEnvoyeAt: le, protegeeJusquAt: fin },
        le,
      ),
    ).toEqual({ etat: "expiree", jusquAu: fin });
    // Déjà connue, hors champ : non disponible.
    for (const statut of ["deja_connue", "hors_champ"]) {
      expect(etatPourApporteur({ ...base, statut, contactEnvoyeAt: null }, le)).toEqual({
        etat: "non_disponible",
        jusquAu: null,
      });
    }
    // Démentie : non montrée (litige).
    expect(
      etatPourApporteur({ ...base, statut: "dementie", contactEnvoyeAt: null }, le),
    ).toBeNull();
    expect(LIBELLE_ETAT_DECLARATION).toEqual({
      a_l_etude: "À l'étude",
      sans_reponse: "En attente d'une réponse — nous revenons vers vous",
      reservee: "Réservée",
      non_disponible: "Non disponible",
      expiree: "Expirée",
    });
  });
});
