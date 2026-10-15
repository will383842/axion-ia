// @formateurs — E05 · Une vraie réponse arrête les relances ; une réponse
// automatique n'a AUCUN effet.
//
// Deux personnes invitées (F1 parti). Avant J+3, chacune « répond » dans la boîte
// de réception, relevée par le relevé réel des réponses aux candidatures sur une
// boîte simulée :
//   · l'une écrit vraiment → relances arrêtées (aucune F2, ni à J+3 ni à J+7) ;
//   · l'autre renvoie un message d'absence (`Auto-Submitted: auto-replied`) →
//     enregistré comme automatique, et ses relances partent comme si de rien n'était.
// Décision du dirigeant (d) : une vraie réponse du formateur arrête ses relances.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { etape } from "../fixtures/formateurs/etapes";
import { candidatureInvitee } from "../fixtures/formateurs/parcours";
import {
  attendreLeWorker,
  gabaritsVers,
  jourOuvre,
  ouvrirScenario,
  plus,
  type DecorScenario,
} from "../fixtures/formateurs/scenario";

test.describe("@formateurs E05 — réponse humaine, réponse automatique", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(400_000);
  let decor: DecorScenario;

  test.beforeAll(async () => {
    // Les scénarios passent un par un (verrou) : l'attente peut être longue.
    test.setTimeout(45 * 60_000);
    decor = await ouvrirScenario("e05");
  });
  test.afterAll(async () => {
    await decor?.liberer();
    await prisma.$disconnect();
  });

  test("la réponse humaine arrête F2, l'absence automatique ne change rien", async () => {
    const humaine = decor.adresse("repond");
    const automate = decor.adresse("absente");
    const candH = await candidatureInvitee(humaine, "Yanis");
    const candA = await candidatureInvitee(automate, "Zélie");
    const f1Envoyee = await prisma.emailLog.findFirstOrThrow({
      where: { recipient: humaine, template: "formateur-invitation-echange", status: "sent" },
    });
    expect(f1Envoyee.sentAt).not.toBeNull();

    // Les deux messages arrivent après F1, avant J+3.
    const recu = plus(new Date(), { minutes: 1 });
    const releve = await etape<{
      reconnus: number;
      enregistrees: { humaines: number; automatiques: number };
    }>({
      etape: "releve-reponses",
      args: {
        maintenant: plus(recu, { minutes: 2 }).toISOString(),
        messages: [
          {
            cle: "humaine",
            de: humaine,
            recuLe: recu.toISOString(),
            sujet: "Re: Échangeons 20 minutes",
            resume: "Bonjour, je suis disponible mardi matin, merci !",
          },
          {
            cle: "automate",
            de: automate,
            recuLe: recu.toISOString(),
            sujet: "Réponse automatique : absente",
            resume: "Je suis absente jusqu'au 30, je lirai votre message à mon retour.",
            entetes: { "auto-submitted": "auto-replied" },
          },
        ],
      },
    });
    expect(releve.valeur.reconnus).toBe(2);
    expect(releve.valeur.enregistrees).toEqual({ humaines: 1, automatiques: 1 });
    const reponses = await prisma.jobApplicationInboundReply.findMany({
      where: { applicationId: { in: [candH.id, candA.id] } },
      select: { applicationId: true, auto: true },
    });
    expect(reponses).toEqual(
      expect.arrayContaining([
        { applicationId: candH.id, auto: false },
        { applicationId: candA.id, auto: true },
      ]),
    );

    // J+3 puis J+7.
    const inv = candA.invitationFormateurAt as Date;
    for (const j of [3, 7]) {
      await etape({
        etape: "passage-campagnes",
        args: { maintenant: jourOuvre(inv, j).toISOString() },
      });
    }
    await attendreLeWorker(humaine);
    await attendreLeWorker(automate);
    expect(await gabaritsVers(humaine)).toEqual([
      "candidature-recue",
      "formateur-invitation-echange",
    ]);
    expect(await gabaritsVers(automate)).toEqual([
      "candidature-recue",
      "formateur-invitation-echange",
      "formateur-invitation-relance",
      "formateur-invitation-relance",
    ]);
    // La réponse humaine ne clôt rien et ne décide rien : elle arrête seulement les rappels.
    const h = await prisma.jobApplication.findUniqueOrThrow({ where: { id: candH.id } });
    expect(h).toMatchObject({ status: "new", clotureSansSuiteAt: null });
  });
});
