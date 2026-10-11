/**
 * SCHÉMA N° 2 DU CHANTIER FORMATEURS FREELANCE CONTRE UN VRAI POSTGRES
 * (`pnpm test:integration tests/integration/formateurs-paiement`).
 *
 *   1. la garde de dérive lue dans `pg_constraint` / `pg_trigger` / `pg_indexes` ;
 *   2. le remplissage du stock : les instructions EXACTES de la migration sont
 *      rejouées sur un corpus (relevé en brouillon, ligne annulée, salarié) ;
 *   3. AUCUN DOUBLE PAIEMENT : relevés et lignes du paiement par mission, une
 *      fois l'unique historique retiré (M-D simulé DANS la transaction annulée,
 *      jamais en base) ; l'indemnité d'annulation est unique SANS le mois ;
 *   4. le relevé mensuel n'est pas touché : une écriture « comme le run »
 *      (sans nommer aucune colonne neuve) passe, et deux lignes mensuelles
 *      identiques restent permises comme avant ;
 *   5. revendication en ajout seul ; IBAN demandé jamais en clair.
 *
 * Chaque cas vit dans SA transaction, ANNULÉE : la base reste vide.
 * Sans `DATABASE_URL`, ce fichier ÉCHOUE — il ne se saute pas.
 */

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { PrismaClient } from "../../../prisma/generated/client";
import {
  SQL_CONTRAINTES_PRESENTES_PAIEMENT,
  SQL_INDEX_PRESENTS_PAIEMENT,
  SQL_REVENDIQUER_STOCK_MENSUEL,
  SQL_TRIGGERS_PRESENTS_PAIEMENT,
  fautesDerivePaiementFormateurs,
  type ObjetPresentPaiement,
} from "../../../src/server/qualiopi/formateurs-independants/paiement-objets-sql";

type Tx = {
  $executeRawUnsafe: (sql: string, ...v: unknown[]) => Promise<number>;
  $queryRawUnsafe: <T>(sql: string, ...v: unknown[]) => Promise<T>;
};

const ANNULE = new Error("ANNULE — la transaction de test ne laisse aucune ligne");

async function dansTransactionAnnulee(fn: (tx: Tx) => Promise<void>): Promise<void> {
  if (!process.env["DATABASE_URL"]) throw new Error("DATABASE_URL absent : ce test exige Postgres");
  const db = new PrismaClient();
  try {
    await expect(
      db.$transaction(
        async (tx) => {
          await fn(tx as unknown as Tx);
          throw ANNULE;
        },
        { timeout: 60_000 },
      ),
    ).rejects.toBe(ANNULE);
  } finally {
    await db.$disconnect();
  }
}

/** Une instruction qui DOIT échouer, isolée par un point de sauvegarde. */
async function refuse(tx: Tx, sql: string, ...v: unknown[]): Promise<string> {
  await tx.$executeRawUnsafe("SAVEPOINT essai");
  try {
    await tx.$executeRawUnsafe(sql, ...v);
  } catch (e) {
    await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT essai");
    return e instanceof Error ? e.message : String(e);
  }
  await tx.$executeRawUnsafe("RELEASE SAVEPOINT essai");
  throw new Error(`accepté alors qu'il devait être refusé : ${sql}`);
}

async function formateur(tx: Tx, statut: "sous_traitant" | "salarie" = "sous_traitant") {
  const id = randomUUID();
  await tx.$executeRawUnsafe(
    `INSERT INTO "trainers" ("id", "nom", "prenom", "email", "statut", "updated_at")
     VALUES ($1::uuid, 'Test', 'Paiement', $2, $3::"TrainerStatut", now())`,
    id,
    `paiement-${id}@example.invalid`,
    statut,
  );
  return id;
}

