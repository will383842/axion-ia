/**
 * CHANTIER QNC, LOT L00 — LE SOCLE CONTRE UN VRAI POSTGRES migré à neuf (Gate D).
 *
 * ⚠️ Pourquoi ce fichier vit dans `verrou-dossier/` : Gate D lance
 * `pnpm test:integration tests/integration/verrou-dossier` (ADR 0060, même
 * famille « ajout seul »), et ce lot n'a pas le droit de toucher
 * `.github/workflows/**`. Un dossier à part ne serait lancé par AUCUNE gate :
 * un test qui ne tourne pas est un vert qui ne regarde rien. Le jour où une
 * étape dédiée existe, le fichier se déplace sans changer.
 *
 * Prouve, chaque cas dans SA transaction ANNULÉE (la base reste vide) :
 *   - la garde de dérive, lue dans `pg_trigger` / `pg_constraint`, est verte ;
 *   - sur CHACUN des dix journaux : INSERT accepté, UPDATE, DELETE et TRUNCATE
 *     refusés (« ajout seul ») ;
 *   - les six CHECK refusent ce qu'ils doivent refuser ;
 *   - ÉTEINT, RIEN NE CHANGE : sans interrupteur, une veille et un plan
 *     d'actions se modifient et se suppriment comme avant ; en `essai` aussi ;
 *     en `actif`, ils sont refusés ;
 *   - une bascule écrit le réglage ET sa ligne `activity_logs` (avant/après).
 *
 * Sans `DATABASE_URL`, ce fichier ÉCHOUE — il ne se saute pas.
 */

import { describe, expect, it } from "vitest";

import { PrismaClient } from "../../../prisma/generated/client";
import {
  SQL_PRESENTS_SOCLE_QNC,
  TABLES_AJOUT_SEUL,
  fautesDeriveSocleQnc,
  type ObjetPresentSocle,
  type TableAjoutSeul,
} from "../../../src/server/qualiopi/socle/objets-sql";
import {
  basculerInterrupteurQualiopi,
  lireInterrupteurQualiopi,
  type EtatInterrupteur,
} from "../../../src/server/qualiopi/socle/interrupteurs";

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

const ANNULE = new Error("ANNULE — la transaction de test ne laisse aucune ligne");
const ADMIN_ID = "00000000-0000-4000-8000-000000000a00";
const EMPREINTE = "a".repeat(64);

/** Exécute `fn` dans une transaction TOUJOURS annulée. */
async function dansTransactionAnnulee(fn: (tx: Tx) => Promise<void>): Promise<void> {
  const db = new PrismaClient();
  try {
    await expect(
      db.$transaction(
        async (tx) => {
          await fn(tx);
          throw ANNULE;
        },
        { timeout: 30_000 },
      ),
    ).rejects.toBe(ANNULE);
  } finally {
    await db.$disconnect();
  }
}

/** Attend un refus SANS perdre la transaction : point de sauvegarde, puis retour. */
async function refuse(tx: Tx, sql: string, motif: RegExp): Promise<void> {
  await tx.$executeRawUnsafe("SAVEPOINT attente");
  await expect(tx.$executeRawUnsafe(sql)).rejects.toThrow(motif);
  await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT attente");
}

async function un(tx: Tx, sql: string, ...v: unknown[]): Promise<string> {
  const [ligne] = await tx.$queryRawUnsafe<Array<{ id: string }>>(sql, ...v);
  return ligne?.id as string;
}

interface Socle {
  session: string;
  inscription: string;
  incident: string;
  reclamation: string;
  moyen: string;
  action: string;
  remise: string;
}

