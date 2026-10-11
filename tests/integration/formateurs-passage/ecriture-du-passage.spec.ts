/**
 * L12c — l'écriture d'un mois du paiement par mission CONTRE UN VRAI POSTGRES.
 *
 *   1. un mois payable écrit UN relevé `a_valider` et ses lignes, échéance fixe,
 *      revendication `par_mission`, entrée de journal (cible UUID) ;
 *   2. un second passage n'écrit RIEN (`deja_ecrit`) ;
 *   3. une session revendiquée d'abord par le relevé mensuel : abstention ;
 *   4. une ligne mensuelle vivante pour le couple : conflit, rien n'est écrit ;
 *   5. M-D simulé dans la transaction : relevé mensuel et relevé de mission du
 *      même mois coexistent.
 *
 * Chaque cas vit dans SA transaction, ANNULÉE : la base reste vide.
 */

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { PrismaClient } from "../../../prisma/generated/client";
import { calculerReleveDuMois } from "../../../src/server/qualiopi/formateurs-independants/argent/calcul-mission";
import { ecrireMoisDansTransaction } from "../../../src/server/qualiopi/formateurs-independants/paiement/passage-mission-base";
import type { MoisAEcrire } from "../../../src/server/qualiopi/formateurs-independants/paiement/passage-mission";
import {
  demiJourneesSignees,
  parMoisCivil,
} from "../../../src/server/qualiopi/remuneration/heures-animees";

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
const ANNULE = new Error("ANNULE");

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

async function fixture(tx: Tx): Promise<{ trainerId: string; sessionId: string }> {
  const s = randomUUID().slice(0, 8);
  const offre = randomUUID();
  const formation = randomUUID();
  const sessionId = randomUUID();
  const trainerId = randomUUID();
  await tx.$executeRawUnsafe(
    `INSERT INTO "offres_site" ("id", "code", "titre_fr", "slug", "format_pedagogique", "public_vise_fr",
       "duree_heures_min", "duree_heures_max", "tarif_type", "promesse_principale_fr", "angle_pedagogique_fr", "updated_at")
     VALUES ($1::uuid, $2, 'Offre', $3, 'collectif_1jour', 'Public', 7, 7, 'fixe', 'Promesse', 'Angle', now())`,
    offre,
    `TEST-PAS-${s}`,
    `offre-test-pas-${s}`,
  );
  await tx.$executeRawUnsafe(
    `INSERT INTO "formations" ("id", "numero", "titre", "slug", "offre_site_id", "duree_heures", "updated_at")
     VALUES ($1::uuid, $2, 'Formation', $3, $4::uuid, 7, now())`,
    formation,
    `TEST-FORM-PAS-${s}`,
    `formation-test-pas-${s}`,
    offre,
  );
  await tx.$executeRawUnsafe(
    `INSERT INTO "training_sessions" ("id", "numero", "titre_session", "formation_id", "date_debut", "date_fin",
       "modalite", "montant_ht_cents", "nb_participants_prevus", "statut", "updated_at")
     VALUES ($1::uuid, $2, 'Session', $3::uuid, '2031-12-03T08:00:00Z', '2031-12-03T16:00:00Z',
       'presentiel', 100000, 1, 'realisee', now())`,
    sessionId,
    `TEST-SESS-PAS-${s}`,
    formation,
  );
  await tx.$executeRawUnsafe(
    `INSERT INTO "trainers" ("id", "nom", "prenom", "email", "statut", "updated_at")
     VALUES ($1::uuid, 'Test', 'Passage', $2, 'sous_traitant', now())`,
    trainerId,
    `passage-${trainerId}@example.invalid`,
  );
  return { trainerId, sessionId };
}

function mois(trainerId: string, sessionId: string): MoisAEcrire {
  const [m] = parMoisCivil(demiJourneesSignees([{ jour: "2031-12-03", demiJournee: "journee" }]));
  return {
    trainerId,
    sessionId,
    releve: calculerReleveDuMois(m!, {
      tarifJourneeHtCents: 35_000,
      forfaitDeplacementParJourHtCents: null,
      regimeTva: "franchise_293b",
    }),
    regimeTva: "franchise_293b",
    tarifJourneeHtCents: 35_000,
    sansEcart: true,
  };
}

