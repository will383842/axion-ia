/**
 * Relecture argent de L12c/L12e et L12d…m — petits défauts, CONTRE UN VRAI POSTGRES.
 *
 *   · un conflit avec une ligne mensuelle ne pose AUCUNE revendication
 *     `par_mission` (sinon le run mensuel écarterait le couple : personne ne paie) ;
 *   · une indemnité d'annulation écrite en premier ne bloque plus l'animation du
 *     même mois : elle s'ajoute au relevé, la plus proche échéance gardée ;
 *   · après l'avoir d'une pièce non payée, le passage ne réécrit pas le mois : la
 *     réémission reste un geste humain, et elle passe ;
 *   · un avoir dont le remboursement a été demandé ne s'impute plus.
 *
 * M-D simulé dans la transaction annulée, jamais en base.
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


const MOIS = (trainerId: string, sessionId: string, jours: string[]) => ({
  trainerId,
  sessionId,
  releve: releve(jours),
  regimeTva: "franchise_293b" as const,
  tarifJourneeHtCents: 35_000,
  sansEcart: true,
});

describe("petits défauts du paiement par mission (vraie base)", () => {
  it("conflit avec une ligne mensuelle : rien d'écrit, AUCUNE revendication posée", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const { trainerId, sessions } = await fixture(tx);
      await tx.$executeRawUnsafe(
        `INSERT INTO "trainer_fee_lines" ("id", "trainer_id", "prestation_type", "session_id", "model", "nature",
           "montant_ht_cents", "statut", "periode_year", "periode_month", "updated_at")
         VALUES (gen_random_uuid(), $1::uuid, 'formation_collective', $2::uuid, 'taux_journalier', 'honoraire_du',
           35000, 'calcule', 2031, 11, now())`,
        trainerId,
        sessions[0]!,
      );
      expect(
        await ecrireMoisDansTransaction(tx, MOIS(trainerId, sessions[0]!, ["2031-12-03"]), MAINTENANT),
      ).toBe("conflit_ligne_mensuelle");
      expect(await tx.revendicationPaiement.count({ where: { trainerId } })).toBe(0);
    });
  });

  it("indemnité écrite en premier, puis l'animation du même mois : un relevé, 350 + 700 €, échéance la plus proche", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe(`DROP INDEX "statement_unique_trainer_periode"`);
      const { trainerId, sessions } = await fixture(tx);
      const indemnite = indemniteAnnulation({
        annuleeA: new Date("2031-12-10T08:00:00Z"),
        debutPremiereAnnulee: new Date("2031-12-12T08:00:00Z"),
        demiJourneesAnnulees: 4,
        tarifJourneeHtCents: 35_000,
        accepteeAvant: true,
        parAxion: true,
      });
      expect(
        await ecrireIndemniteAnnulation(tx, {
          trainerId,
          sessionId: sessions[0]!,
          indemnite,
          regimeTva: "franchise_293b",
          tarifJourneeHtCents: 35_000,
          maintenant: MAINTENANT,
        }),
      ).toBe("ecrite");
      // Animation des 03 et 04/12 (échéance 03/01/2032), indemnité au 10/12 (09/01/2032).
      expect(
        await ecrireMoisDansTransaction(
          tx,
          MOIS(trainerId, sessions[0]!, ["2031-12-03", "2031-12-04"]),
          MAINTENANT,
        ),
      ).toBe("ecrit");
      const r = await tx.trainerStatement.findFirstOrThrow({
        where: { trainerId },
        include: { feeLines: { orderBy: { montantHtCents: "asc" } } },
      });
      expect(await tx.trainerStatement.count({ where: { trainerId } })).toBe(1);
      expect([r.totalHtCents, r.totalTtcCents, r.echeanceAt?.toISOString().slice(0, 10)]).toEqual([
        105_000,
        105_000,
        "2032-01-03",
      ]);
      expect(r.feeLines.map((l) => [l.objet, l.montantHtCents])).toEqual([
        ["indemnite_annulation", 35_000],
        ["animation", 70_000],
      ]);
      // Rejoué : rien de plus.
      expect(
        await ecrireMoisDansTransaction(
          tx,
          MOIS(trainerId, sessions[0]!, ["2031-12-03", "2031-12-04"]),
          MAINTENANT,
        ),
      ).toBe("deja_ecrit");
    });
  });

  it("animation écrite d'abord, indemnité ensuite : la plus proche échéance est gardée", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe(`DROP INDEX "statement_unique_trainer_periode"`);
      const { trainerId, sessions } = await fixture(tx);
      // Animation du 20/12 (échéance 19/01/2032), indemnité au 10/12 (09/01/2032).
      await ecrireMoisDansTransaction(tx, MOIS(trainerId, sessions[0]!, ["2031-12-20"]), MAINTENANT);
      const indemnite = indemniteAnnulation({
        annuleeA: new Date("2031-12-10T08:00:00Z"),
        debutPremiereAnnulee: new Date("2031-12-12T08:00:00Z"),
        demiJourneesAnnulees: 2,
        tarifJourneeHtCents: 35_000,
        accepteeAvant: true,
        parAxion: true,
      });
      expect(
        await ecrireIndemniteAnnulation(tx, {
          trainerId,
          sessionId: sessions[0]!,
          indemnite,
          regimeTva: "franchise_293b",
          tarifJourneeHtCents: 35_000,
          maintenant: MAINTENANT,
        }),
      ).toBe("ecrite");
      const r = await tx.trainerStatement.findFirstOrThrow({ where: { trainerId } });
      expect([r.totalHtCents, r.echeanceAt?.toISOString().slice(0, 10)]).toEqual([
        52_500,
        "2032-01-09",
      ]);
    });
  });

  it("après l'avoir d'une pièce non payée : le passage attend la réémission, qui passe et garde l'échéance", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe(`DROP INDEX "statement_unique_trainer_periode"`);
      const { trainerId, sessions } = await fixture(tx);
      const piece = await ecrireEtEmettre(tx, trainerId, sessions[0]!, ["2031-12-03"]);
      expect((await emettreAvoirMission(tx, piece.id, MAINTENANT)).issue).toBe("avoir_emis");
      expect(
        await ecrireMoisDansTransaction(tx, MOIS(trainerId, sessions[0]!, ["2031-12-03"]), MAINTENANT),
      ).toBe("reemission_attendue");
      const r = await reemettreMission(
        tx,
        piece.id,
        releve(["2031-12-03"]),
        "franchise_293b",
        35_000,
        MAINTENANT,
      );
      expect(r.issue).toBe("reemis");
    });
  });

  it("trop-perçu dont le remboursement a été demandé : plus imputé sur un relevé suivant", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe(`DROP INDEX "statement_unique_trainer_periode"`);
      const { trainerId, sessions } = await fixture(tx, 2);
      const payee = await ecrireEtEmettre(tx, trainerId, sessions[0]!, ["2031-12-03"], "paye");
      const a = await emettreAvoirMission(tx, payee.id, MAINTENANT, { montantHtCents: 17_500 });
      await tx.trainerStatement.update({
        where: { id: (a as { avoirId: string }).avoirId },
        data: { remboursementDemandeAt: MAINTENANT },
      });
      await ecrireMoisDansTransaction(tx, MOIS(trainerId, sessions[1]!, ["2031-12-04"]), MAINTENANT);
      const suivant = await tx.trainerStatement.findFirstOrThrow({
        where: { trainerId, sessionId: sessions[1]! },
      });
      expect(
        (await traiterTropPercu(tx, trainerId, suivant.id, "2031-12-20", MAINTENANT)).imputeHtCents,
      ).toBe(0);
      expect(
        (await tx.trainerStatement.findUniqueOrThrow({ where: { id: suivant.id } })).totalHtCents,
      ).toBe(35_000);
    });
  });
});