/** Une session, une inscription et les parents des journaux, dans la transaction. */
async function socle(tx: Tx): Promise<Socle> {
  const offre = await un(
    tx,
    `INSERT INTO "offres_site" ("id", "code", "titre_fr", "slug", "format_pedagogique", "public_vise_fr",
       "duree_heures_min", "duree_heures_max", "tarif_type", "promesse_principale_fr", "angle_pedagogique_fr", "updated_at")
     VALUES (gen_random_uuid(), 'TEST-QNC', 'Offre test', 'offre-test-qnc', 'collectif_1jour', 'Public',
       7, 7, 'fixe', 'Promesse', 'Angle', now()) RETURNING "id"`,
  );
  const formation = await un(
    tx,
    `INSERT INTO "formations" ("id", "numero", "titre", "slug", "offre_site_id", "duree_heures", "updated_at")
     VALUES (gen_random_uuid(), 'TEST-FORM-QNC', 'Formation test', 'formation-test-qnc', $1::uuid, 7, now()) RETURNING "id"`,
    offre,
  );
  const session = await un(
    tx,
    `INSERT INTO "training_sessions" ("id", "numero", "titre_session", "formation_id", "date_debut", "date_fin",
       "modalite", "montant_ht_cents", "nb_participants_prevus", "updated_at")
     VALUES (gen_random_uuid(), 'TEST-SESS-QNC', 'Session test', $1::uuid, now(), now() + interval '1 day',
       'presentiel', 100000, 1, now()) RETURNING "id"`,
    formation,
  );
  const stagiaire = await un(
    tx,
    `INSERT INTO "trainees" ("id", "nom", "prenom", "email", "updated_at")
     VALUES (gen_random_uuid(), 'Fictif', 'Stagiaire', 'stagiaire-qnc@test.invalid', now()) RETURNING "id"`,
  );
  const inscription = await un(
    tx,
    `INSERT INTO "enrollments" ("id", "session_id", "trainee_id", "updated_at")
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, now()) RETURNING "id"`,
    session,
    stagiaire,
  );
  const incident = await un(
    tx,
    `INSERT INTO "incidents" ("id", "type", "gravite", "titre", "date_incident", "updated_at")
     VALUES (gen_random_uuid(), 'technique', 'mineur', 'Incident test', now(), now()) RETURNING "id"`,
  );
  const reclamation = await un(
    tx,
    `INSERT INTO "reclamations" ("id", "numero", "source", "reclamant_nom", "objet", "description", "date_reception", "updated_at")
     VALUES (gen_random_uuid(), 'TEST-REC-QNC', 'autre', 'Réclamant fictif', 'Objet', 'Description', now(), now()) RETURNING "id"`,
  );
  const moyen = await un(
    tx,
    `INSERT INTO "moyens_pedagogiques" ("id", "categorie", "libelle", "updated_at")
     VALUES (gen_random_uuid(), 'salle', 'Salle test', now()) RETURNING "id"`,
  );
  const action = await un(
    tx,
    `INSERT INTO "actions_amelioration" ("id", "numero", "origine", "constat", "action", "auteur_nom")
     VALUES (gen_random_uuid(), 'AXI-AMC-TEST-001', 'audit', 'Constat', 'Action', 'Direction (test)') RETURNING "id"`,
  );
  const remise = await un(
    tx,
    `INSERT INTO "remises_retours" ("id", "session_id", "enrollment_id", "nature", "destinataire", "canal", "objet")
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'remise', 'stagiaire', 'email', 'convocation') RETURNING "id"`,
    session,
    inscription,
  );
  return { session, inscription, incident, reclamation, moyen, action, remise };
}

