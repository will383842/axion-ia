/**
 * L12f, L12g, L12l — corrections du paiement par mission CONTRE UN VRAI POSTGRES.
 *
 *   · S15 : pièce émise non payée → avoir TOTAL (montants niés), pièce annulée,
 *     réémission qui REMPLACE et garde l'échéance d'origine ;
 *   · S08 : indemnité d'annulation écrite UNE fois (sans le mois) ;
 *   · S15b / décision 89 : pièce PAYÉE → avoir PARTIEL, imputé sur le relevé
 *     suivant sans le rendre négatif ; un avoir total d'une pièce payée est refusé.
 *
 * ⚠️ L'avoir et la réémission ne passent qu'une fois M-D fait (l'unique historique
 * (formateur, année, mois) refuse deux pièces du même mois) : il est simulé dans
 * la transaction annulée, jamais en base.
 *
 * Chaque cas vit dans SA transaction, ANNULÉE.
 */

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { PrismaClient } from "../../../prisma/generated/client";
import {
  calculerReleveDuMois,
  indemniteAnnulation,
} from "../../../src/server/qualiopi/formateurs-independants/argent/calcul-mission";
import {
  ecrireIndemniteAnnulation,
  emettreAvoirMission,
  reemettreMission,
  traiterTropPercu,
} from "../../../src/server/qualiopi/formateurs-independants/paiement/corrections-mission";
import { ecrireMoisDansTransaction } from "../../../src/server/qualiopi/formateurs-independants/paiement/passage-mission-base";
import {
  demiJourneesSignees,
  parMoisCivil,
} from "../../../src/server/qualiopi/remuneration/heures-animees";

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
const ANNULE = new Error("ANNULE");
const C = {
  tarifJourneeHtCents: 35_000,
  forfaitDeplacementParJourHtCents: null,
  regimeTva: "franchise_293b" as const,
};
const MAINTENANT = new Date("2031-12-20T09:00:00Z");

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

async function fixture(tx: Tx, n = 1): Promise<{ trainerId: string; sessions: string[] }> {
  const s = randomUUID().slice(0, 8);
  const offre = randomUUID();
  const formation = randomUUID();
  const trainerId = randomUUID();
  await tx.$executeRawUnsafe(
    `INSERT INTO "offres_site" ("id", "code", "titre_fr", "slug", "format_pedagogique", "public_vise_fr",
       "duree_heures_min", "duree_heures_max", "tarif_type", "promesse_principale_fr", "angle_pedagogique_fr", "updated_at")
     VALUES ($1::uuid, $2, 'Offre', $3, 'collectif_1jour', 'Public', 7, 7, 'fixe', 'Promesse', 'Angle', now())`,
    offre,
    `TEST-COR-${s}`,
    `offre-test-cor-${s}`,
  );
  await tx.$executeRawUnsafe(
    `INSERT INTO "formations" ("id", "numero", "titre", "slug", "offre_site_id", "duree_heures", "updated_at")
     VALUES ($1::uuid, $2, 'Formation', $3, $4::uuid, 7, now())`,
    formation,
    `TEST-FORM-COR-${s}`,
    `formation-test-cor-${s}`,
    offre,
  );
  const sessions: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const id = randomUUID();
    await tx.$executeRawUnsafe(
      `INSERT INTO "training_sessions" ("id", "numero", "titre_session", "formation_id", "date_debut", "date_fin",
         "modalite", "montant_ht_cents", "nb_participants_prevus", "statut", "updated_at")
       VALUES ($1::uuid, $2, 'Session', $3::uuid, '2031-12-03T08:00:00Z', '2031-12-03T16:00:00Z',
         'presentiel', 100000, 1, 'realisee', now())`,
      id,
      `TEST-SESS-COR-${s}-${i}`,
      formation,
    );
    sessions.push(id);
  }
  await tx.$executeRawUnsafe(
    `INSERT INTO "trainers" ("id", "nom", "prenom", "email", "statut", "updated_at")
     VALUES ($1::uuid, 'Test', 'Correction', $2, 'sous_traitant', now())`,
    trainerId,
    `correction-${trainerId}@example.invalid`,
  );
  return { trainerId, sessions };
}

function releve(jours: string[], demi: "journee" | "matin" = "journee") {
  const [m] = parMoisCivil(demiJourneesSignees(jours.map((jour) => ({ jour, demiJournee: demi }))));
  return calculerReleveDuMois(m!, C);
}

async function ecrireEtEmettre(
  tx: Tx,
  trainerId: string,
  sessionId: string,
  jours: string[],
  statut = "facture_recue",
) {
  await ecrireMoisDansTransaction(
    tx,
    {
      trainerId,
      sessionId,
      releve: releve(jours),
      regimeTva: "franchise_293b",
      tarifJourneeHtCents: 35_000,
      sansEcart: true,
    },
    MAINTENANT,
  );
  const r = await tx.trainerStatement.findFirstOrThrow({ where: { trainerId, sessionId } });
  await tx.trainerStatement.update({
    where: { id: r.id },
    data: {
      statut: statut as never,
      numeroFacture: `AXI-AUTOF-T-${randomUUID().slice(0, 6)}`,
      autofactureAt: MAINTENANT,
    },
  });
  return r;
}

