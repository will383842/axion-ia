// @formateurs — NON-RÉGRESSION 1 : un rendez-vous CLIENT (« Diagnostic IA »)
// arrivé par le webhook SIGNÉ est classé client et prend le chemin CRM.
//
// Le chemin traversé est le vrai, de bout en bout : la route
// `POST /api/calendly/webhook` vérifie la signature, délègue à
// `discoverNewCalendlyEvents`, qui crée la ligne, l'enrichit, la classe et
// pose l'événement CRM. Seule l'API Calendly est simulée (`fixtures/formateurs`).
//
// Constat EN BASE, pas dans la réponse : la ligne `calendly_events` porte le
// type `diagnostic`, et l'outbox CRM porte exactement un `calendly_booked`
// dans l'univers `business` pour ce rendez-vous.
//
// Ce que le lot F-CAL-1 changera pour les rendez-vous « formateur » ne doit
// RIEN changer ici.

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
  nomType: "Diagnostic IA",
  typeConnu: "diagnostic",
  prenom: "Ondine",
});

test.describe("@formateurs non-régression — rendez-vous client par webhook signé", () => {
  test.setTimeout(120_000);

  test.afterAll(async () => {
    await effacerRendezVous(rdv);
    await prisma.$disconnect();
  });

  test("« Diagnostic IA » est classé client et part au CRM", async () => {
    const reponse = await executerCoteServeur<ResultatWebhook>({
      action: "livrer-webhook-calendly",
      rdv,
    });

    // La route a accepté la signature et traité l'événement.
    expect(reponse.statut).toBe(200);
    expect(reponse.corps).toEqual({ ok: true, event: "invitee.created" });
    // Aucune adresse hors de l'API Calendly simulée n'a été SERVIE.
    expect(
      reponse.reseau.filter((a) => a.servi && !a.url.startsWith("https://api.calendly.com/")),
    ).toEqual([]);

    const ligne = await ligneDuRendezVous(rdv);
    expect(ligne, "la réservation doit avoir sa ligne").not.toBeNull();
    if (ligne === null) return;
    expect(ligne.typeRendezVous).toBe("diagnostic");
    expect(ligne.status).toBe("scheduled");
    expect(ligne.source).toBe("api_poll");
    expect(ligne.inviteeEmail).toBe(rdv.invite.email);
    // Un client n'est rattaché à aucune fiche apporteur.
    expect(ligne.linkedSubmissionId).toBeNull();

    expect(await outboxCrmDuRendezVous(ligne.id)).toEqual([
      {
        eventType: "calendly_booked",
        universe: "business",
        subjectRef: `site:calendly_event:${ligne.id}`,
      },
    ]);
  });
});
