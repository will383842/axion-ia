/**
 * ADR 0060 — LE JOURNAL DES RÉOUVERTURES EST EN AJOUT SEUL, contre un VRAI
 * Postgres migré à neuf (Gate D, `pnpm test:integration tests/integration/verrou-dossier`) :
 *   - un UPDATE ou un DELETE sur `session_dossier_evenements` lève ;
 *   - une réouverture au motif de 9 caractères est rejetée par le CHECK ;
 *   - deux réouvertures successives de la même session font DEUX lignes ;
 *   - la session d'un dossier qui porte des événements ne se supprime pas ;
 *   - la garde de dérive, lue dans `pg_trigger` / `pg_constraint`, est verte.
 * Chaque cas vit dans SA transaction, ANNULÉE : la base reste vide.
 *
 * Sans `DATABASE_URL`, ce fichier ÉCHOUE — il ne se saute pas : un test qui
 * s'efface faute de banc est un vert qui ne regarde rien.
 *
 * Le texte de la migration et la garde de dérive elle-même (qu'elle ROUGIT
 * quand le trigger ou le CHECK disparaît) sont testés sans base dans
 * `src/server/qualiopi/sessions/__tests__/evenements-dossier-append-only.integration.spec.ts`.
 */

import { describe, expect, it } from "vitest";

import { PrismaClient } from "../../../prisma/generated/client";
import {
  SQL_CHECKS_PRESENTS,
  SQL_TRIGGERS_PRESENTS,
  fautesDeriveVerrouDossier,
  type ObjetPresent,
} from "../../../src/server/qualiopi/sessions/verrou-dossier-objets-sql";

