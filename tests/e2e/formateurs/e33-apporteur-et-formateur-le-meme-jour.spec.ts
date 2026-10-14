// @formateurs — E33 · Un apporteur et un formateur réservent le même jour.
//
// Deux personnes, deux familles d'échange, le même jour, par le webhook signé :
//   · chacune reçoit SES seuls e-mails (le formateur : F3 et ses rappels ;
//     l'apporteur : rien de la famille formateur) ;
//   · aucune n'entre au CRM ;
//   · chacune est rattachée à SA fiche (candidature / fiche apporteur), jamais
//     à celle de l'autre.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { eventUriDe, rendezVousFictif } from "../fixtures/formateurs/calendly-simule";
import { etape } from "../fixtures/formateurs/etapes";
import { candidatureInvitee, reserverEchange } from "../fixtures/formateurs/parcours";
import {
  attendreLeWorker,
  gabaritsVers,
  ouvrirScenario,
  plus,
  type DecorScenario,
} from "../fixtures/formateurs/scenario";

test.describe("@formateurs E33 — apporteur et formateur le même jour", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(400_000);
  let decor: DecorScenario;

  test.beforeAll(async () => {
    // Les scénarios passent un par un (verrou) : l'attente peut être longue.
    test.setTimeout(20 * 60_000);
    decor = await ouvrirScenario("e33");
  });
  test.afterAll(async () => {
    await decor?.liberer();
    await prisma.$disconnect();
  });

  test("chacun ses e-mails, aucun au CRM, chacun sa fiche", async () => {
    const formateur = decor.adresse("formateur");
    const apporteur = decor.adresse("apporteur");
    const cand = await candidatureInvitee(formateur, "Joachim");

    // Le même jour, à une heure d'écart.
    const jour = plus(new Date(), { jours: 2 });
    const { ligne: echange } = await reserverEchange(cand.id, formateur, "Joachim", jour);
    const rdvApp = rendezVousFictif({
      nomType: "Échange apporteur d'affaires",
      typeConnu: "apporteur",
      prenom: "Capucine",
      email: apporteur,
      debut: plus(jour, { heures: 1 }).toISOString(),
    });
    const livraison = await etape<{ statut: number }>({
      etape: "livrer-webhook",
      args: { cle: rdvApp.cle },
      calendly: [rdvApp],
    });
    expect(livraison.valeur.statut).toBe(200);
    const ligneApp = await prisma.calendlyEvent.findFirstOrThrow({
      where: { eventUri: eventUriDe(rdvApp) },
    });

    // Confirmation et rappels des échanges formateur, aux trois moments.
    for (const m of [new Date(), plus(jour, { minutes: -1445 }), plus(jour, { minutes: -65 })]) {
      await etape({ etape: "passage-echanges-formateur", args: { maintenant: m.toISOString() } });
    }
    await attendreLeWorker(formateur);
    await attendreLeWorker(apporteur);

    // Chacun sa fiche.
    expect(echange.linkedJobApplicationId).toBe(cand.id);
    expect(echange.linkedSubmissionId).toBeNull();
    expect(ligneApp.typeRendezVous).toBe("apporteur");
    expect(ligneApp.linkedJobApplicationId).toBeNull();
    expect(ligneApp.linkedSubmissionId).not.toBeNull();
    const fiche = await prisma.submission.findUniqueOrThrow({
      where: { id: ligneApp.linkedSubmissionId ?? "∅" },
      select: { contactEmailHash: true },
    });
    expect(fiche.contactEmailHash).not.toBe(cand.emailHash);
    expect(
      await prisma.submission.count({ where: { contactEmailHash: cand.emailHash ?? "∅" } }),
    ).toBe(0);

    // Chacun ses e-mails.
    expect(await gabaritsVers(formateur)).toEqual([
      "candidature-recue",
      "formateur-invitation-echange",
      "formateur-echange-confirme",
      "formateur-echange-rappel",
      "formateur-echange-rappel",
    ]);
    const versApporteur = await gabaritsVers(apporteur);
    expect(versApporteur.filter((g) => g.startsWith("formateur-"))).toEqual([]);
    expect(versApporteur).not.toContain("candidature-recue");

    // Aucun au CRM.
    expect(
      await prisma.crmSyncOutbox.count({
        where: {
          subjectRef: {
            in: [`site:calendly_event:${echange.id}`, `site:calendly_event:${ligneApp.id}`],
          },
        },
      }),
    ).toBe(0);
  });
});
