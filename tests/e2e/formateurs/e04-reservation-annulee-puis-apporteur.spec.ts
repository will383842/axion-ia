// @formateurs — E04 · Réservation puis annulation ; puis réservation APPORTEUR de
// la même personne.
//
//   1. invitée (F1), la personne réserve son échange formateur (F3) ;
//   2. elle l'annule (livraison `invitee.canceled` signée) : plus aucun rappel F4 ;
//   3. elle réserve ensuite un échange APPORTEUR (autre famille, sa propre fiche) ;
//   4. à J+3 et J+7 : AUCUNE relance F2 — elle a réservé, même si elle a annulé ;
//   5. la console montre l'échange « Annulé ».
// Ni l'un ni l'autre rendez-vous n'entre au CRM.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { eventUriDe, rendezVousFictif } from "../fixtures/formateurs/calendly-simule";
import { etape } from "../fixtures/formateurs/etapes";
import { candidatureInvitee, reserverEchange } from "../fixtures/formateurs/parcours";
import {
  attendreLeWorker,
  gabaritsVers,
  jourOuvre,
  ouvrirScenario,
  plus,
  type DecorScenario,
} from "../fixtures/formateurs/scenario";

test.describe("@formateurs E04 — échange annulé, puis réservation apporteur", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(500_000);
  let decor: DecorScenario;

  test.beforeAll(async () => {
    // Les scénarios passent un par un (verrou) : l'attente peut être longue.
    test.setTimeout(20 * 60_000);
    decor = await ouvrirScenario("e04");
  });
  test.afterAll(async () => {
    await decor?.liberer();
    await prisma.$disconnect();
  });

  test("annulé : ni rappel ni relance ; la réservation apporteur reste à sa place", async () => {
    const email = decor.adresse("annule");
    const cand = await candidatureInvitee(email, "Elio");

    // 1. L'échange formateur, dans deux jours, et sa confirmation F3.
    const debut = plus(new Date(), { jours: 2 });
    const { rdv, ligne } = await reserverEchange(cand.id, email, "Elio", debut);
    expect(ligne.linkedJobApplicationId).toBe(cand.id);
    await etape({
      etape: "passage-echanges-formateur",
      args: { maintenant: new Date().toISOString() },
    });
    await attendreLeWorker(email);
    expect(await gabaritsVers(email)).toEqual([
      "candidature-recue",
      "formateur-invitation-echange",
      "formateur-echange-confirme",
    ]);

    // 2. L'annulation, signée, relue chez Calendly.
    const annule = { ...rdv, annule: true };
    const livraison = await etape<{ statut: number }>({
      etape: "livrer-webhook",
      args: { cle: rdv.cle, annulation: true },
      calendly: [annule],
    });
    expect(livraison.valeur.statut).toBe(200);
    const apresAnnulation = await prisma.calendlyEvent.findUniqueOrThrow({
      where: { id: ligne.id },
    });
    expect(apresAnnulation.status).toBe("canceled");
    expect(apresAnnulation.linkedJobApplicationId).toBe(cand.id);

    // 3. La réservation apporteur de la même personne : sa propre fiche, hors candidature.
    const apporteur = rendezVousFictif({
      nomType: "Échange apporteur d'affaires",
      typeConnu: "apporteur",
      prenom: "Elio",
      email,
      joursPlusTard: 3,
    });
    const livraisonApp = await etape<{ statut: number }>({
      etape: "livrer-webhook",
      args: { cle: apporteur.cle },
      calendly: [apporteur],
    });
    expect(livraisonApp.valeur.statut).toBe(200);
    const ligneApp = await prisma.calendlyEvent.findFirstOrThrow({
      where: { eventUri: eventUriDe(apporteur) },
    });
    expect(ligneApp.typeRendezVous).toBe("apporteur");
    expect(ligneApp.linkedSubmissionId).not.toBeNull();
    expect(ligneApp.linkedJobApplicationId).toBeNull();

    // 4. Les rappels de l'échange annulé ne partent pas ; les relances F2 non plus.
    for (const avant of [{ minutes: -1445 }, { minutes: -65 }]) {
      await etape({
        etape: "passage-echanges-formateur",
        args: { maintenant: plus(debut, avant).toISOString() },
      });
    }
    const inv = cand.invitationFormateurAt as Date;
    for (const j of [3, 7]) {
      await etape({
        etape: "passage-campagnes",
        args: { maintenant: jourOuvre(inv, j).toISOString() },
      });
    }
    await attendreLeWorker(email);
    const envois = await gabaritsVers(email);
    expect(envois).not.toContain("formateur-invitation-relance");
    expect(envois).not.toContain("formateur-echange-rappel");
    expect(envois.filter((g) => g.startsWith("formateur-"))).toEqual([
      "formateur-invitation-echange",
      "formateur-echange-confirme",
    ]);

    // 5. La console dit « Annulé » (liste des échanges formateur, onglet du pont).
    const liste = await etape<Array<{ id: string; etat: string }>>({
      etape: "lister-pont",
      args: { maintenant: new Date().toISOString() },
    });
    expect(liste.valeur.find((e) => e.id === ligne.id)?.etat).toBe("annule");

    // Ni l'un ni l'autre n'entre au CRM.
    expect(
      await prisma.crmSyncOutbox.count({
        where: {
          subjectRef: {
            in: [`site:calendly_event:${ligne.id}`, `site:calendly_event:${ligneApp.id}`],
          },
        },
      }),
    ).toBe(0);
  });
});
