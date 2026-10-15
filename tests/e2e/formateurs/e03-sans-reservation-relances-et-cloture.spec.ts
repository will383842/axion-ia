// @formateurs — E03 · Pas de réservation : F2 à J+3 et J+7, rien après J+14,
// une tuile, puis clôture « sans suite » à J+30, SANS e-mail.
//
// Les passages sont ceux du worker : `passerCampagnes` (relances F2) et
// `passerInvitationsFormateurs` (qui porte la clôture), chacun avec son
// `maintenant`. Les relances ne partent qu'entre 8 h et 19 h (Paris) : chaque
// instant est pris à la prochaine heure ouvrée (`jourOuvre`).

import { expect, test } from "@playwright/test";

import { resumeInvitationFormateur } from "@/lib/careers/invitation-formateur-resume";

import { prisma } from "../fixtures/formateurs/base";
import { etape } from "../fixtures/formateurs/etapes";
import { candidatureInvitee } from "../fixtures/formateurs/parcours";
import {
  attendreLeWorker,
  gabaritsVers,
  jourOuvre,
  ouvrirScenario,
  plus,
  sujetsCaptes,
  type DecorScenario,
} from "../fixtures/formateurs/scenario";

test.describe("@formateurs E03 — sans réservation : relances puis clôture", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(400_000);
  let decor: DecorScenario;

  test.beforeAll(async () => {
    // Les scénarios passent un par un (verrou) : l'attente peut être longue.
    test.setTimeout(45 * 60_000);
    decor = await ouvrirScenario("e03");
  });
  test.afterAll(async () => {
    await decor?.liberer();
    await prisma.$disconnect();
  });

  test("F2 à J+3 et J+7, rien à J+14 ni J+15, clôture à J+30 sans e-mail", async () => {
    const email = decor.adresse("silencieuse");
    const cand = await candidatureInvitee(email, "Romy");
    const inv = cand.invitationFormateurAt as Date;
    const relancer = async (maintenant: Date) => {
      await etape({ etape: "passage-campagnes", args: { maintenant: maintenant.toISOString() } });
      await attendreLeWorker(email);
    };

    // Avant J+3 : rien.
    await relancer(jourOuvre(inv, 2));
    expect(await gabaritsVers(email)).toEqual([
      "candidature-recue",
      "formateur-invitation-echange",
    ]);

    await relancer(jourOuvre(inv, 3));
    await relancer(jourOuvre(inv, 7));
    const f2 = ["formateur-invitation-relance", "formateur-invitation-relance"];
    const attendus = ["candidature-recue", "formateur-invitation-echange", ...f2];
    expect(await gabaritsVers(email)).toEqual(attendus);
    // Les deux relances sont les deux étapes distinctes (J+3 puis J+7).
    const relances = await prisma.emailLog.findMany({
      where: { recipient: email, template: "formateur-invitation-relance" },
      orderBy: { createdAt: "asc" },
      select: { jobId: true, status: true },
    });
    expect(relances.map((r) => r.status)).toEqual(["sent", "sent"]);
    expect(relances[0]?.jobId).toMatch(/j3$/);
    expect(relances[1]?.jobId).toMatch(/j7$/);

    // Après J+14 : plus rien.
    for (const j of [8, 14, 15, 21]) await relancer(jourOuvre(inv, j));
    expect(await gabaritsVers(email)).toEqual(attendus);
    await expect.poll(async () => (await sujetsCaptes(email)).length, { timeout: 30_000 }).toBe(4);

    // J+29 : pas encore close.
    await etape({
      etape: "passage-invitations",
      args: { maintenant: plus(inv, { jours: 29, heures: 23 }).toISOString() },
    });
    expect(
      (await prisma.jobApplication.findUniqueOrThrow({ where: { id: cand.id } }))
        .clotureSansSuiteAt,
    ).toBeNull();

    // J+30 : close « sans suite », sans e-mail, sans changer le statut.
    const j30 = plus(inv, { jours: 30, heures: 1 });
    await etape({ etape: "passage-invitations", args: { maintenant: j30.toISOString() } });
    const close = await prisma.jobApplication.findUniqueOrThrow({ where: { id: cand.id } });
    expect(close.clotureSansSuiteAt).toEqual(j30);
    expect(close.status).toBe("new");
    await relancer(jourOuvre(inv, 31));
    expect(await gabaritsVers(email)).toEqual(attendus);
    expect(resumeInvitationFormateur(close, j30)).toMatch(/sans suite/);
  });

  // V1-A-4 — après J+14, une personne invitée qui n'a ni réservé ni répondu apparaît dans la
  // tuile « Invitées, à décider » du suivi des candidatures (et sa fiche le dit). L'oracle
  // lit la tuile (étape `a-decider`), pas une phrase du résumé.
  test("V1-A-4 — après J+14, la tuile « à décider » liste la personne", async () => {
    const email = decor.adresse("a-decider");
    const cand = await candidatureInvitee(email, "Sacha");
    const inv = cand.invitationFormateurAt as Date;
    const tuile = async (maintenant: Date) =>
      (
        await etape<Array<{ candidatureId: string }>>({
          etape: "a-decider",
          args: { maintenant: maintenant.toISOString() },
        })
      ).valeur.map((l) => l.candidatureId);

    // Avant J+14 : pas dans la tuile.
    expect(await tuile(jourOuvre(inv, 10))).not.toContain(cand.id);
    // Après J+14, sans réservation ni réponse : dans la tuile.
    const j15 = jourOuvre(inv, 15);
    expect(await tuile(j15)).toContain(cand.id);
    const phrase = await etape<string>({
      etape: "resume-invitation",
      args: { candidatureId: cand.id, maintenant: j15.toISOString() },
    });
    expect(phrase.valeur).toMatch(/À décider/);
    // Close « sans suite » à J+30 : elle sort de la tuile.
    await prisma.jobApplication.update({
      where: { id: cand.id },
      data: { clotureSansSuiteAt: jourOuvre(inv, 30) },
    });
    expect(await tuile(jourOuvre(inv, 31))).not.toContain(cand.id);
  });
});