describe("session_dossier_evenements contre un vrai Postgres (Gate D)", () => {
  type Tx = {
    $executeRawUnsafe: (sql: string, ...v: unknown[]) => Promise<number>;
    $queryRawUnsafe: <T>(sql: string, ...v: unknown[]) => Promise<T>;
  };

  async function client() {
    return new PrismaClient();
  }

  const ANNULE = new Error("ANNULE — la transaction de test ne laisse aucune ligne");

  /** Exécute `fn` dans une transaction TOUJOURS annulée. */
  async function dansTransactionAnnulee(fn: (tx: Tx) => Promise<void>): Promise<void> {
    const db = await client();
    try {
      await expect(
        db.$transaction(async (tx) => {
          await fn(tx as unknown as Tx);
          throw ANNULE;
        }),
      ).rejects.toBe(ANNULE);
    } finally {
      await db.$disconnect();
    }
  }

  /** Une session minimale (offre → formation → session), dans la transaction. */
  async function sessionMinimale(tx: Tx): Promise<string> {
    const [offre] = await tx.$queryRawUnsafe<Array<{ id: string }>>(`
      INSERT INTO "offres_site" ("id", "code", "titre_fr", "slug", "format_pedagogique", "public_vise_fr",
        "duree_heures_min", "duree_heures_max", "tarif_type", "promesse_principale_fr", "angle_pedagogique_fr", "updated_at")
      VALUES (gen_random_uuid(), 'TEST-VERROU', 'Offre test', 'offre-test-verrou', 'collectif_1jour', 'Public',
        7, 7, 'fixe', 'Promesse', 'Angle', now())
      RETURNING "id"`);
    const [formation] = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "formations" ("id", "numero", "titre", "slug", "offre_site_id", "duree_heures", "updated_at")
       VALUES (gen_random_uuid(), 'TEST-FORM-VERROU', 'Formation test', 'formation-test-verrou', $1::uuid, 7, now())
       RETURNING "id"`,
      offre?.id,
    );
    const [session] = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "training_sessions" ("id", "numero", "titre_session", "formation_id", "date_debut", "date_fin",
         "modalite", "montant_ht_cents", "nb_participants_prevus", "statut", "updated_at")
       VALUES (gen_random_uuid(), 'TEST-SESS-VERROU', 'Session test', $1::uuid, now() - interval '20 days',
         now() - interval '19 days', 'presentiel', 100000, 1, 'realisee', now())
       RETURNING "id"`,
      formation?.id,
    );
    return session?.id as string;
  }

  async function reouvrir(tx: Tx, sessionId: string, motif: string): Promise<void> {
    await tx.$executeRawUnsafe(
      `INSERT INTO "session_dossier_evenements" ("id", "session_id", "type", "motif", "auteur_id", "auteur_nom")
       VALUES (gen_random_uuid(), $1::uuid, 'reouverture', $2, NULL, 'Direction (test)')`,
      sessionId,
      motif,
    );
  }

  it("un UPDATE lève une exception", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const s = await sessionMinimale(tx);
      await reouvrir(tx, s, "Correction de la date de fin");
      await expect(
        tx.$executeRawUnsafe(
          `UPDATE "session_dossier_evenements" SET "motif" = 'Réécrit après coup'`,
        ),
      ).rejects.toThrow(/ajout seul/);
    });
  });

  it("un DELETE lève une exception", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const s = await sessionMinimale(tx);
      await reouvrir(tx, s, "Correction de la date de fin");
      await expect(
        tx.$executeRawUnsafe(`DELETE FROM "session_dossier_evenements"`),
      ).rejects.toThrow(/ajout seul/);
    });
  });

  it("une réouverture au motif de 9 caractères est rejetée par le CHECK", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const s = await sessionMinimale(tx);
      await expect(reouvrir(tx, s, "123456789")).rejects.toThrow(
        /session_dossier_evenements_motif_reouverture/,
      );
    });
  });

  it("un motif fait d'espaces ne passe pas non plus", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const s = await sessionMinimale(tx);
      await expect(reouvrir(tx, s, "            a")).rejects.toThrow(
        /session_dossier_evenements_motif_reouverture/,
      );
    });
  });

  it("deux réouvertures successives de la même session font DEUX lignes", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const s = await sessionMinimale(tx);
      await reouvrir(tx, s, "Première correction du dossier");
      await tx.$executeRawUnsafe(
        `INSERT INTO "session_dossier_evenements" ("id", "session_id", "type", "motif", "auteur_nom")
         VALUES (gen_random_uuid(), $1::uuid, 'reverrouillage', NULL, 'Direction (test)')`,
        s,
      );
      await reouvrir(tx, s, "Seconde correction du dossier");
      const [n] = await tx.$queryRawUnsafe<Array<{ n: bigint }>>(
        `SELECT count(*)::bigint AS n FROM "session_dossier_evenements" WHERE "session_id" = $1::uuid AND "type" = 'reouverture'`,
        s,
      );
      expect(Number(n?.n)).toBe(2);
    });
  });

  it("la session d'un dossier qui porte des événements ne se supprime pas (ON DELETE RESTRICT)", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const s = await sessionMinimale(tx);
      await reouvrir(tx, s, "Correction de la date de fin");
      await expect(
        tx.$executeRawUnsafe(`DELETE FROM "training_sessions" WHERE "id" = $1::uuid`, s),
        // Le motif PRÉCIS : un `toThrow()` nu passait pour n'importe quelle
        // erreur (faute de frappe SQL, colonne absente…) sans rien prouver de
        // la contrainte. On exige la violation de CETTE clé étrangère (23503).
      ).rejects.toThrow(/session_dossier_evenements_session_id_fkey/);
    });
  });

  it("garde de dérive : le trigger et le CHECK existent et sont actifs en base", async () => {
    const db = await client();
    try {
      const triggers =
        await db.$queryRawUnsafe<Array<{ table: string; nom: string; actif: boolean }>>(
          SQL_TRIGGERS_PRESENTS,
        );
      const checks =
        await db.$queryRawUnsafe<Array<{ table: string; nom: string }>>(SQL_CHECKS_PRESENTS);
      const presents: ObjetPresent[] = [
        ...triggers.map((t) => ({
          table: t.table,
          nom: t.nom,
          type: "trigger" as const,
          actif: t.actif,
        })),
        ...checks.map((c) => ({ table: c.table, nom: c.nom, type: "check" as const })),
      ];
      expect(fautesDeriveVerrouDossier(presents)).toEqual([]);
    } finally {
      await db.$disconnect();
    }
  });
});
