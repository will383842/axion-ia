// @formateurs E-D1 (correction du 14/10) — Activation d'un indépendant sans
// contrat-cadre RÉELLEMENT signé : refusée.
//
// Une date de signature saisie à la main en console (`sousTraitantContratSigneAt`)
// ne prouve rien ; une signature partielle non plus. Témoin : la même fiche,
// une fois le contrat signé par toutes les parties, s'active — le refus tient
// donc à la signature seule. Geste : l'action de la console, session `admin`.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { executerScenarioSecurite } from "../fixtures/formateurs/securite-execution";

const REFUS =
  "Activation refusée : le dossier du formateur indépendant est incomplet. Le contrat-cadre de sous-traitance n'est pas signé.";

interface Etat {
  actif: boolean;
  sousTraitantContratSigneAt: string | null;
}
interface Observations {
  regleProvisoire: { ok: boolean };
  dateMain: { data?: { id: string } };
  apresDate: Etat;
  activationDateMain: { error?: string };
  apresRefus1: Etat;
  activationPartielle: { error?: string };
  apresRefus2: Etat;
  activationSignee: { data?: { id: string }; error?: string };
  apresTemoin: Etat;
}

test.describe("@formateurs E-D1 — pas d'activation sans contrat réellement signé", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    o = await executerScenarioSecurite<Observations>("ed1-activation-sans-signature", {});
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("la date saisie à la main est enregistrée… et ne suffit pas", () => {
    expect(o.regleProvisoire.ok).toBe(true);
    expect(o.dateMain.data).toBeDefined();
    expect(o.apresDate.sousTraitantContratSigneAt).not.toBeNull();
    expect(o.activationDateMain).toEqual({ error: REFUS });
    expect(o.apresRefus1.actif).toBe(false);
  });

  test("une signature partielle ne suffit pas non plus", () => {
    expect(o.activationPartielle).toEqual({ error: REFUS });
    expect(o.apresRefus2.actif).toBe(false);
  });

  test("témoin : signé par toutes les parties, la même fiche s'active", () => {
    expect(o.activationSignee.error).toBeUndefined();
    expect(o.apresTemoin.actif).toBe(true);
  });
});
