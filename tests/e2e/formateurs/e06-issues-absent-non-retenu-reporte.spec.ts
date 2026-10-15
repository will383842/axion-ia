// @formateurs — E06 · Les issues d'un échange formateur, et ce que chacune envoie.
//
//   · « Absent » → F7 (une seule fois par personne), après aperçu et confirmation ;
//   · second « Absent » → aucun e-mail, et la console suggère « Non retenu » ;
//   · « Reporté » et « À revoir » → rien ne part ;
//   · « Non retenu » → F6, après aperçu et confirmation.
// La même personne, cinq échanges passés (chacun rattaché à sa candidature par
// le marqueur `fa-<id>`), notés par l'action de la console.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { etape } from "../fixtures/formateurs/etapes";
import { deposerCandidature, reserverEchange } from "../fixtures/formateurs/parcours";
import {
  attendreLeWorker,
  gabaritsVers,
  ouvrirScenario,
  plus,
  type DecorScenario,
} from "../fixtures/formateurs/scenario";

interface Apercu {
  etat: string;
  email: { destinataire: string } | null;
  sansEmail: string | null;
  message?: string;
}

test.describe("@formateurs E06 — absent, non retenu, reporté, à revoir", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(500_000);
  let decor: DecorScenario;
  let email = "";
  let candidatureId = "";
  const echanges: string[] = [];

  test.beforeAll(async () => {
    // Les scénarios passent un par un (verrou) : l'attente peut être longue.
    test.setTimeout(45 * 60_000);
    decor = await ouvrirScenario("e06");
    email = decor.adresse("issues");
    candidatureId = (await deposerCandidature(email, "Aël")).id;
    // Cinq échanges passés, du plus ancien au plus récent.
    for (let i = 5; i >= 1; i--) {
      const { ligne } = await reserverEchange(
        candidatureId,
        email,
        "Aël",
        // Dans la fenêtre de rattrapage de la découverte (2 h) : au plus 100 min passées.
        plus(new Date(), { minutes: -15 * i - 25 }),
      );
      expect(ligne.linkedJobApplicationId).toBe(candidatureId);
      echanges.push(ligne.id);
    }
  });
  test.afterAll(async () => {
    await decor?.liberer();
    await prisma.$disconnect();
  });

  async function noter(n: number, issue: string, extra: Record<string, unknown> = {}) {
    const calendlyEventId = echanges[n] as string;
    const apercu = await etape<Apercu>({
      etape: "apercu-issue",
      args: { calendlyEventId, issue },
      session: decor.admin,
    });
    expect(apercu.valeur.etat, apercu.valeur.message).toBe("apercu");
    const r = await etape<{ etat: string; message?: string }>({
      etape: "enregistrer-issue",
      args: { calendlyEventId, issue, confirmer: apercu.valeur.email !== null, ...extra },
      session: decor.admin,
    });
    expect(r.valeur.etat, r.valeur.message).not.toBe("erreur");
    await attendreLeWorker(email);
    return apercu.valeur;
  }

  test("ce que chaque issue envoie, et ce qu'elle n'envoie pas", async () => {
    // Premier « Absent » : F7, jamais sans confirmation.
    const refus = await etape<{ etat: string }>({
      etape: "enregistrer-issue",
      args: { calendlyEventId: echanges[0], issue: "absent" },
      session: decor.admin,
    });
    expect(refus.valeur.etat).toBe("erreur");
    expect(
      await prisma.rendezVousSuivi.count({ where: { calendlyEventId: echanges[0] ?? "∅" } }),
    ).toBe(0);
    const absent1 = await noter(0, "absent");
    expect(absent1.email?.destinataire).toBe(email);
    expect(await gabaritsVers(email)).toEqual(["candidature-recue", "formateur-issue-absent"]);

    // Second « Absent » : aucun e-mail.
    const absent2 = await noter(1, "absent");
    expect(absent2.email).toBeNull();
    expect(absent2.sansEmail).toMatch(/Deuxième absence/);

    // « Reporté » et « À revoir » : rien.
    expect((await noter(2, "reporte")).email).toBeNull();
    expect((await noter(3, "a_revoir", { rappelLe: "2026-12-01" })).email).toBeNull();
    expect(await gabaritsVers(email)).toEqual(["candidature-recue", "formateur-issue-absent"]);

    // « Non retenu » : F6.
    const nonRetenu = await noter(4, "non_retenu");
    expect(nonRetenu.email?.destinataire).toBe(email);
    expect(await gabaritsVers(email)).toEqual([
      "candidature-recue",
      "formateur-issue-absent",
      "formateur-issue-non-retenu",
    ]);
    const statuts = await prisma.emailLog.findMany({
      where: { recipient: email },
      select: { status: true },
    });
    expect(statuts.every((s) => s.status === "sent")).toBe(true);

    // L'état en base : cinq points notés ; aucune fiche formateur ; statut inchangé.
    const suivis = await prisma.rendezVousSuivi.findMany({
      where: { calendlyEventId: { in: echanges } },
      select: { calendlyEventId: true, issue: true, decision: true },
    });
    expect(suivis).toHaveLength(5);
    expect(await prisma.trainer.count({ where: { candidatureId } })).toBe(0);
    expect(
      (await prisma.jobApplication.findUniqueOrThrow({ where: { id: candidatureId } })).status,
    ).toBe("new");
  });

  // V1-A-5 — au second « Absent », la console dit seulement « Deuxième absence : aucun
  // nouveau créneau n'est proposé. » (`issue-formateur-envoi.ts`) : elle ne SUGGÈRE pas
  // « Non retenu », alors que la version apporteur le fait. Cf. rapport de vérification.
  test.fixme("V1-A-5 — au second « Absent », « Non retenu » est suggéré", async () => {
    const apercu = await etape<Apercu>({
      etape: "apercu-issue",
      args: { calendlyEventId: echanges[1], issue: "absent" },
      session: decor.admin,
    });
    expect(apercu.valeur.sansEmail).toMatch(/Non retenu/);
  });
});