/** Une ligne de chaque journal, posée par un INSERT ordinaire. */
const INSERTION: Record<TableAjoutSeul, (s: Socle) => [string, ...unknown[]]> = {
  incident_notes: (s) => [
    `INSERT INTO "incident_notes" ("id", "incident_id", "texte", "auteur_nom")
     VALUES (gen_random_uuid(), $1::uuid, 'Note de suivi', 'Direction (test)')`,
    s.incident,
  ],
  reclamation_etapes: (s) => [
    `INSERT INTO "reclamation_etapes" ("id", "reclamation_id", "etape", "auteur_nom")
     VALUES (gen_random_uuid(), $1::uuid, 'accuse', 'Direction (test)')`,
    s.reclamation,
  ],
  remises_retours: (s) => [
    `INSERT INTO "remises_retours" ("id", "session_id", "nature", "remise_id", "destinataire", "canal", "objet")
     VALUES (gen_random_uuid(), $1::uuid, 'ouverture', $2::uuid, 'stagiaire', 'email', 'convocation')`,
    s.session,
    s.remise,
  ],
  moyens_pedagogiques_historique: (s) => [
    `INSERT INTO "moyens_pedagogiques_historique" ("id", "moyen_id", "avant", "apres", "motif", "auteur_nom")
     VALUES (gen_random_uuid(), $1::uuid, '{}', '{"actif": false}', 'Salle fermée pour travaux', 'Direction (test)')`,
    s.moyen,
  ],
  sessions_changements_modalite_lieu: (s) => [
    `INSERT INTO "sessions_changements_modalite_lieu" ("id", "session_id", "nature", "avant", "apres", "motif", "auteur_nom")
     VALUES (gen_random_uuid(), $1::uuid, 'modalite', '{"modalite":"presentiel"}', '{"modalite":"distanciel"}',
       'Grève des transports annoncée', 'Direction (test)')`,
    s.session,
  ],
  relances_journal: (s) => [
    `INSERT INTO "relances_journal" ("id", "session_id", "enrollment_id", "objet", "destinataire", "canal", "rang")
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'questionnaire_satisfaction_froid', 'stagiaire', 'email', 1)`,
    s.session,
    s.inscription,
  ],
  actions_amelioration: () => [
    `INSERT INTO "actions_amelioration" ("id", "numero", "origine", "constat", "action", "auteur_nom")
     VALUES (gen_random_uuid(), 'AXI-AMC-TEST-002', 'incident', 'Constat', 'Action', 'Direction (test)')`,
  ],
  actions_amelioration_etapes: (s) => [
    `INSERT INTO "actions_amelioration_etapes" ("id", "action_id", "etape", "auteur_nom")
     VALUES (gen_random_uuid(), $1::uuid, 'realisee', 'Direction (test)')`,
    s.action,
  ],
  questionnaire_versions: () => [
    `INSERT INTO "questionnaire_versions" ("id", "type", "version", "contenu", "empreinte")
     VALUES (gen_random_uuid(), 'satisfaction_chaud', 1, '[]', '${EMPREINTE}')`,
  ],
  espace_stagiaire_ouvertures: (s) => [
    `INSERT INTO "espace_stagiaire_ouvertures" ("id", "trainee_id", "enrollment_id", "origine")
     VALUES (gen_random_uuid(), gen_random_uuid(), $1::uuid, 'navigateur')`,
    s.inscription,
  ],
};

/** Une colonne que l'UPDATE tente de réécrire, par journal. */
const COLONNE: Record<TableAjoutSeul, string> = {
  incident_notes: `"texte" = 'Réécrit après coup'`,
  reclamation_etapes: `"contenu" = 'Réécrit après coup'`,
  remises_retours: `"libelle" = 'Réécrit après coup'`,
  moyens_pedagogiques_historique: `"motif" = 'Réécrit après coup'`,
  sessions_changements_modalite_lieu: `"motif" = 'Réécrit après coup'`,
  relances_journal: `"rang" = 2`,
  actions_amelioration: `"constat" = 'Réécrit après coup'`,
  actions_amelioration_etapes: `"commentaire" = 'Réécrit après coup'`,
  questionnaire_versions: `"contenu" = '[1]'`,
  espace_stagiaire_ouvertures: `"origine" = 'apercu_automatique'`,
};

/** Un faux client dont `$transaction` exécute dans la transaction de test. */
function dans(tx: Tx): Parameters<typeof basculerInterrupteurQualiopi>[1] {
  return { $transaction: (fn) => fn(tx as never) };
}

async function admin(tx: Tx): Promise<void> {
  await tx.adminUser.create({
    data: {
      id: ADMIN_ID,
      name: "Test QNC L00",
      email: "qnc-l00@test.invalid",
      passwordHash: "x",
      role: "super_admin",
    },
  });
}

