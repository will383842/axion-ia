/**
 * INT-T65-A — les CHECK de la condition suspensive OPCO (forme d'A02), contre
 * un VRAI Postgres migré à neuf (Gate D,
 * `pnpm test:integration tests/integration/condition-suspensive`).
 *
 * TÉMOINS exigés par A02 (rattrapage 105) :
 *   - la case cochée SANS seuil, avec DEUX seuils ou SANS date est refusée par
 *     `convention_condition_coherente` ;
 *   - 0 et 10 001 points de base sont refusés par `convention_seuil_bps_borne` ;
 *   - 0 centime est refusé par `convention_seuil_cents_positif` ;
 *   - une convention EXISTANTE (écrite comme l'ancienne app l'écrit, sans
 *     aucune des colonnes neuves) reste intacte : case à `false`, le reste NULL ;
 *   - case non cochée avec un seuil ou une date : refusée ;
 *   - aucun DEFAULT de seuil en base.
 *
 * Chaque cas vit dans SA transaction, ANNULÉE : la base reste vide. Un refus de
 * CHECK est attendu au niveau Postgres (code 23514), nommé.
 *
 * Sans `DATABASE_URL`, ce fichier ÉCHOUE — il ne se saute pas : un test qui
 * s'efface faute de banc est un vert qui ne regarde rien.
 */

import { describe, expect, it } from "vitest";

import { PrismaClient } from "../../../prisma/generated/client";

type Tx = {
  $executeRawUnsafe: (sql: string, ...v: unknown[]) => Promise<number>;
  $queryRawUnsafe: <T>(sql: string, ...v: unknown[]) => Promise<T>;
};

const ANNULE = new Error("ANNULE — la transaction de test ne laisse aucune ligne");

