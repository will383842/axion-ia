/**
 * L12i — présentation de la méthode payée, CONTRE UN VRAI POSTGRES.
 *
 *   · tant que M-D n'est pas fait, ou que le CHECK historique
 *     `ck_fee_line_une_seule_prestation` refuse une ligne sans prestation, RIEN
 *     n'est écrit (refus net, jamais une écriture tentée) ;
 *   · les deux simulés dans la transaction annulée : un relevé « hors mission »
 *     à valider, 175 € HT au régime de la fiche, échéance date + 30 jours, une
 *     ligne `presentation_methode`, une entrée de journal ciblant le relevé ;
 *   · une seconde présentation est refusée ; un contrat non signé aussi.
 *
 * Chaque cas vit dans SA transaction, ANNULÉE.
 */

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { PrismaClient } from "../../../prisma/generated/client";
import { ecrirePresentationMethode } from "../../../src/server/qualiopi/formateurs-independants/paiement/presentation-methode-base";

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
const ANNULE = new Error("ANNULE");
const MAINTENANT = new Date("2031-11-21T09:00:00Z");
const CONTRAT = new Date("2031-11-02T10:00:00Z");

async function dansTransactionAnnulee(fn: (tx: Tx) => Promise<void>): Promise<void> {
  if (!process.env["DATABASE_URL"]) throw new Error("DATABASE_URL absent : ce test exige Postgres");
  const db = new PrismaClient();
  try {
    await expect(
      db.$transaction(
        async (tx) => {
          await fn(tx);
          throw ANNULE;
        },
        { timeout: 60_000 },
      ),
    ).rejects.toBe(ANNULE);
  } finally {
    await db.$disconnect();
  }
}

/** M-D et l'élargissement du CHECK, simulés DANS la transaction annulée. */
async function schemaPret(tx: Tx): Promise<void> {
  await tx.$executeRawUnsafe(`DROP INDEX "statement_unique_trainer_periode"`);
  await tx.$executeRawUnsafe(
    `ALTER TABLE "trainer_fee_lines" DROP CONSTRAINT "ck_fee_line_une_seule_prestation"`,
  );
  await tx.$executeRawUnsafe(
    `ALTER TABLE "trainer_fee_lines" ADD CONSTRAINT "ck_fee_line_une_seule_prestation" CHECK (
       (CASE WHEN "session_id" IS NOT NULL THEN 1 ELSE 0 END)
     + (CASE WHEN "coaching_session_id" IS NOT NULL THEN 1 ELSE 0 END)
     + (CASE WHEN "booking_id" IS NOT NULL THEN 1 ELSE 0 END)
     + (CASE WHEN "audit_mission_id" IS NOT NULL THEN 1 ELSE 0 END)
     = 1
     OR ("objet" = 'presentation_methode' AND "session_id" IS NULL AND "coaching_session_id" IS NULL
         AND "booking_id" IS NULL AND "audit_mission_id" IS NULL)
     )`,
  );
}

async function fixture(
  tx: Tx,
  regime = "franchise_293b",
): Promise<{ trainerId: string; userId: string }> {
  const trainerId = randomUUID();
  const userId = randomUUID();
  await tx.$executeRawUnsafe(
    `INSERT INTO "trainers" ("id", "nom", "prenom", "email", "statut", "regime_tva_honoraires", "updated_at")
     VALUES ($1::uuid, 'Test', 'Presentation', $2, 'sous_traitant', $3::"TvaRegimeHonoraires", now())`,
    trainerId,
    `presentation-${trainerId}@example.invalid`,
    regime,
  );
  await tx.$executeRawUnsafe(
    `INSERT INTO "admin_users" ("id", "name", "email", "password_hash", "updated_at")
     VALUES ($1::uuid, 'Test', $2, 'x', now())`,
    userId,
    `admin-${userId}@example.invalid`,
  );
  return { trainerId, userId };
}

describe("L12i — présentation de la méthode (vraie base)", () => {
  it("M-D non fait → refus, rien d'écrit ; M-D fait mais CHECK historique → refus, rien d'écrit", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const { trainerId, userId } = await fixture(tx);
      const d = {
        trainerId,
        userId,
        jour: "2031-11-20",
        contratSigneLe: CONTRAT,
        contratVersion: 3,
        maintenant: MAINTENANT,
      };
      expect(await ecrirePresentationMethode(tx, d)).toEqual({
        issue: "refuse",
        motif: "contract_non_fait",
      });
      await tx.$executeRawUnsafe(`DROP INDEX "statement_unique_trainer_periode"`);
      expect(await ecrirePresentationMethode(tx, d)).toEqual({
        issue: "refuse",
        motif: "schema_hors_mission_absent",
      });
      expect(await tx.trainerStatement.count({ where: { trainerId } })).toBe(0);
      expect(await tx.trainerFeeLine.count({ where: { trainerId } })).toBe(0);
    });
  });

  it("S22 (assujetti) : relevé hors mission 175 € HT + 35 € TVA, échéance date + 30 j, journal ; seconde présentation refusée", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await schemaPret(tx);
      const { trainerId, userId } = await fixture(tx, "assujetti_20");
      const d = {
        trainerId,
        userId,
        jour: "2031-11-20",
        contratSigneLe: CONTRAT,
        contratVersion: 3,
        maintenant: MAINTENANT,
      };
      const r = await ecrirePresentationMethode(tx, d);
      expect(r).toMatchObject({ issue: "ecrite", totalTtcCents: 21_000 });
      const id = (r as { statementId: string }).statementId;
      const s = await tx.trainerStatement.findUniqueOrThrow({
        where: { id },
        include: { feeLines: true },
      });
      expect([
        s.origine,
        s.sessionId,
        s.statut,
        s.tvaRegime,
        s.totalHtCents,
        s.tvaCents,
        s.totalTtcCents,
        s.periodeYear,
        s.periodeMonth,
      ]).toEqual([
        "passage_mission",
        null,
        "a_valider",
        "assujetti_20",
        17_500,
        3_500,
        21_000,
        2031,
        11,
      ]);
      expect(s.echeanceAt?.toISOString().slice(0, 10)).toBe("2031-12-20");
      expect(s.feeLines.map((l) => [l.objet, l.montantHtCents, l.sessionId, l.nature])).toEqual([
        ["presentation_methode", 17_500, null, "honoraire_du"],
      ]);
      const journal = await tx.activityLog.findMany({
        where: { action: "qualiopi.remuneration.presentation_methode_ecrite", targetId: id },
      });
      expect(journal).toHaveLength(1);
      expect(journal[0]!.adminUserId).toBe(userId);

      // Seconde présentation, même un autre mois : refusée, rien de plus en base.
      expect(await ecrirePresentationMethode(tx, { ...d, jour: "2031-11-21" })).toEqual({
        issue: "refuse",
        motif: "deja_payee",
      });
      expect(await tx.trainerFeeLine.count({ where: { trainerId } })).toBe(1);
    });
  });

  it("contrat-cadre non signé → refus, rien d'écrit", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await schemaPret(tx);
      const { trainerId, userId } = await fixture(tx);
      expect(
        await ecrirePresentationMethode(tx, {
          trainerId,
          userId,
          jour: "2031-11-20",
          contratSigneLe: null,
          contratVersion: null,
          maintenant: MAINTENANT,
        }),
      ).toEqual({ issue: "refuse", motif: "contrat_non_signe" });
      expect(await tx.trainerStatement.count({ where: { trainerId } })).toBe(0);
    });
  });
});
