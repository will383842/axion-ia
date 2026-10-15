// @formateurs V2-S09 (vérification n° 2, sécurité) — Portes d'activation.
//
// Par les actions réelles de la console, interrupteur `affectation_sure` allumé :
// un formateur inactif n'est pas affecté à une session ; un formateur désactivé
// après son affectation ne reçoit plus de proposition de mission ; un éditeur
// n'active personne, ni par la fiche, ni par la console « coaching ».
// (`SessionJour.trainerId` : aucun code du dépôt ne l'écrit — relu, cf. rapport.)

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { DELAI_SPEC_MS, scenarioV2 } from "../fixtures/formateurs/v2s-commun";

interface Observations {
  allumage: { ok: boolean };
  affecterInactif: string | null;
  affectations: number;
  desactivation: string | null;
  renvoi: string | null;
  missionsCreees: number;
  editeurFiche: string | null;
  editeurCoaching: string | null;
  inactifEncoreInactif: boolean;
}

test.describe("@formateurs V2-S09 — affecter ou activer hors des portes", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(DELAI_SPEC_MS);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(DELAI_SPEC_MS);
    o = await scenarioV2<Observations>("v2s09-affectation-non-actif");
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("un formateur inactif n'est pas affecté", () => {
    expect(o.allumage.ok).toBe(true);
    expect(o.affecterInactif).toContain("Formateur inactif");
    expect(o.affectations).toBe(0);
  });

  test("désactivé après son affectation : aucune nouvelle proposition", () => {
    expect(o.desactivation).toBeNull();
    expect(o.renvoi).toContain("Formateur inactif");
    expect(o.missionsCreees).toBe(0);
  });

  test("un éditeur n'active personne, par aucune des deux portes", () => {
    expect(o.editeurFiche).toContain("Activation refusée");
    expect(o.editeurCoaching).toBe("refus");
    expect(o.inactifEncoreInactif).toBe(true);
  });
});
