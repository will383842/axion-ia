// @formateurs V2-S05 (vérification n° 2, sécurité) — Lien du dossier rejoué.
//
// Liens du dossier en ligne fabriqués par le code du dépôt, lus comme la page
// les lit et éprouvés en écriture par l'action du formulaire : échu, altéré,
// échéance prolongée à la main, version d'accès dépassée, signature d'un autre
// domaine (lien de réservation) — page neutre et « lien non valable », rien
// d'écrit. Témoin : le lien courant s'ouvre.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { scenarioV2 } from "../fixtures/formateurs/v2s-commun";

interface Observations {
  r: {
    temoin: boolean;
    echu: boolean;
    altere: boolean;
    prolonge: boolean;
    versionDepassee: boolean;
    autreDomaine: boolean;
    majuscules: boolean;
    ecritureVersionDepassee: string;
    ecritureEchue: string;
  };
  telephoneAvant: string;
  telephoneApres: string | null;
}

const NON_VALABLE = { ok: false, message: "Ce lien n'est pas valable" };

test.describe("@formateurs V2-S05 — lien du dossier en ligne rejoué", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    o = await scenarioV2<Observations>("v2s05-jeton-dossier");
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("témoin : le lien courant ouvre le dossier", () => {
    expect(o.r.temoin).toBe(true);
    // Même fiche, casse de l'identifiant ignorée : ce n'est pas l'accès à autrui.
    expect(o.r.majuscules).toBe(true);
  });

  test("échu, altéré, prolongé, version dépassée, autre domaine : page neutre", () => {
    expect(o.r.echu).toBe(false);
    expect(o.r.altere).toBe(false);
    expect(o.r.prolonge).toBe(false);
    expect(o.r.versionDepassee).toBe(false);
    expect(o.r.autreDomaine).toBe(false);
  });

  test("écriture par un lien dépassé ou échu : « non valable », rien d'écrit", () => {
    expect(JSON.parse(o.r.ecritureVersionDepassee)).toEqual(NON_VALABLE);
    expect(JSON.parse(o.r.ecritureEchue)).toEqual(NON_VALABLE);
    expect(o.telephoneApres).toBe(o.telephoneAvant);
  });
});