describe("socle QNC (L00) contre un vrai Postgres (Gate D)", () => {
  it("la garde de dérive est verte : chaque trigger et CHECK déclaré existe, actif", async () => {
    const db = new PrismaClient();
    try {
      const presents = await db.$queryRawUnsafe<ObjetPresentSocle[]>(SQL_PRESENTS_SOCLE_QNC);
      expect(fautesDeriveSocleQnc(presents)).toEqual([]);
    } finally {
      await db.$disconnect();
    }
  });

  it.each(TABLES_AJOUT_SEUL)(
    "%s : INSERT accepté, UPDATE / DELETE / TRUNCATE refusés",
    async (t) => {
      await dansTransactionAnnulee(async (tx) => {
        const s = await socle(tx);
        const [sql, ...v] = INSERTION[t](s);
        await tx.$executeRawUnsafe(sql, ...v);
        await refuse(tx, `UPDATE "${t}" SET ${COLONNE[t]}`, /ajout seul/);
        await refuse(tx, `DELETE FROM "${t}"`, /ajout seul/);
        await refuse(tx, `TRUNCATE "${t}" CASCADE`, /ajout seul/);
        const [n] = await tx.$queryRawUnsafe<Array<{ n: bigint }>>(
          `SELECT count(*)::bigint AS n FROM "${t}"`,
        );
        expect(Number(n?.n)).toBeGreaterThanOrEqual(1);
      });
    },
  );

  it("une session ou une inscription qui porte une remise ne se supprime pas (RESTRICT)", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const s = await socle(tx);
      await refuse(tx, `DELETE FROM "enrollments" WHERE "id" = '${s.inscription}'`, /foreign key/);
      await refuse(
        tx,
        `DELETE FROM "training_sessions" WHERE "id" = '${s.session}'`,
        /foreign key/,
      );
    });
  });

  it("les CHECK refusent : motif court, retour sans remise, remise qui vise une remise, rang 0, version 0, empreinte", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const s = await socle(tx);
      await refuse(
        tx,
        `INSERT INTO "moyens_pedagogiques_historique" ("id", "moyen_id", "avant", "apres", "motif", "auteur_nom")
         VALUES (gen_random_uuid(), '${s.moyen}', '{}', '{}', '  123456789  ', 'X')`,
        /moyens_pedagogiques_historique_motif/,
      );
      await refuse(
        tx,
        `INSERT INTO "sessions_changements_modalite_lieu" ("id", "session_id", "nature", "avant", "apres", "motif", "auteur_nom")
         VALUES (gen_random_uuid(), '${s.session}', 'lieu', '{}', '{}', '123456789', 'X')`,
        /sessions_changements_modalite_lieu_motif/,
      );
      await refuse(
        tx,
        `INSERT INTO "remises_retours" ("id", "session_id", "nature", "destinataire", "canal", "objet")
         VALUES (gen_random_uuid(), '${s.session}', 'signature', 'entreprise', 'espace', 'convention')`,
        /remises_retours_retour_vise_une_remise/,
      );
      await refuse(
        tx,
        `INSERT INTO "remises_retours" ("id", "session_id", "nature", "remise_id", "destinataire", "canal", "objet")
         VALUES (gen_random_uuid(), '${s.session}', 'remise', '${s.remise}', 'entreprise', 'espace', 'convention')`,
        /remises_retours_retour_vise_une_remise/,
      );
      await refuse(
        tx,
        `INSERT INTO "relances_journal" ("id", "session_id", "objet", "destinataire", "canal", "rang")
         VALUES (gen_random_uuid(), '${s.session}', 'x', 'financeur', 'papier', 0)`,
        /relances_journal_rang_positif/,
      );
      await refuse(
        tx,
        `INSERT INTO "questionnaire_versions" ("id", "type", "version", "contenu", "empreinte")
         VALUES (gen_random_uuid(), 'positionnement', 0, '[]', '${EMPREINTE}')`,
        /questionnaire_versions_version_positive/,
      );
      await refuse(
        tx,
        `INSERT INTO "questionnaire_versions" ("id", "type", "version", "contenu", "empreinte")
         VALUES (gen_random_uuid(), 'positionnement', 1, '[]', '${"A".repeat(64)}')`,
        /questionnaire_versions_empreinte_sha256/,
      );
    });
  });

  it("éteint : une session et une inscription neuves ne sont PAS de test, et sans projet", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const s = await socle(tx);
      const [ligne] = await tx.$queryRawUnsafe<
        Array<{ session_test: boolean; projet: string | null; inscription_test: boolean }>
      >(
        `SELECT ts."est_test_interne" AS session_test, ts."projet_id" AS projet,
                e."est_test_interne" AS inscription_test
         FROM "training_sessions" ts JOIN "enrollments" e ON e."session_id" = ts."id"
         WHERE e."id" = $1::uuid`,
        s.inscription,
      );
      expect(ligne).toEqual({ session_test: false, projet: null, inscription_test: false });
    });
  });

  it.each<[EtatInterrupteur | null, boolean]>([
    [null, false],
    ["eteint", false],
    ["essai", false],
    ["actif", true],
  ])("veille, interrupteur %s : UPDATE et DELETE refusés = %s", async (etat, refusAttendu) => {
    await dansTransactionAnnulee(async (tx) => {
      await admin(tx);
      if (etat !== null) {
        await basculerInterrupteurQualiopi(
          { lot: "veille", etat, adminUserId: ADMIN_ID },
          dans(tx),
        );
      }
      await tx.$executeRawUnsafe(
        `INSERT INTO "veilles" ("id", "type", "source", "titre", "contenu", "date_veille", "updated_at")
         VALUES (gen_random_uuid(), 'legale', 'Source', 'Titre', 'Contenu', now(), now())`,
      );
      const maj = `UPDATE "veilles" SET "titre" = 'Titre corrigé'`;
      const suppr = `DELETE FROM "veilles"`;
      if (refusAttendu) {
        await refuse(tx, maj, /veilles est en ajout seul/);
        await refuse(tx, suppr, /veilles est en ajout seul/);
        await refuse(tx, `TRUNCATE "veilles"`, /veilles est en ajout seul/);
      } else {
        expect(await tx.$executeRawUnsafe(maj)).toBe(1);
        expect(await tx.$executeRawUnsafe(suppr)).toBe(1);
      }
    });
  });

  it.each<[EtatInterrupteur | null, boolean]>([
    [null, false],
    ["essai", false],
    ["actif", true],
  ])("revue de direction, interrupteur %s : plan_actions figé = %s", async (etat, refusAttendu) => {
    await dansTransactionAnnulee(async (tx) => {
      await admin(tx);
      if (etat !== null) {
        await basculerInterrupteurQualiopi(
          { lot: "amelioration", etat, adminUserId: ADMIN_ID },
          dans(tx),
        );
      }
      await tx.$executeRawUnsafe(
        `INSERT INTO "revues_direction" ("id", "annee", "date_revue", "updated_at")
         VALUES (gen_random_uuid(), 1999, now(), now())`,
      );
      const plan = `UPDATE "revues_direction" SET "plan_actions" = '[{"action":"x"}]' WHERE "annee" = 1999`;
      if (refusAttendu) await refuse(tx, plan, /plan_actions est en lecture seule/);
      else expect(await tx.$executeRawUnsafe(plan)).toBe(1);
      // Le reste de la revue reste modifiable, interrupteur allumé ou non.
      expect(
        await tx.$executeRawUnsafe(
          `UPDATE "revues_direction" SET "statut" = 'validee' WHERE "annee" = 1999`,
        ),
      ).toBe(1);
    });
  });

  it("une bascule écrit le réglage et sa ligne activity_logs (qui, avant, après) ; SQL et TS lisent pareil", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await admin(tx);
      const premiere = await basculerInterrupteurQualiopi(
        { lot: "l99", etat: "essai", adminUserId: ADMIN_ID },
        dans(tx),
      );
      const seconde = await basculerInterrupteurQualiopi(
        { lot: "l99", etat: "actif", adminUserId: ADMIN_ID },
        dans(tx),
      );
      expect(premiere).toEqual({ cle: "qualiopi.l99.actif", avant: "eteint", apres: "essai" });
      expect(seconde).toEqual({ cle: "qualiopi.l99.actif", avant: "essai", apres: "actif" });

      const journal = await tx.$queryRawUnsafe<
        Array<{ action: string; admin_user_id: string; target_id: string | null; changes: unknown }>
      >(
        `SELECT action, admin_user_id::text, target_id::text, changes FROM "activity_logs"
         WHERE "admin_user_id" = $1::uuid ORDER BY "created_at", "id"`,
        ADMIN_ID,
      );
      expect(journal).toHaveLength(2);
      expect(journal.map((l) => l.action)).toEqual([
        "qualiopi.interrupteur_bascule",
        "qualiopi.interrupteur_bascule",
      ]);
      expect(journal.map((l) => l.changes)).toEqual(
        expect.arrayContaining([
          { cle: "qualiopi.l99.actif", avant: "eteint", apres: "essai" },
          { cle: "qualiopi.l99.actif", avant: "essai", apres: "actif" },
        ]),
      );
      expect(journal.every((l) => l.target_id === null)).toBe(true);

      expect(await lireInterrupteurQualiopi("l99", tx)).toBe("actif");
      const [sql] = await tx.$queryRawUnsafe<Array<{ etat: string }>>(
        `SELECT "qualiopi_interrupteur_etat"('qualiopi.l99.actif') AS etat`,
      );
      expect(sql?.etat).toBe("actif");
      const [absent] = await tx.$queryRawUnsafe<Array<{ etat: string }>>(
        `SELECT "qualiopi_interrupteur_etat"('qualiopi.absent.actif') AS etat`,
      );
      expect(absent?.etat).toBe("eteint");
    });
  });
});