async function session(tx: Tx): Promise<string> {
  const s = randomUUID().slice(0, 8);
  const offre = randomUUID();
  const formation = randomUUID();
  const id = randomUUID();
  await tx.$executeRawUnsafe(
    `INSERT INTO "offres_site" ("id", "code", "titre_fr", "slug", "format_pedagogique", "public_vise_fr",
       "duree_heures_min", "duree_heures_max", "tarif_type", "promesse_principale_fr", "angle_pedagogique_fr", "updated_at")
     VALUES ($1::uuid, $2, 'Offre', $3, 'collectif_1jour', 'Public', 7, 7, 'fixe', 'Promesse', 'Angle', now())`,
    offre,
    `TEST-PAI-${s}`,
    `offre-test-pai-${s}`,
  );
  await tx.$executeRawUnsafe(
    `INSERT INTO "formations" ("id", "numero", "titre", "slug", "offre_site_id", "duree_heures", "updated_at")
     VALUES ($1::uuid, $2, 'Formation', $3, $4::uuid, 7, now())`,
    formation,
    `TEST-FORM-PAI-${s}`,
    `formation-test-pai-${s}`,
    offre,
  );
  await tx.$executeRawUnsafe(
    `INSERT INTO "training_sessions" ("id", "numero", "titre_session", "formation_id", "date_debut", "date_fin",
       "modalite", "montant_ht_cents", "nb_participants_prevus", "statut", "updated_at")
     VALUES ($1::uuid, $2, 'Session', $3::uuid, '2031-09-28T07:00:00Z', '2031-10-05T15:00:00Z',
       'presentiel', 100000, 1, 'realisee', now())`,
    id,
    `TEST-SESS-PAI-${s}`,
    formation,
  );
  return id;
}

/** Un relevé, colonnes neuves explicites (ou leurs défauts). */
async function releve(
  tx: Tx,
  o: {
    trainerId: string;
    sessionId?: string | null;
    origine?: "releve_mensuel" | "passage_mission";
    mois?: number;
    statut?: string;
    avoirDeId?: string | null;
  },
): Promise<string> {
  const id = randomUUID();
  await tx.$executeRawUnsafe(
    `INSERT INTO "trainer_statements" ("id", "trainer_id", "periode_year", "periode_month", "statut",
       "tva_regime", "updated_at", "origine", "session_id", "avoir_de_id")
     VALUES ($1::uuid, $2::uuid, 2031, $3, $4::"StatementStatut", 'franchise_293b', now(),
       $5::"origine_honoraire", $6::uuid, $7::uuid)`,
    id,
    o.trainerId,
    o.mois ?? 10,
    o.statut ?? "brouillon",
    o.origine ?? "releve_mensuel",
    o.sessionId ?? null,
    o.avoirDeId ?? null,
  );
  return id;
}

const LIGNE = `INSERT INTO "trainer_fee_lines" ("id", "trainer_id", "prestation_type", "session_id",
   "model", "nature", "montant_ht_cents", "statut", "periode_year", "periode_month", "updated_at",
   "origine", "objet")
 VALUES (gen_random_uuid(), $1::uuid, 'formation_collective', $2::uuid, 'taux_journalier', 'honoraire_du', 35000,
   $3::"FeeLineStatut", 2031, $4, now(), $5::"origine_honoraire", $6::"objet_ligne_honoraire")`;

/** Simule M-D DANS la transaction annulée : l'unique historique ne bloque plus. */
async function sansUniqueHistorique(tx: Tx): Promise<void> {
  await tx.$executeRawUnsafe(`DROP INDEX "statement_unique_trainer_periode"`);
}

describe("schéma n° 2 — garde de dérive", () => {
  it("chaque objet déclaré est en base, actif, avec sa clause ; rien d'intrus", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const presents = [
        ...(await tx.$queryRawUnsafe<ObjetPresentPaiement[]>(SQL_TRIGGERS_PRESENTS_PAIEMENT)),
        ...(await tx.$queryRawUnsafe<ObjetPresentPaiement[]>(SQL_CONTRAINTES_PRESENTES_PAIEMENT)),
        ...(await tx.$queryRawUnsafe<ObjetPresentPaiement[]>(SQL_INDEX_PRESENTS_PAIEMENT)),
      ];
      expect(fautesDerivePaiementFormateurs(presents)).toEqual([]);
      // M-D n'est pas fait : l'unique historique est toujours là.
      expect(presents.some((p) => p.nom === "statement_unique_trainer_periode")).toBe(true);
    });
  });
});