describe("corrections du paiement par mission (vraie base)", () => {
  it("S15 : avoir total d'une pièce non payée, pièce annulée, réémission qui garde l'échéance d'origine", async () => {
    await dansTransactionAnnulee(async (tx) => {
      // L'avoir et la réémission partagent le mois de la pièce : ils exigent que
      // l'unique historique (formateur, année, mois) soit retiré — M-D, simulé ici.
      await tx.$executeRawUnsafe(`DROP INDEX "statement_unique_trainer_periode"`);
      const { trainerId, sessions } = await fixture(tx);
      const piece = await ecrireEtEmettre(tx, trainerId, sessions[0]!, [
        "2031-12-03",
        "2031-12-04",
      ]);
      const a = await emettreAvoirMission(tx, piece.id, MAINTENANT);
      expect(a.issue).toBe("avoir_emis");
      const avoir = await tx.trainerStatement.findUniqueOrThrow({
        where: { id: (a as { avoirId: string }).avoirId },
      });
      expect([avoir.totalHtCents, avoir.totalTtcCents, avoir.avoirDeId]).toEqual([
        -70_000,
        -70_000,
        piece.id,
      ]);
      expect(
        (await tx.trainerStatement.findUniqueOrThrow({ where: { id: piece.id } })).statut,
      ).toBe("annule");
      expect(await emettreAvoirMission(tx, piece.id, MAINTENANT)).toEqual({
        issue: "refuse",
        motif: "deja_corrigee",
      });

      const r = await reemettreMission(
        tx,
        piece.id,
        releve(["2031-12-03", "2031-12-04"].concat("2031-12-05")),
        "franchise_293b",
        35_000,
        MAINTENANT,
      );
      expect(r.issue).toBe("reemis");
      const n = await tx.trainerStatement.findUniqueOrThrow({
        where: { id: (r as { id: string }).id },
      });
      expect([n.totalHtCents, n.remplaceId, n.statut]).toEqual([105_000, piece.id, "a_valider"]);
      expect(n.echeanceAt?.toISOString()).toBe(piece.echeanceAt?.toISOString());
    });
  });

  it("S08 : indemnité d'annulation écrite une fois, sans le mois ; refusée tant que M-D n'est pas fait", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const { trainerId, sessions } = await fixture(tx);
      const indemnite = indemniteAnnulation({
        annuleeA: new Date("2031-12-10T08:00:00Z"),
        debutPremiereAnnulee: new Date("2031-12-12T08:00:00Z"),
        demiJourneesAnnulees: 4,
        tarifJourneeHtCents: 35_000,
        accepteeAvant: true,
        parAxion: true,
      });
      const e = {
        trainerId,
        sessionId: sessions[0]!,
        indemnite,
        regimeTva: "franchise_293b" as const,
        tarifJourneeHtCents: 35_000,
        maintenant: MAINTENANT,
      };
      expect(await ecrireIndemniteAnnulation(tx, e)).toBe("contract_non_fait");
      await tx.$executeRawUnsafe(`DROP INDEX "statement_unique_trainer_periode"`);
      expect(await ecrireIndemniteAnnulation(tx, e)).toBe("ecrite");
      expect(await ecrireIndemniteAnnulation(tx, e)).toBe("deja_ecrite");
      const r = await tx.trainerStatement.findFirstOrThrow({
        where: { trainerId },
        include: { feeLines: true },
      });
      expect([r.totalHtCents, r.statut, r.echeanceAt?.toISOString().slice(0, 10)]).toEqual([
        35_000,
        "a_valider",
        "2032-01-09",
      ]);
      expect(r.feeLines.map((l) => l.objet)).toEqual(["indemnite_annulation"]);
    });
  });

  it("décision 89 : pièce payée → avoir PARTIEL imputé sur le relevé suivant, jamais négatif ; avoir total refusé", async () => {
    await dansTransactionAnnulee(async (tx) => {
      // L'avoir et la réémission partagent le mois de la pièce : ils exigent que
      // l'unique historique (formateur, année, mois) soit retiré — M-D, simulé ici.
      await tx.$executeRawUnsafe(`DROP INDEX "statement_unique_trainer_periode"`);
      const { trainerId, sessions } = await fixture(tx, 2);
      const payee = await ecrireEtEmettre(tx, trainerId, sessions[0]!, ["2031-12-03"], "paye");
      expect(await emettreAvoirMission(tx, payee.id, MAINTENANT)).toEqual({
        issue: "refuse",
        motif: "montant_requis_pour_une_piece_payee",
      });
      expect(
        (await emettreAvoirMission(tx, payee.id, MAINTENANT, { montantHtCents: 17_500 })).issue,
      ).toBe("trop_percu_ouvert");
      // Relevé suivant (autre session) de 175 € : imputé à zéro, jamais en dessous.
      await ecrireMoisDansTransaction(
        tx,
        {
          trainerId,
          sessionId: sessions[1]!,
          releve: releve(["2031-12-04"], "matin"),
          regimeTva: "franchise_293b",
          tarifJourneeHtCents: 35_000,
          sansEcart: true,
        },
        MAINTENANT,
      );
      const suivant = await tx.trainerStatement.findFirstOrThrow({
        where: { trainerId, sessionId: sessions[1]! },
      });
      const b = await traiterTropPercu(tx, trainerId, suivant.id, "2031-12-20", MAINTENANT);
      expect(b).toEqual({ imputeHtCents: 17_500, demandesRemboursement: 0 });
      expect(
        (await tx.trainerStatement.findUniqueOrThrow({ where: { id: suivant.id } })).totalHtCents,
      ).toBe(0);
      // Rejoué : plus rien à imputer.
      expect(await traiterTropPercu(tx, trainerId, suivant.id, "2031-12-20", MAINTENANT)).toEqual({
        imputeHtCents: 0,
        demandesRemboursement: 0,
      });
    });
  });

  it("trop-perçu : jamais imputé sur un relevé MENSUEL ni sur un régime de TVA différent ; rejouable sans seconde ligne", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe(`DROP INDEX "statement_unique_trainer_periode"`);
      const { trainerId, sessions } = await fixture(tx, 3);
      const payee = await ecrireEtEmettre(tx, trainerId, sessions[0]!, ["2031-12-03"], "paye");
      await emettreAvoirMission(tx, payee.id, MAINTENANT, { montantHtCents: 10_000 });
      // Un relevé MENSUEL du même formateur : refusé comme relevé suivant.
      const mensuel = await tx.trainerStatement.create({
        data: {
          trainerId,
          periodeYear: 2032,
          periodeMonth: 1,
          tvaRegime: "franchise_293b",
          totalHtCents: 35_000,
        },
      });
      expect(await traiterTropPercu(tx, trainerId, mensuel.id, "2031-12-20", MAINTENANT)).toEqual({
        imputeHtCents: 0,
        demandesRemboursement: 0,
      });
      expect(await tx.trainerFeeLine.count({ where: { statementId: mensuel.id } })).toBe(0);
      // Un relevé de mission assujetti 20 % : régime différent de l'avoir (franchise) → rien.
      await ecrireMoisDansTransaction(
        tx,
        {
          trainerId,
          sessionId: sessions[1]!,
          releve: releve(["2031-12-04"]),
          regimeTva: "assujetti_20",
          tarifJourneeHtCents: 35_000,
          sansEcart: true,
        },
        MAINTENANT,
      );
      const assujetti = await tx.trainerStatement.findFirstOrThrow({
        where: { trainerId, sessionId: sessions[1]! },
      });
      expect(
        (await traiterTropPercu(tx, trainerId, assujetti.id, "2031-12-20", MAINTENANT))
          .imputeHtCents,
      ).toBe(0);
      // Un relevé de mission du même régime : 60 € imputés, puis le reste (40 €) au second passage, sur la MÊME ligne.
      await ecrireMoisDansTransaction(
        tx,
        {
          trainerId,
          sessionId: sessions[2]!,
          releve: releve(["2031-12-05"], "matin"),
          regimeTva: "franchise_293b",
          tarifJourneeHtCents: 35_000,
          sansEcart: true,
        },
        MAINTENANT,
      );
      const suivant = await tx.trainerStatement.findFirstOrThrow({
        where: { trainerId, sessionId: sessions[2]! },
      });
      expect(
        (await traiterTropPercu(tx, trainerId, suivant.id, "2031-12-20", MAINTENANT)).imputeHtCents,
      ).toBe(10_000);
      expect(await traiterTropPercu(tx, trainerId, suivant.id, "2031-12-20", MAINTENANT)).toEqual({
        imputeHtCents: 0,
        demandesRemboursement: 0,
      });
      const lignes = await tx.trainerFeeLine.findMany({
        where: { statementId: suivant.id, objet: "ajustement" },
      });
      expect(lignes.map((l) => l.montantHtCents)).toEqual([-10_000]);
      expect(
        (await tx.trainerStatement.findUniqueOrThrow({ where: { id: suivant.id } })).totalHtCents,
      ).toBe(7_500);
    });
  });

  it("un montant de trop-perçu sur une pièce NON payée est refusé (jamais d'avoir total silencieux)", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe(`DROP INDEX "statement_unique_trainer_periode"`);
      const { trainerId, sessions } = await fixture(tx);
      const piece = await ecrireEtEmettre(tx, trainerId, sessions[0]!, ["2031-12-03"]);
      expect(await emettreAvoirMission(tx, piece.id, MAINTENANT, { montantHtCents: 100 })).toEqual({
        issue: "refuse",
        motif: "montant_inutile_piece_non_payee",
      });
    });
  });
});
