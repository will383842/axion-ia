// @formateurs — E37 · Le PONT : un échange réservé par le lien du composeur
// (`depuis=fa-<id>`) AVANT l'allumage du suivi.
//
//   1. suivi de l'échange COUPÉ (la période du pont) : la réservation arrive, rien
//      ne la rattache, rien ne part ;
//   2. suivi rallumé, « Relire les échanges du pont » : l'enrichissement normal relit
//      Calendly, trouve le marqueur `fa-<id>` → rattaché ;
//   3. l'issue est « à trancher » dans la tuile (liste du pont et « À faire le point ») ;
//   4. F5 seulement après l'aperçu ET la confirmation : sans confirmation, refus, ni
//      fiche ni e-mail.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import type { RendezVousSimule } from "../fixtures/formateurs/calendly-simule";
import { etape } from "../fixtures/formateurs/etapes";
import { semerInterrupteurs } from "../fixtures/formateurs/interrupteurs";
import { deposerCandidature, reserverEchange } from "../fixtures/formateurs/parcours";
import {
  attendreLeWorker,
  gabaritsVers,
  ouvrirScenario,
  plus,
  type DecorScenario,
} from "../fixtures/formateurs/scenario";

test.describe("@formateurs E37 — pont : échange réservé par le lien du composeur", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(400_000);
  let decor: DecorScenario;

  test.beforeAll(async () => {
    // Les scénarios passent un par un (verrou) : l'attente peut être longue.
    test.setTimeout(20 * 60_000);
    decor = await ouvrirScenario("e37");
  });
  test.afterAll(async () => {
    await decor?.liberer();
    await prisma.$disconnect();
  });

  test("rattaché à la relecture, à trancher, F5 seulement après aperçu et confirmation", async () => {
    const email = decor.adresse("pont");
    const cand = await deposerCandidature(email, "Orane");
    await attendreLeWorker(email);

    // 1. La période du pont : suivi coupé (le verrou des scénarios est tenu, aucun autre
    //    scénario ne tourne), puis remis à l'état d'avant.
    const remettre = await semerInterrupteurs({ "formateurs.suivi_echange": { actif: false } });
    let echangeId: string;
    let rdv: RendezVousSimule;
    try {
      const reserve = await reserverEchange(
        cand.id,
        email,
        "Orane",
        plus(new Date(), { minutes: -70 }),
      );
      echangeId = reserve.ligne.id;
      rdv = reserve.rdv;
      expect(reserve.ligne.linkedJobApplicationId).toBeNull();
    } finally {
      await remettre();
    }
    const avant = await etape<Array<{ id: string; etat: string }>>({
      etape: "lister-pont",
      args: { maintenant: new Date().toISOString() },
    });
    expect(avant.valeur.find((e) => e.id === echangeId)?.etat).toBe("a_verifier");

    // 2. La relecture, par l'API Calendly (simulée) : le marqueur rattache.
    const relu = await etape<{ rattaches: number }>({
      etape: "relire-pont",
      args: { maintenant: new Date().toISOString() },
      calendly: [rdv],
    });
    expect(relu.valeur.rattaches).toBe(1);
    expect(
      (await prisma.calendlyEvent.findUniqueOrThrow({ where: { id: echangeId } }))
        .linkedJobApplicationId,
    ).toBe(cand.id);

    // 3. À trancher : dans la liste du pont et dans la tuile « À faire le point ».
    const maintenant = new Date().toISOString();
    const pont = await etape<Array<{ id: string; etat: string }>>({
      etape: "lister-pont",
      args: { maintenant },
    });
    expect(pont.valeur.find((e) => e.id === echangeId)?.etat).toBe("a_trancher");
    const tuile = await etape<Array<{ id: string; echangeFormateur: boolean; rattache: boolean }>>({
      etape: "a-faire-le-point",
      args: { maintenant },
    });
    expect(tuile.valeur.find((r) => r.id === echangeId)).toMatchObject({
      echangeFormateur: true,
      rattache: true,
    });

    // 4. « Retenu » : sans confirmation, refus — ni fiche, ni e-mail.
    const apercu = await etape<{ etat: string; email: { destinataire: string } | null }>({
      etape: "apercu-issue",
      args: { calendlyEventId: echangeId, issue: "retenu" },
      session: decor.admin,
    });
    expect(apercu.valeur.etat).toBe("apercu");
    expect(apercu.valeur.email?.destinataire).toBe(email);
    const refus = await etape<{ etat: string }>({
      etape: "enregistrer-issue",
      args: { calendlyEventId: echangeId, issue: "retenu" },
      session: decor.admin,
    });
    expect(refus.valeur.etat).toBe("erreur");
    expect(await prisma.trainer.count({ where: { candidatureId: cand.id } })).toBe(0);
    expect(await gabaritsVers(email)).toEqual(["candidature-recue"]);

    const retenu = await etape<{ etat: string; message?: string }>({
      etape: "enregistrer-issue",
      args: { calendlyEventId: echangeId, issue: "retenu", confirmer: true },
      session: decor.admin,
    });
    expect(retenu.valeur.etat, retenu.valeur.message).not.toBe("erreur");
    await attendreLeWorker(email);
    expect(await gabaritsVers(email)).toEqual(["candidature-recue", "formateur-issue-retenu"]);
    const fiche = await prisma.trainer.findFirstOrThrow({ where: { candidatureId: cand.id } });
    expect(fiche).toMatchObject({
      statut: "sous_traitant",
      actif: false,
      dossierStatut: "en_cours",
    });
    const apres = await etape<Array<{ id: string; etat: string }>>({
      etape: "lister-pont",
      args: { maintenant: new Date().toISOString() },
    });
    expect(apres.valeur.find((e) => e.id === echangeId)?.etat).toBe("issue_notee");
  });
});