describe("schéma n° 2 — remplissage du stock (texte exact de la migration)", () => {
  it("revendique toute session d'indépendant portée par une ligne mensuelle non annulée, même en brouillon", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const independant = await formateur(tx);
      const salarie = await formateur(tx, "salarie");
      const autre = await formateur(tx);
      const s1 = await session(tx);
      const s2 = await session(tx);
      // S19 : relevé de SEPTEMBRE en brouillon qui porte la session.
      await releve(tx, { trainerId: independant, mois: 9 });
      await tx.$executeRawUnsafe(LIGNE, independant, s1, "calcule", 9, "releve_mensuel", null);
      // Deux lignes pour la même (formateur, session) : une seule revendication.
      await tx.$executeRawUnsafe(
        LIGNE,
        independant,
        s1,
        "previsionnel",
        10,
        "releve_mensuel",
        null,
      );
      // Un salarié n'est jamais revendiqué ; une ligne annulée non plus.
      await tx.$executeRawUnsafe(LIGNE, salarie, s1, "calcule", 9, "releve_mensuel", null);
      await tx.$executeRawUnsafe(LIGNE, autre, s2, "annule", 9, "releve_mensuel", null);

      await tx.$executeRawUnsafe(SQL_REVENDIQUER_STOCK_MENSUEL);
      await tx.$executeRawUnsafe(SQL_REVENDIQUER_STOCK_MENSUEL); // rejouable
      const lignes = await tx.$queryRawUnsafe<
        Array<{ trainer_id: string; session_id: string; regime: string; source: string }>
      >(
        `SELECT "trainer_id", "session_id", "regime"::text, "source"::text FROM "revendications_paiement"
         WHERE "trainer_id" = ANY($1::uuid[])`,
        [independant, salarie, autre],
      );
      expect(lignes).toEqual([
        {
          trainer_id: independant,
          session_id: s1,
          regime: "releve_mensuel",
          source: "stock_migration",
        },
      ]);
    });
  });

  it("une revendication est en AJOUT SEUL et unique par (formateur, session)", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const t = await formateur(tx);
      const s = randomUUID();
      await tx.$executeRawUnsafe(
        `INSERT INTO "revendications_paiement" ("id", "trainer_id", "session_id", "regime", "source")
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'par_mission', 'passage_mission')`,
        t,
        s,
      );
      expect(
        await refuse(
          tx,
          `INSERT INTO "revendications_paiement" ("id", "trainer_id", "session_id", "regime", "source")
           VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'releve_mensuel', 'run_mensuel')`,
          t,
          s,
        ),
      ).toMatch(/23505[\s\S]*Key \(trainer_id, session_id\)=/);
      expect(
        await refuse(
          tx,
          `UPDATE "revendications_paiement" SET "regime" = 'releve_mensuel' WHERE "trainer_id" = $1::uuid`,
          t,
        ),
      ).toMatch(/ajout seul/);
      expect(
        await refuse(tx, `DELETE FROM "revendications_paiement" WHERE "trainer_id" = $1::uuid`, t),
      ).toMatch(/ajout seul/);
    });
  });
});