const MAINTENANT = new Date("2031-12-04T09:00:00Z");

describe("écriture d'un mois du paiement par mission (vraie base)", () => {
  it("écrit une fois, puis plus rien ; relevé à valider, échéance fixe, revendication, journal", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const { trainerId, sessionId } = await fixture(tx);
      expect(await ecrireMoisDansTransaction(tx, mois(trainerId, sessionId), MAINTENANT)).toBe(
        "ecrit",
      );
      expect(await ecrireMoisDansTransaction(tx, mois(trainerId, sessionId), MAINTENANT)).toBe(
        "deja_ecrit",
      );

      const releves = await tx.trainerStatement.findMany({
        where: { trainerId },
        include: { feeLines: true },
      });
      expect(releves).toHaveLength(1);
      const r = releves[0]!;
      expect([r.statut, r.origine, r.sessionId, r.totalHtCents, r.totalTtcCents]).toEqual([
        "a_valider",
        "passage_mission",
        sessionId,
        35_000,
        35_000,
      ]);
      expect(r.echeanceAt?.toISOString().slice(0, 10)).toBe("2032-01-02");
      expect(
        r.feeLines.map((l) => [l.objet, l.origine, l.demiJournees, l.montantHtCents, l.statut]),
      ).toEqual([["animation", "passage_mission", 2, 35_000, "calcule"]]);
      const rev = await tx.revendicationPaiement.findMany({ where: { trainerId } });
      expect(rev.map((x) => [x.regime, x.source])).toEqual([["par_mission", "passage_mission"]]);
      const journal = await tx.activityLog.findMany({ where: { targetId: r.id } });
      expect(journal.map((j) => j.action)).toEqual(["qualiopi.remuneration.releve_mission_ecrit"]);
    });
  });

  it("une session revendiquée d'abord par le relevé mensuel : abstention, rien n'est écrit", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const { trainerId, sessionId } = await fixture(tx);
      await tx.$executeRawUnsafe(
        `INSERT INTO "revendications_paiement" ("id", "trainer_id", "session_id", "regime", "source")
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'releve_mensuel', 'run_mensuel')`,
        trainerId,
        sessionId,
      );
      expect(await ecrireMoisDansTransaction(tx, mois(trainerId, sessionId), MAINTENANT)).toBe(
        "revendique_par_le_mensuel",
      );
      expect(await tx.trainerStatement.count({ where: { trainerId } })).toBe(0);
    });
  });

  it("une ligne mensuelle vivante pour le couple (tous mois) : conflit, rien n'est écrit", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const { trainerId, sessionId } = await fixture(tx);
      await tx.$executeRawUnsafe(
        `INSERT INTO "trainer_fee_lines" ("id", "trainer_id", "prestation_type", "session_id", "model", "nature",
           "montant_ht_cents", "statut", "periode_year", "periode_month", "updated_at")
         VALUES (gen_random_uuid(), $1::uuid, 'formation_collective', $2::uuid, 'taux_journalier', 'honoraire_du',
           35000, 'calcule', 2031, 11, now())`,
        trainerId,
        sessionId,
      );
      expect(await ecrireMoisDansTransaction(tx, mois(trainerId, sessionId), MAINTENANT)).toBe(
        "conflit_ligne_mensuelle",
      );
      expect(await tx.trainerStatement.count({ where: { trainerId } })).toBe(0);
    });
  });

  it("M-D simulé : le relevé mensuel du même mois et le relevé de mission coexistent", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe(`DROP INDEX "statement_unique_trainer_periode"`);
      const { trainerId, sessionId } = await fixture(tx);
      await tx.trainerStatement.create({
        data: { trainerId, periodeYear: 2031, periodeMonth: 12, tvaRegime: "franchise_293b" },
      });
      expect(await ecrireMoisDansTransaction(tx, mois(trainerId, sessionId), MAINTENANT)).toBe(
        "ecrit",
      );
      expect(await tx.trainerStatement.count({ where: { trainerId } })).toBe(2);
    });
  });
});
