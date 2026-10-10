// @formateurs — les ENVOIS, par la vraie file, jusqu'au puits SMTP.
//
// Ce spec n'a de sens que dans le job `banc-formateurs` (Redis réel, worker
// en tâche de fond, Mailpit en conteneur de service). Il y prouve deux choses
// que Gate B, sous `BULLMQ_DISABLED`, ne peut pas voir :
//
//   (1) un e-mail d'un parcours FORMATEUR (`formateur-rappel-j1`, le rappel de
//       la veille de session) enfilé par `enqueueEmail` part par le worker, est
//       CAPTÉ par le puits, et le journal des envois le dit `sent` ;
//   (2) un rappel DÉJÀ EN FILE est RETENU AU DÉPART quand l'opposition arrive
//       après l'enfilage : le worker relit l'état (`motifDeRetenueAuDepart`),
//       clôt la ligne en `cancelled`, et rien n'atteint le puits.
//
// Pour (2), le gabarit est `apporteur-invitation-relance` : c'est aujourd'hui
// le rappel que la garde du départ couvre (`GABARITS_SOLLICITATION_SOUMIS_A_
// OPPOSITION`). Les rappels de la campagne formateurs la rejoindront ; ce test
// est la preuve qu'ils hériteront d'une garde qui tient.

import { expect, test } from "@playwright/test";

import { hashEmailForLookup } from "@/lib/security/email-hash";

import { prisma } from "../fixtures/formateurs/base";
import { executerCoteServeur } from "../fixtures/formateurs/execution";
import { lireJournalEnvois } from "../fixtures/formateurs/journal-envois";
import type { ResultatEnfilage } from "../fixtures/formateurs/protocole";
import { messagesCaptes, URL_PUITS, viderPuitsPour } from "../fixtures/formateurs/puits-smtp";

/** Le worker tourne à part : on lui laisse le temps de prendre le job. */
const ATTENTE = { timeout: 60_000, intervals: [500, 1_000, 2_000] };

function adresseDuBanc(role: string): string {
  return `${role}.banc.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.test`;
}

async function effacerTraces(adresse: string): Promise<void> {
  await prisma.emailLog.deleteMany({ where: { recipient: adresse } });
  const empreinte = hashEmailForLookup(adresse);
  if (empreinte !== null) {
    await prisma.emailOpposition.deleteMany({ where: { emailHash: empreinte } });
  }
  await viderPuitsPour(adresse);
}

test.describe("@formateurs envois par la file — puits SMTP", () => {
  test.setTimeout(120_000);
  // Hors du job du banc (pas de puits) : rien à mesurer. DANS le job, une
  // absence du puits est une faute de câblage, pas un saut.
  test.skip(
    !URL_PUITS && process.env["BANC_FORMATEURS"] !== "1",
    "hors du job banc-formateurs : ni file ni puits SMTP",
  );

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("(1) un e-mail du parcours formateur est capté par le puits et journalisé « sent »", async () => {
    const adresse = adresseDuBanc("formateur");
    try {
      const enfilage = await executerCoteServeur<ResultatEnfilage>({
        action: "enfiler-email",
        gabarit: "formateur-rappel-j1",
        destinataire: adresse,
      });
      expect(enfilage).toEqual({ enqueued: true });

      await expect
        .poll(async () => (await lireJournalEnvois({ destinataire: adresse }))[0]?.status, ATTENTE)
        .toBe("sent");
      const journal = await lireJournalEnvois({ destinataire: adresse });
      expect(journal.map((l) => [l.template, l.status])).toEqual([["formateur-rappel-j1", "sent"]]);

      await expect.poll(async () => (await messagesCaptes(adresse)).length, ATTENTE).toBe(1);
      const [message] = await messagesCaptes(adresse);
      expect(message?.destinataires).toEqual([adresse]);
      expect(message?.sujet.trim().length ?? 0).toBeGreaterThan(0);
    } finally {
      await effacerTraces(adresse);
    }
  });

  test("(2) un rappel déjà en file est RETENU au départ par l'opposition arrivée après", async () => {
    const adresse = adresseDuBanc("rappel");
    try {
      const enfilage = await executerCoteServeur<ResultatEnfilage>({
        action: "enfiler-email",
        gabarit: "apporteur-invitation-relance",
        destinataire: adresse,
        // Il dort en file, comme une relance J+3 : l'opposition arrive pendant.
        delaiMs: 15_000,
      });
      expect(enfilage).toEqual({ enqueued: true });
      expect((await lireJournalEnvois({ destinataire: adresse })).map((l) => l.status)).toEqual([
        "pending",
      ]);

      // Écrite EN DIRECT, et pas par `enregistrerOppositionPourAdresse` : ce
      // geste-là retire aussi le job de la file (`annulerEnvoisProgrammes`), et
      // c'est la garde du DÉPART qu'on prouve — celle qui tient quand la file
      // n'a pas pu être nettoyée (Redis muet au clic, opposition par un autre
      // canal).
      const empreinte = hashEmailForLookup(adresse);
      expect(empreinte).not.toBeNull();
      await prisma.emailOpposition.create({
        data: { emailHash: empreinte ?? "", source: "banc-formateurs" },
      });

      await expect
        .poll(async () => (await lireJournalEnvois({ destinataire: adresse }))[0]?.status, ATTENTE)
        .toBe("cancelled");
      const ligne = await prisma.emailLog.findFirst({
        where: { recipient: adresse },
        select: { template: true, error: true },
      });
      expect(ligne?.template).toBe("apporteur-invitation-relance");
      expect(ligne?.error).toMatch(/^Retenu à l'envoi : la personne s'est opposée/);

      // Le puits ne voit rien — et la ligne est close, donc rien ne viendra.
      expect(await messagesCaptes(adresse)).toEqual([]);
    } finally {
      await effacerTraces(adresse);
    }
  });
});