describe("schéma n° 2 — aucun double paiement (après M-D, simulé)", () => {
  it("un seul relevé de mission vivant par (formateur, session, mois) ; annulé ou avoir libèrent", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await sansUniqueHistorique(tx);
      const t = await formateur(tx);
      const s = await session(tx);
      const premier = await releve(tx, { trainerId: t, sessionId: s, origine: "passage_mission" });
      const msg = await refuse(
        tx,
        `INSERT INTO "trainer_statements" ("id", "trainer_id", "periode_year", "periode_month", "tva_regime",
           "updated_at", "origine", "session_id")
         VALUES (gen_random_uuid(), $1::uuid, 2031, 10, 'franchise_293b', now(), 'passage_mission', $2::uuid)`,
        t,
        s,
      );
      expect(msg).toMatch(
        /23505[\s\S]*Key \(trainer_id, session_id, periode_year, periode_month\)=/,
      );
      // Le mois suivant de la même session : permis (un paiement par mois, décision 68).
      await releve(tx, { trainerId: t, sessionId: s, origine: "passage_mission", mois: 11 });
      // L'avoir de la pièce n'occupe pas sa place ; la pièce annulée la libère.
      await releve(tx, {
        trainerId: t,
        sessionId: s,
        origine: "passage_mission",
        avoirDeId: premier,
      });
      await tx.$executeRawUnsafe(
        `UPDATE "trainer_statements" SET "statut" = 'annule' WHERE "id" = $1::uuid`,
        premier,
      );
      await releve(tx, { trainerId: t, sessionId: s, origine: "passage_mission" });
      // Un seul avoir par pièce.
      expect(
        await refuse(
          tx,
          `INSERT INTO "trainer_statements" ("id", "trainer_id", "periode_year", "periode_month", "tva_regime",
             "updated_at", "origine", "session_id", "avoir_de_id")
           VALUES (gen_random_uuid(), $1::uuid, 2031, 10, 'franchise_293b', now(), 'passage_mission', $2::uuid, $3::uuid)`,
          t,
          s,
          premier,
        ),
      ).toMatch(/23505[\s\S]*Key \(avoir_de_id\)=/);
    });
  });

  it("un relevé mensuel ne porte jamais de session ; le mensuel reste unique par mois", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await sansUniqueHistorique(tx);
      const t = await formateur(tx);
      const s = await session(tx);
      expect(
        await refuse(
          tx,
          `INSERT INTO "trainer_statements" ("id", "trainer_id", "periode_year", "periode_month", "tva_regime",
             "updated_at", "session_id")
           VALUES (gen_random_uuid(), $1::uuid, 2031, 10, 'franchise_293b', now(), $2::uuid)`,
          t,
          s,
        ),
      ).toMatch(/trainer_statements_origine_coherente/);
      await releve(tx, { trainerId: t });
      expect(
        await refuse(
          tx,
          `INSERT INTO "trainer_statements" ("id", "trainer_id", "periode_year", "periode_month", "tva_regime", "updated_at")
           VALUES (gen_random_uuid(), $1::uuid, 2031, 10, 'franchise_293b', now())`,
          t,
        ),
      ).toMatch(/23505[\s\S]*Key \(trainer_id, periode_year, periode_month\)=/);
      // Coexistence mensuel + mission du même mois : permise une fois M-D fait.
      await releve(tx, { trainerId: t, sessionId: s, origine: "passage_mission" });
    });
  });

  it("une seule ligne d'animation par (formateur, session, mois) ; l'indemnité est unique SANS le mois", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const t = await formateur(tx);
      const s = await session(tx);
      await tx.$executeRawUnsafe(LIGNE, t, s, "calcule", 10, "passage_mission", "animation");
      expect(await refuse(tx, LIGNE, t, s, "calcule", 10, "passage_mission", "animation")).toMatch(
        /23505[\s\S]*Key \(trainer_id, session_id, objet, periode_year, periode_month\)=/,
      );
      await tx.$executeRawUnsafe(LIGNE, t, s, "calcule", 10, "passage_mission", "deplacement");
      await tx.$executeRawUnsafe(LIGNE, t, s, "calcule", 11, "passage_mission", "animation");
      await tx.$executeRawUnsafe(
        LIGNE,
        t,
        s,
        "calcule",
        10,
        "passage_mission",
        "indemnite_annulation",
      );
      expect(
        await refuse(tx, LIGNE, t, s, "calcule", 11, "passage_mission", "indemnite_annulation"),
      ).toMatch(/23505[\s\S]*Key \(trainer_id, session_id\)=/);
      // Une ligne annulée libère sa place ; un ajustement n'est jamais compté.
      await tx.$executeRawUnsafe(LIGNE, t, s, "annule", 10, "passage_mission", "animation");
      await tx.$executeRawUnsafe(LIGNE, t, s, "calcule", 10, "passage_mission", "ajustement");
      await tx.$executeRawUnsafe(LIGNE, t, s, "calcule", 10, "passage_mission", "ajustement");
      // Une ligne du paiement par mission dit ce qu'elle paie.
      expect(await refuse(tx, LIGNE, t, s, "calcule", 12, "passage_mission", null)).toMatch(
        /trainer_fee_lines_objet_mission/,
      );
    });
  });

  it("une seule présentation de la méthode payée par formateur", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const t = await formateur(tx);
      const s = await session(tx);
      // ⚠️ Une ligne SANS prestation (présentation « hors mission ») reste refusée
      // par le CHECK historique `ck_fee_line_une_seule_prestation` : le relâcher
      // est un « contract », hors de cette migration additive (L12i l'attend).
      expect(
        await refuse(tx, LIGNE, t, null, "calcule", 10, "passage_mission", "presentation_methode"),
      ).toMatch(/ck_fee_line_une_seule_prestation/);
      await tx.$executeRawUnsafe(
        LIGNE,
        t,
        s,
        "calcule",
        10,
        "passage_mission",
        "presentation_methode",
      );
      expect(
        await refuse(tx, LIGNE, t, s, "calcule", 11, "passage_mission", "presentation_methode"),
      ).toMatch(/23505[\s\S]*Key \(trainer_id\)=/);
    });
  });
});

