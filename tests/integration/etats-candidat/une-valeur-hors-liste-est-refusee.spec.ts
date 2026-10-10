/**
 * L12 (paquet 4a) — LES ÉTATS DES VIDÉOS ET DES LIENS CONTRE UN VRAI POSTGRES
 * (`pnpm test:integration tests/integration/etats-candidat`).
 *
 * Le test unitaire prouve que le TYPAGE refuse « rejete ». Celui-ci prouve que
 * la BASE le refuse aussi, une fois la migration jouée : c'est elle qui tient
 * quand une écriture passe par du SQL brut ou par un module qui aurait oublié
 * `etatVideo()`.
 *
 * Tout se joue dans une transaction ANNULÉE : la base reste telle quelle.
 * Sans `DATABASE_URL`, ce fichier ÉCHOUE — il ne se saute pas.
 */

import { describe, expect, it } from "vitest";

import { PrismaClient } from "../../../prisma/generated/client";
import { ETATS_LIEN_CANDIDAT, ETATS_VIDEO_CANDIDAT } from "../../../src/lib/careers/etats-candidat";

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

describe("L12 — Postgres refuse un état hors liste", () => {
  it("les types portent exactement les valeurs du code", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const video = await tx.$queryRawUnsafe<Array<{ v: string }>>(
        `SELECT unnest(enum_range(NULL::"EtatVideoCandidat"))::text AS v`,
      );
      const lien = await tx.$queryRawUnsafe<Array<{ v: string }>>(
        `SELECT unnest(enum_range(NULL::"EtatLienCandidat"))::text AS v`,
      );
      expect(video.map((r) => r.v)).toEqual([...ETATS_VIDEO_CANDIDAT]);
      expect(lien.map((r) => r.v)).toEqual([...ETATS_LIEN_CANDIDAT]);
    });
  });

  it("« rejete » et « morte » sont refusés, « rejetee » et « mort » acceptés", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe(`SAVEPOINT a`);
      await expect(tx.$queryRawUnsafe(`SELECT 'rejete'::"EtatVideoCandidat"`)).rejects.toThrow(
        /invalid input value for enum|22P02/,
      );
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT a`);
      await expect(tx.$queryRawUnsafe(`SELECT 'morte'::"EtatLienCandidat"`)).rejects.toThrow(
        /invalid input value for enum|22P02/,
      );
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT a`);
      await tx.$queryRawUnsafe(`SELECT 'rejetee'::"EtatVideoCandidat", 'mort'::"EtatLienCandidat"`);
    });
  });

  it("les deux colonnes sont NULLABLES, et l'ancienne colonne texte est gardée", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const cols = await tx.$queryRawUnsafe<
        Array<{ table_name: string; column_name: string; is_nullable: string; udt_name: string }>
      >(
        `SELECT table_name, column_name, is_nullable, udt_name FROM information_schema.columns
         WHERE table_name IN ('job_application_videos', 'job_application_links')
           AND column_name IN ('statut', 'etat', 'etat_ferme')
         ORDER BY table_name, column_name`,
      );
      expect(cols).toEqual([
        {
          table_name: "job_application_links",
          column_name: "etat",
          is_nullable: "NO",
          udt_name: "varchar",
        },
        {
          table_name: "job_application_links",
          column_name: "etat_ferme",
          is_nullable: "YES",
          udt_name: "EtatLienCandidat",
        },
        {
          table_name: "job_application_videos",
          column_name: "etat_ferme",
          is_nullable: "YES",
          udt_name: "EtatVideoCandidat",
        },
        {
          table_name: "job_application_videos",
          column_name: "statut",
          is_nullable: "NO",
          udt_name: "varchar",
        },
      ]);
    });
  });
});