async function dansTransactionAnnulee(fn: (tx: Tx) => Promise<void>): Promise<void> {
  const db = new PrismaClient();
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

let rang = 0;

/** Insère une convention avec les colonnes données ; rend l'id. */
async function inserer(tx: Tx, colonnes: Record<string, string> = {}): Promise<string> {
  rang += 1;
  const noms = ["id", "type", "numero", "hash_sha256", "suppression_prevue_at", "updated_at"];
  const valeurs = [
    "gen_random_uuid()",
    "'convention'",
    `'TEST-T65-${rang}'`,
    `'${"0".repeat(64)}'`,
    "now() + interval '5 years'",
    "now()",
  ];
  for (const [nom, valeur] of Object.entries(colonnes)) {
    noms.push(`"${nom}"`);
    valeurs.push(valeur);
  }
  const [ligne] = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO "documents_generes" (${noms.join(", ")}) VALUES (${valeurs.join(", ")}) RETURNING "id"`,
  );
  return ligne?.id as string;
}

/** Attend un refus de CHECK nommé ; le savepoint garde la transaction utilisable. */
async function refuse(tx: Tx, colonnes: Record<string, string>, contrainte: string) {
  await tx.$executeRawUnsafe("SAVEPOINT cas");
  let message = "";
  try {
    await inserer(tx, colonnes);
  } catch (e) {
    message = e instanceof Error ? e.message : String(e);
  }
  await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT cas");
  expect(message, `aucun refus — attendu ${contrainte}`).toMatch(new RegExp(contrainte));
}

const COCHEE = {
  condition_suspensive_opco: "true",
  etat_condition_suspensive: "'en_attente'",
};
const LIMITE = "'2026-12-14T23:00:00Z'::timestamptz";

describe("documents_generes — CHECK de la condition suspensive OPCO (Postgres réel)", () => {
  it("les quatre CHECK nommés existent", async () => {
    const db = new PrismaClient();
    try {
      const lignes = await db.$queryRawUnsafe<Array<{ conname: string }>>(
        `SELECT conname FROM pg_constraint
         WHERE conrelid = '"documents_generes"'::regclass AND contype = 'c'
           AND conname LIKE 'convention\\_%' ORDER BY conname`,
      );
      expect(lignes.map((l) => l.conname)).toEqual([
        "convention_condition_coherente",
        "convention_condition_etat_coherent",
        "convention_seuil_bps_borne",
        "convention_seuil_cents_positif",
      ]);
    } finally {
      await db.$disconnect();
    }
  });

  it("aucun DEFAULT de seuil en base ; la date limite est un timestamptz(3)", async () => {
    const db = new PrismaClient();
    try {
      const lignes = await db.$queryRawUnsafe<
        Array<{ column_name: string; column_default: string | null; type: string }>
      >(
        `SELECT column_name, column_default,
                format_type(a.atttypid, a.atttypmod) AS type
         FROM information_schema.columns c
         JOIN pg_attribute a ON a.attrelid = '"documents_generes"'::regclass AND a.attname = c.column_name
         WHERE c.table_name = 'documents_generes'
           AND column_name IN ('seuil_condition_bps', 'seuil_condition_cents', 'date_limite_condition', 'condition_suspensive_opco')
         ORDER BY column_name`,
      );
      const parNom = Object.fromEntries(lignes.map((l) => [l.column_name, l]));
      expect(parNom["seuil_condition_bps"]?.column_default).toBeNull();
      expect(parNom["seuil_condition_cents"]?.column_default).toBeNull();
      expect(parNom["date_limite_condition"]?.column_default).toBeNull();
      expect(parNom["date_limite_condition"]?.type).toBe("timestamp(3) with time zone");
      expect(parNom["condition_suspensive_opco"]?.column_default).toBe("false");
    } finally {
      await db.$disconnect();
    }
  });

  it("une convention existante (écrite sans les colonnes neuves) reste intacte", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const id = await inserer(tx);
      const [l] = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT condition_suspensive_opco, seuil_condition_bps, seuil_condition_cents,
                date_limite_condition, etat_condition_suspensive
         FROM documents_generes WHERE id = $1::uuid`,
        id,
      );
      expect(l).toEqual({
        condition_suspensive_opco: false,
        seuil_condition_bps: null,
        seuil_condition_cents: null,
        date_limite_condition: null,
        etat_condition_suspensive: null,
      });
    });
  });

  it("acceptées : un seuil en points de base, ou un seuil en centimes, avec la date", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await inserer(tx, { ...COCHEE, seuil_condition_bps: "5000", date_limite_condition: LIMITE });
      await inserer(tx, { ...COCHEE, seuil_condition_bps: "1", date_limite_condition: LIMITE });
      await inserer(tx, { ...COCHEE, seuil_condition_bps: "10000", date_limite_condition: LIMITE });
      await inserer(tx, { ...COCHEE, seuil_condition_cents: "1", date_limite_condition: LIMITE });
      await inserer(tx, {
        ...COCHEE,
        seuil_condition_cents: "300000",
        date_limite_condition: LIMITE,
      });
    });
  });

  it("🔴 case cochée SANS seuil, avec DEUX seuils, ou SANS date : refusée", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await refuse(
        tx,
        { ...COCHEE, date_limite_condition: LIMITE },
        "convention_condition_coherente",
      );
      await refuse(
        tx,
        {
          ...COCHEE,
          seuil_condition_bps: "5000",
          seuil_condition_cents: "300000",
          date_limite_condition: LIMITE,
        },
        "convention_condition_coherente",
      );
      await refuse(
        tx,
        { ...COCHEE, seuil_condition_bps: "5000" },
        "convention_condition_coherente",
      );
    });
  });

  it("🔴 case NON cochée avec un seuil ou une date : refusée", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await refuse(tx, { seuil_condition_bps: "5000" }, "convention_condition_coherente");
      await refuse(tx, { seuil_condition_cents: "100" }, "convention_condition_coherente");
      await refuse(tx, { date_limite_condition: LIMITE }, "convention_condition_coherente");
    });
  });

  it("🔴 0 et 10 001 points de base : refusés", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await refuse(
        tx,
        { ...COCHEE, seuil_condition_bps: "0", date_limite_condition: LIMITE },
        "convention_seuil_bps_borne",
      );
      await refuse(
        tx,
        { ...COCHEE, seuil_condition_bps: "10001", date_limite_condition: LIMITE },
        "convention_seuil_bps_borne",
      );
    });
  });

  it("🔴 0 centime et un montant négatif : refusés", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await refuse(
        tx,
        { ...COCHEE, seuil_condition_cents: "0", date_limite_condition: LIMITE },
        "convention_seuil_cents_positif",
      );
      await refuse(
        tx,
        { ...COCHEE, seuil_condition_cents: "-1", date_limite_condition: LIMITE },
        "convention_seuil_cents_positif",
      );
    });
  });

  it("🔴 l'état est présent si et seulement si la case est cochée", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await refuse(
        tx,
        {
          condition_suspensive_opco: "true",
          seuil_condition_bps: "5000",
          date_limite_condition: LIMITE,
        },
        "convention_condition_etat_coherent",
      );
      await refuse(
        tx,
        { etat_condition_suspensive: "'active'" },
        "convention_condition_etat_coherent",
      );
    });
  });

  it("🔴 aucun flottant : un seuil décimal ne s'écrit pas dans une colonne entière", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe("SAVEPOINT cas");
      // Postgres ARRONDIT un numérique vers integer : seul le type entier de
      // la colonne est vérifiable ici ; l'application refuse avant (zod `.int()`).
      const [t] = await tx.$queryRawUnsafe<Array<{ type: string }>>(
        `SELECT format_type(atttypid, atttypmod) AS type FROM pg_attribute
         WHERE attrelid = '"documents_generes"'::regclass AND attname = 'seuil_condition_cents'`,
      );
      expect(t?.type).toBe("integer");
      await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT cas");
    });
  });
});
