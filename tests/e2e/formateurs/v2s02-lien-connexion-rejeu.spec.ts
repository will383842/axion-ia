// @formateurs V2-S02 (vérification n° 2, sécurité) — Lien de connexion rejoué.
//
// La vraie route de connexion reçoit des liens fabriqués par le code du dépôt :
// le premier clic ouvre l'espace (témoin) ; le second, un double clic simultané,
// un lien échu, altéré, émis avant un changement d'adresse ou d'une fiche
// désactivée depuis, renvoient tous vers la même page « lien invalide », sans
// cookie de session.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { scenarioV2 } from "../fixtures/formateurs/v2s-commun";

interface Clic {
  location: string | null;
  cookie: boolean;
}
interface Observations {
  premier: Clic;
  second: Clic;
  simultanes: number;
  apresEcheance: Clic;
  altere: Clic;
  changement: string;
  apresChangement: Clic;
  apresDesactivation: Clic;
  encoreVivants: number;
}

const REFUS: Clic = {
  location: "https://axion-ia.com/fr/espace-formateur/connexion?erreur=lien_invalide",
  cookie: false,
};

test.describe("@formateurs V2-S02 — lien de connexion rejoué", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    o = await scenarioV2<Observations>("v2s02-lien-connexion-rejeu");
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("témoin : le premier clic ouvre l'espace", () => {
    expect(o.premier).toEqual({
      location: "https://axion-ia.com/fr/espace-formateur",
      cookie: true,
    });
  });

  test("le même lien, une seconde fois : refusé", () => {
    expect(o.second).toEqual(REFUS);
  });

  test("deux clics simultanés : un seul ouvre", () => {
    expect(o.simultanes).toBe(1);
  });

  test("lien échu, lien altéré : refusés", () => {
    expect(o.apresEcheance).toEqual(REFUS);
    expect(o.altere).toEqual(REFUS);
  });

  test("lien émis avant un changement d'adresse en console : refusé", () => {
    expect(o.changement).toBe("ok");
    expect(o.apresChangement).toEqual(REFUS);
  });

  test("lien d'une fiche désactivée depuis : refusé, et plus aucun lien vivant", () => {
    expect(o.apresDesactivation).toEqual(REFUS);
    expect(o.encoreVivants).toBe(0);
  });
});
