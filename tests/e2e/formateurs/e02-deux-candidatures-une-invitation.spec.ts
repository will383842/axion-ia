// @formateurs — E02 · La même personne postule deux fois : UNE seule invitation.
//
// Deux candidatures de la même adresse, à une heure d'intervalle (deux dépôts
// réels du formulaire). Le balayage F1 regroupe par personne (empreinte de
// l'adresse) : une invitation, jamais deux — ni dans le même passage, ni au
// passage suivant, ni sur la seconde candidature.

import { expect, test } from "@playwright/test";

import { SLUG_OFFRE_BANC } from "../fixtures/formateurs/allumage";
import { prisma } from "../fixtures/formateurs/base";
import { etape } from "../fixtures/formateurs/etapes";
import { ipSuivante } from "../fixtures/formateurs/parcours";
import {
  attendreLeWorker,
  candidaturesDe,
  gabaritsVers,
  ouvrirScenario,
  plus,
  type DecorScenario,
} from "../fixtures/formateurs/scenario";

test.describe("@formateurs E02 — deux candidatures, une invitation", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);
  let decor: DecorScenario;

  test.beforeAll(async () => {
    // Les scénarios passent un par un (verrou) : l'attente peut être longue.
    test.setTimeout(45 * 60_000);
    decor = await ouvrirScenario("e02");
  });
  test.afterAll(async () => {
    await decor?.liberer();
    await prisma.$disconnect();
  });

  test("une seule F1 par personne, la seconde candidature n'est pas invitée", async () => {
    const email = decor.adresse("deux-fois");
    for (const ip of [ipSuivante(), ipSuivante()]) {
      const depot = await etape<{ ok: boolean }>({
        etape: "deposer-candidature",
        args: { offre: SLUG_OFFRE_BANC, prenom: "Ilan", nom: "Banc-Essai", email },
        ip,
      });
      expect(depot.valeur.ok).toBe(true);
    }
    const [premiere, seconde] = await candidaturesDe(email);
    expect(premiere && seconde, "deux candidatures en base").toBeTruthy();
    if (!premiere || !seconde) return;

    // Les deux sont mûres au même passage : le passage n'en invite qu'une.
    const t = plus(seconde.submittedAt, { minutes: 16 });
    await etape({ etape: "passage-invitations", args: { maintenant: t } });
    // Et le passage suivant, cinq minutes plus tard, ne rattrape pas la seconde.
    await etape({ etape: "passage-invitations", args: { maintenant: plus(t, { minutes: 5 }) } });

    await attendreLeWorker(email);
    const envois = await gabaritsVers(email);
    expect(envois.filter((g) => g === "formateur-invitation-echange")).toHaveLength(1);
    expect(envois.filter((g) => g === "candidature-recue")).toHaveLength(2);

    const etats = await prisma.jobApplication.findMany({
      where: { id: { in: [premiere.id, seconde.id] } },
      select: { id: true, invitationFormateurAt: true, clotureSansSuiteAt: true, status: true },
    });
    expect(etats.filter((e) => e.invitationFormateurAt !== null)).toHaveLength(1);
    expect(etats.every((e) => e.status === "new" && e.clotureSansSuiteAt === null)).toBe(true);
  });
});
