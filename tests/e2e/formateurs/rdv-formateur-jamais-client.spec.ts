// @formateurs — SCÉNARIO CIBLE du lot F-CAL-1, en attente (`test.fixme`).
//
// Un rendez-vous dont le NOM contient « formateur » (entretien avec un
// formateur freelance) n'est JAMAIS un client et n'entre JAMAIS au CRM.
//
// Aujourd'hui, sur `main`, il est classé `autre` (`classerParNom`) et la garde
// CRM ne connaît que l'apporteur : il partirait donc au CRM comme un prospect.
// C'est précisément ce que F-CAL-1 doit fermer. Ce spec décrit le résultat
// attendu ; F-CAL-1 retire le `fixme` dans la PR qui le rend vrai.
//
// Type INCONNU du compte (`typeConnu: null`) : le classement retombe sur le
// nom, comme pour un type créé dans Calendly avant d'être configuré au site —
// c'est le cas le plus probable en production.

import { expect, test } from "@playwright/test";

import {
  effacerRendezVous,
  ligneDuRendezVous,
  outboxCrmDuRendezVous,
  prisma,
} from "../fixtures/formateurs/base";
import { rendezVousFictif } from "../fixtures/formateurs/calendly-simule";
import { executerCoteServeur } from "../fixtures/formateurs/execution";
import type { ResultatWebhook } from "../fixtures/formateurs/protocole";

const TYPES_CLIENT = ["diagnostic", "echange_projet"];

const rdv = rendezVousFictif({
  nomType: "Entretien formateur freelance (30 min)",
  typeConnu: null,
  prenom: "Solveig",
});

test.describe("@formateurs cible F-CAL-1 — un rendez-vous formateur", () => {
  test.setTimeout(120_000);

  test.afterAll(async () => {
    await effacerRendezVous(rdv);
    await prisma.$disconnect();
  });

  test.fixme("un rendez-vous dont le nom contient « formateur » n'est jamais client, jamais CRM", async () => {
    const reponse = await executerCoteServeur<ResultatWebhook>({
      action: "livrer-webhook-calendly",
      rdv,
    });
    expect(reponse.statut).toBe(200);

    const ligne = await ligneDuRendezVous(rdv);
    expect(ligne, "la réservation doit avoir sa ligne").not.toBeNull();
    if (ligne === null) return;
    expect(TYPES_CLIENT).not.toContain(ligne.typeRendezVous);
    expect(await outboxCrmDuRendezVous(ligne.id)).toEqual([]);
  });
});