describe("schéma n° 2 — le relevé mensuel n'est pas touché", () => {
  it("une écriture « comme le run » (aucune colonne neuve nommée) passe avec les défauts", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const t = await formateur(tx);
      const s = await session(tx);
      const id = randomUUID();
      await tx.$executeRawUnsafe(
        `INSERT INTO "trainer_statements" ("id", "trainer_id", "periode_year", "periode_month", "tva_regime", "updated_at")
         VALUES ($1::uuid, $2::uuid, 2031, 10, 'franchise_293b', now())`,
        id,
        t,
      );
      const ligne = `INSERT INTO "trainer_fee_lines" ("id", "trainer_id", "prestation_type", "session_id", "model",
           "nature", "montant_ht_cents", "statut", "periode_year", "periode_month", "statement_id", "updated_at")
         VALUES (gen_random_uuid(), $1::uuid, 'formation_collective', $2::uuid, 'taux_journalier', 'honoraire_du', 35000,
           'calcule', 2031, 10, $3::uuid, now())`;
      // Deux lignes mensuelles identiques : permises comme avant (aucune unicité neuve sur le mensuel).
      await tx.$executeRawUnsafe(ligne, t, s, id);
      await tx.$executeRawUnsafe(ligne, t, s, id);
      const [r] = await tx.$queryRawUnsafe<Array<{ origine: string; session_id: string | null }>>(
        `SELECT "origine"::text, "session_id" FROM "trainer_statements" WHERE "id" = $1::uuid`,
        id,
      );
      expect(r).toEqual({ origine: "releve_mensuel", session_id: null });
      const lignes = await tx.$queryRawUnsafe<Array<{ origine: string; objet: string | null }>>(
        `SELECT "origine"::text, "objet"::text FROM "trainer_fee_lines" WHERE "statement_id" = $1::uuid`,
        id,
      );
      expect(lignes).toEqual([
        { origine: "releve_mensuel", objet: null },
        { origine: "releve_mensuel", objet: null },
      ]);
      // Et le run peut toujours effacer ses lignes recalculables, puis son relevé.
      await tx.$executeRawUnsafe(
        `DELETE FROM "trainer_fee_lines" WHERE "statement_id" = $1::uuid`,
        id,
      );
      await tx.$executeRawUnsafe(`DELETE FROM "trainer_statements" WHERE "id" = $1::uuid`, id);
    });
  });
});

describe("schéma n° 2 — demandes de changement (M-E)", () => {
  it("un IBAN demandé n'est jamais en clair ; une seule demande en attente par nature", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const t = await formateur(tx);
      const demande = `INSERT INTO "demandes_changement_formateur" ("id", "trainer_id", "nature", "valeur", "valeur_empreinte")
         VALUES (gen_random_uuid(), $1::uuid, $2::"nature_changement_formateur", $3, $4)`;
      expect(
        await refuse(tx, demande, t, "iban", "FR7630006000011234567890189", "a".repeat(64)),
      ).toMatch(/demandes_changement_formateur_iban_chiffre/);
      expect(await refuse(tx, demande, t, "iban", "enc:v1:abc", "a".repeat(64))).toMatch(
        /demandes_changement_formateur_iban_chiffre/,
      );
      expect(await refuse(tx, demande, t, "iban", "enc:v2:abc", null)).toMatch(
        /demandes_changement_formateur_iban_chiffre/,
      );
      await tx.$executeRawUnsafe(demande, t, "iban", "enc:v2:abc", "a".repeat(64));
      expect(await refuse(tx, demande, t, "iban", "enc:v2:def", "b".repeat(64))).toMatch(
        /23505[\s\S]*Key \(trainer_id, nature\)=/,
      );
      // Une autre nature, en même temps : permise.
      await tx.$executeRawUnsafe(demande, t, "adresse", "1 rue de test", null);
      // Un refus sans motif, ou un traitement sans auteur : refusés.
      expect(
        await refuse(
          tx,
          `UPDATE "demandes_changement_formateur" SET "statut" = 'refusee', "traite_at" = now(), "traite_par_id" = gen_random_uuid()
           WHERE "trainer_id" = $1::uuid AND "nature" = 'adresse'`,
          t,
        ),
      ).toMatch(/demandes_changement_formateur_traitement_coherent/);
      expect(
        await refuse(
          tx,
          `UPDATE "demandes_changement_formateur" SET "statut" = 'acceptee', "traite_at" = now()
           WHERE "trainer_id" = $1::uuid AND "nature" = 'adresse'`,
          t,
        ),
      ).toMatch(/demandes_changement_formateur_traitement_coherent/);
    });
  });
});
