/**
 * Prolongation de validité d'un devis, contre un VRAI Postgres (Gate D :
 * `pnpm test:integration tests/integration/devis`). Transaction TOUJOURS annulée : base vide.
 *
 * Les écritures rejouent celles de `prolongerValiditeDevisAction` (même `where`, même `data`) ;
 * la clause d'expiration est celle du worker (`pasSigneParLeClient`, importée).
 *
 * Sans `DATABASE_URL`, ce fichier ÉCHOUE — il ne se saute pas.
 */

import { describe, expect, it } from "vitest";

import { PrismaClient } from "../../../prisma/generated/client";
import { pasSigneParLeClient } from "../../../src/server/qualiopi/devis/pas-signe-par-le-client";

const ANNULE = new Error("ANNULE — la transaction de test ne laisse aucune ligne");
const JOUR = 86_400_000;

async function dansTransactionAnnulee(
  corps: (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<void>,
) {
  const db = new PrismaClient();
  try {
    await expect(
      db.$transaction(async (tx) => {
        await corps(tx);
        throw ANNULE;
      }),
    ).rejects.toBe(ANNULE);
  } finally {
    await db.$disconnect();
  }
}

describe("prolongation de validité contre un vrai Postgres (Gate D)", () => {
  it("expire_vers_envoye_puis_clause_du_cron_ne_le_reexpire_pas", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const hier = new Date(Date.now() - JOUR);
      const client = await tx.client.create({
        data: { numero: "TEST-CLI-PV1", raisonSociale: "Client test PV1" },
      });
      const devis = await tx.devis.create({
        data: {
          numero: "TEST-DEV-PV1",
          clientId: client.id,
          lignes: [],
          montantTotalHtCents: 100000,
          mentionTva: "TVA 20 %",
          statut: "expire",
          dateValidite: hier,
          sentAt: new Date(Date.now() - 10 * JOUR),
        },
      });

      const demain = new Date(Date.now() + 5 * JOUR);
      const { count } = await tx.devis.updateMany({
        where: {
          id: devis.id,
          statut: { in: ["envoye", "expire"] },
          dateValidite: devis.dateValidite,
          ...pasSigneParLeClient,
        },
        data: { dateValidite: demain, statut: "envoye" },
      });
      expect(count).toBe(1);

      // Clause d'expiration du worker : une date future n'est pas ré-expirée.
      const reexpire = await tx.devis.updateMany({
        where: {
          id: devis.id,
          statut: "envoye",
          dateValidite: { lt: new Date() },
          ...pasSigneParLeClient,
        },
        data: { statut: "expire" },
      });
      expect(reexpire.count).toBe(0);
      const apres = await tx.devis.findUniqueOrThrow({
        where: { id: devis.id },
        select: { statut: true },
      });
      expect(apres.statut).toBe("envoye");
    });
  });

  it("outbox_devis_emis_une_seule_ligne_apres_deux_prolongations", async () => {
    await dansTransactionAnnulee(async (tx) => {
      // Même écriture que `ecrireEvenementPartners` : `event_id` déterministe + skipDuplicates.
      const eventId = "5b1c1f0e-0000-4000-8000-0000000000e1";
      const ecrire = () =>
        tx.partnersSyncOutbox.createMany({
          data: [
            {
              eventId,
              eventType: "devis.emis",
              subjectRef: "devis:TEST-PV2",
              corps: "{}",
            },
          ],
          skipDuplicates: true,
        });
      await ecrire();
      await ecrire();
      const lignes = await tx.partnersSyncOutbox.count({ where: { eventId } });
      expect(lignes).toBe(1);
    });
  });

  it("updateMany_conditionnel_echoue_si_date_changee", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const client = await tx.client.create({
        data: { numero: "TEST-CLI-PV3", raisonSociale: "Client test PV3" },
      });
      const lue = new Date(Date.now() + 2 * JOUR);
      const devis = await tx.devis.create({
        data: {
          numero: "TEST-DEV-PV3",
          clientId: client.id,
          lignes: [],
          montantTotalHtCents: 100000,
          mentionTva: "TVA 20 %",
          statut: "envoye",
          dateValidite: lue,
          sentAt: new Date(),
        },
      });
      // Un autre onglet a déjà changé la date depuis la lecture.
      await tx.devis.update({
        where: { id: devis.id },
        data: { dateValidite: new Date(Date.now() + 4 * JOUR) },
      });
      const { count } = await tx.devis.updateMany({
        where: {
          id: devis.id,
          statut: { in: ["envoye", "expire"] },
          dateValidite: lue,
          ...pasSigneParLeClient,
        },
        data: { dateValidite: new Date(Date.now() + 9 * JOUR), statut: "envoye" },
      });
      expect(count).toBe(0);
    });
  });
});
