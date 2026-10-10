// @formateurs — NON-RÉGRESSION 2 : un rendez-vous APPORTEUR (« Échange
// apporteur d'affaires (15 min) ») arrivé par le webhook signé reste HORS CRM.
//
// Même chaîne réelle que la non-régression 1. Le constat porte sur les deux
// verrous du dépôt : le type classé (`apporteur`) et la garde du point
// d'entrée CRM (`syncCalendlyEventToCrm` ne pose rien pour un apporteur). Le
// rendez-vous reste visible, et suit son propre chemin : une fiche apporteur
// est créée et rattachée à la réservation.

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

const rdv = rendezVousFictif({
  nomType: "Échange apporteur d'affaires (15 min)",
  typeConnu: "apporteur",
  prenom: "Lazare",
});

test.describe("@formateurs non-régression — rendez-vous apporteur par webhook signé", () => {
  test.setTimeout(120_000);

  test.afterAll(async () => {
    await effacerRendezVous(rdv);
    await prisma.$disconnect();
  });

  test("« Échange apporteur d'affaires » reste hors CRM", async () => {
    const reponse = await executerCoteServeur<ResultatWebhook>({
      action: "livrer-webhook-calendly",
      rdv,
    });
    expect(reponse.statut).toBe(200);
    expect(reponse.corps).toEqual({ ok: true, event: "invitee.created" });

    const ligne = await ligneDuRendezVous(rdv);
    expect(ligne, "la réservation doit avoir sa ligne").not.toBeNull();
    if (ligne === null) return;
    expect(ligne.typeRendezVous).toBe("apporteur");
    expect(ligne.status).toBe("scheduled");

    // ⛔ Le constat qui compte : RIEN dans l'outbox CRM pour ce rendez-vous.
    expect(await outboxCrmDuRendezVous(ligne.id)).toEqual([]);

    // Et le chemin apporteur a bien été pris : fiche créée, rattachée.
    expect(ligne.linkedSubmissionId, "fiche apporteur rattachée").not.toBeNull();
  });
});
