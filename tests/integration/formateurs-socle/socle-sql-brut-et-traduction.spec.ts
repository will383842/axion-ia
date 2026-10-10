/**
 * SCHÉMA N° 1 DU CHANTIER FORMATEURS FREELANCE CONTRE UN VRAI POSTGRES
 * (`pnpm test:integration tests/integration/formateurs-socle`).
 *
 *   1. la garde de dérive lue dans `pg_constraint` / `pg_trigger` / `pg_indexes`
 *      (dont la clause partielle de `trainers_email_ouverte_unique`, ADR 0067) ;
 *   2. la TRADUCTION SQL du prédicat `estCandidatureFormateurFreelance` : les
 *      instructions EXACTES de la migration sont rejouées sur un corpus, et
 *      chaque ligne est comparée au prédicat TypeScript ;
 *   3. le comportement : tables de preuve en ajout seul, IBAN chiffré `enc:v2:`
 *      seulement, activation cohérente, et « nombre d'actifs marqués
 *      antérieure au contrôle = nombre d'actifs avant ».
 *
 * Chaque cas vit dans SA transaction, ANNULÉE : la base reste vide.
 * Sans `DATABASE_URL`, ce fichier ÉCHOUE — il ne se saute pas.
 */

import { describe, expect, it } from "vitest";

import { PrismaClient } from "../../../prisma/generated/client";
import { estCandidatureFormateurFreelance } from "../../../src/lib/careers/formateur-freelance";
import {
  SQL_REMPLIR_NATURE_CANDIDATURES_DEPUIS_OFFRE,
  SQL_REMPLIR_NATURE_CANDIDATURES_SPONTANEES,
  SQL_REMPLIR_NATURE_OFFRES,
} from "../../../src/lib/careers/nature-collaboration-sql";
import {
  SQL_CONTRAINTES_PRESENTES_SOCLE,
  SQL_INDEX_PRESENTS_SOCLE,
  SQL_STOCK_ACTIF_ANTERIEUR_AU_CONTROLE,
  SQL_TRIGGERS_PRESENTS_SOCLE,
  fautesDeriveSocleFormateurs,
  type ObjetPresentSocle,
} from "../../../src/server/qualiopi/formateurs-independants/socle-objets-sql";

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

/** Joue `sqls` derrière un SAVEPOINT : « accepte », ou le message d'erreur. */
async function essayer(tx: Tx, ...sqls: Array<[string, ...unknown[]]>): Promise<string> {
  await tx.$executeRawUnsafe("SAVEPOINT essai");
  try {
    for (const [sql, ...v] of sqls) await tx.$executeRawUnsafe(sql, ...v);
    await tx.$executeRawUnsafe("RELEASE SAVEPOINT essai");
    return "accepte";
  } catch (e) {
    await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT essai");
    return e instanceof Error ? e.message : String(e);
  }
}

// ── Corpus de la traduction ────────────────────────────────────────────────

interface OffreCorpus {
  readonly slug: string;
  readonly titleFr: string;
  readonly employmentType: string;
  readonly secondaryEmploymentType: string | null;
}

const OFFRES: ReadonlyArray<OffreCorpus> = [
  {
    slug: "formateur-ia-freelance",
    titleFr: "Formateur IA freelance",
    employmentType: "CONTRACTOR",
    secondaryEmploymentType: null,
  },
  {
    slug: "formateur-ia-itinerant",
    titleFr: "Formateur IA en entreprise (itinérant)",
    employmentType: "FULL_TIME",
    secondaryEmploymentType: null,
  },
  {
    slug: "formateur-ia-sedentaire",
    titleFr: "Formateur IA sédentaire",
    employmentType: "FULL_TIME",
    secondaryEmploymentType: null,
  },
  {
    slug: "test-socle-a",
    titleFr: "Formatrice indépendante en IA",
    employmentType: "FULL_TIME",
    secondaryEmploymentType: null,
  },
  {
    slug: "test-socle-b",
    titleFr: "FORMATEUR INDÉPENDANT",
    employmentType: "PART_TIME",
    secondaryEmploymentType: null,
  },
  {
    slug: "test-socle-c",
    titleFr: "Formateur IA",
    employmentType: "CONTRACTOR",
    secondaryEmploymentType: null,
  },
  {
    slug: "test-socle-d",
    titleFr: "Formateur IA",
    employmentType: "FULL_TIME",
    secondaryEmploymentType: "CONTRACTOR",
  },
  {
    slug: "test-socle-e",
    titleFr: "Développeur freelance",
    employmentType: "CONTRACTOR",
    secondaryEmploymentType: null,
  },
  {
    slug: "test-socle-f",
    titleFr: "Travail indépendant",
    employmentType: "CONTRACTOR",
    secondaryEmploymentType: null,
  },
  {
    slug: "formateur-independant-lyon",
    titleFr: "Animateur d'ateliers",
    employmentType: "FULL_TIME",
    secondaryEmploymentType: null,
  },
  // « é » DÉCOMPOSÉ (e + U+0301) : le pliage NFD doit le replier comme le prédicat.
  {
    slug: "test-socle-g",
    titleFr: "Formateur IA (indépendant)",
    employmentType: "FULL_TIME",
    secondaryEmploymentType: null,
  },
  {
    slug: "formatrice-freelance-paris",
    titleFr: "Consultante",
    employmentType: "FULL_TIME",
    secondaryEmploymentType: null,
  },
  {
    slug: "test-socle-h",
    titleFr: "Formateurs IA — réseau d'indépendants",
    employmentType: "FULL_TIME",
    secondaryEmploymentType: null,
  },
  {
    slug: "test-socle-i",
    titleFr: "Formation freelance",
    employmentType: "CONTRACTOR",
    secondaryEmploymentType: null,
  },
  {
    slug: "test-socle-j",
    titleFr: "Formateur",
    employmentType: "FULL_TIME",
    secondaryEmploymentType: null,
  },
];

const SNAPS_SPONTANEES: ReadonlyArray<string> = [
  "Candidature spontanée — Formateur IA freelance",
  "Formatrice indépendante",
  "Développeur",
  "Formateur salarié",
  "FORMATEUR (INDÉPENDANT)",
  "Travail indépendant",
];

const uuid = (n: number, prefixe: string): string =>
  `${prefixe}-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function insererOffre(tx: Tx, id: string, o: OffreCorpus): Promise<void> {
  await tx.$executeRawUnsafe(
    `INSERT INTO "job_offers" ("id", "slug", "title_fr", "title_en", "summary_fr", "summary_en",
       "body_fr", "body_text_fr", "body_en", "body_text_en", "employment_type",
       "secondary_employment_type", "updated_at")
     VALUES ($1::uuid, $2, $3, 'x', 'x', 'x', 'x', 'x', 'x', 'x', $4, $5, now())`,
    id,
    o.slug,
    o.titleFr,
    o.employmentType,
    o.secondaryEmploymentType,
  );
}

async function insererCandidature(
  tx: Tx,
  id: string,
  offerId: string | null,
  snap: string,
): Promise<void> {
  await tx.$executeRawUnsafe(
    `INSERT INTO "job_applications" ("id", "offer_id", "offer_title_snap", "first_name",
       "last_name", "email", "phone", "consent_version", "updated_at")
     VALUES ($1::uuid, $2::uuid, $3, 'x', 'x', 'x', 'x', 'v1', now())`,
    id,
    offerId,
    snap,
  );
}

describe("socle formateurs — catalogue Postgres", () => {
  it("chaque objet déclaré existe (pg_constraint, pg_trigger, pg_indexes), rien d'intrus", async () => {
    if (!process.env["DATABASE_URL"])
      throw new Error("DATABASE_URL absent : ce test exige Postgres");
    const db = new PrismaClient();
    try {
      const presents = [
        ...(await db.$queryRawUnsafe<ObjetPresentSocle[]>(SQL_CONTRAINTES_PRESENTES_SOCLE)),
        ...(await db.$queryRawUnsafe<ObjetPresentSocle[]>(SQL_TRIGGERS_PRESENTS_SOCLE)),
        ...(await db.$queryRawUnsafe<ObjetPresentSocle[]>(SQL_INDEX_PRESENTS_SOCLE)),
      ];
      expect(fautesDeriveSocleFormateurs(presents)).toEqual([]);
    } finally {
      await db.$disconnect();
    }
  });

  it("les valeurs d'énumération ajoutées existent", async () => {
    const db = new PrismaClient();
    try {
      const lignes = await db.$queryRawUnsafe<Array<{ typname: string; enumlabel: string }>>(
        `SELECT t.typname, e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid`,
      );
      const ensemble = new Set(lignes.map((l) => `${l.typname}.${l.enumlabel}`));
      for (const v of [
        "MissionFormateurStatut.desistee",
        "SessionFormateurRetraitMotif.desistement_formateur",
        "SessionFormateurRetraitMotif.formateur_desactive",
        "TrainerDocumentType.recepisse_declaration_activite",
        "TrainerDocumentType.rib",
        "type_rendez_vous.formateur",
        "fin_collaboration_motif.changement_de_nature",
        "nature_collaboration.salarie",
        "nature_collaboration.freelance",
        "activation_validee_source.controle",
        "activation_validee_source.anterieure_au_controle",
        "origine_candidature.formulaire",
        "origine_candidature.console",
      ]) {
        expect(ensemble.has(v), v).toBe(true);
      }
    } finally {
      await db.$disconnect();
    }
  });
});

describe("socle formateurs — traduction SQL du prédicat « formateur freelance »", () => {
  it("offres : la migration dit « freelance » exactement là où le prédicat TypeScript le dit", async () => {
    await dansTransactionAnnulee(async (tx) => {
      for (const [i, o] of OFFRES.entries()) await insererOffre(tx, uuid(i, "0ffe0000"), o);
      await tx.$executeRawUnsafe(`UPDATE "job_offers" SET "nature_collaboration" = 'salarie'`);
      await tx.$executeRawUnsafe(SQL_REMPLIR_NATURE_OFFRES);
      const lues = await tx.$queryRawUnsafe<Array<{ slug: string; nature: string }>>(
        `SELECT "slug", "nature_collaboration"::text AS nature FROM "job_offers"`,
      );
      const parSlug = new Map(lues.map((l) => [l.slug, l.nature]));
      const ecarts: string[] = [];
      for (const o of OFFRES) {
        const attendu = estCandidatureFormateurFreelance(o) ? "freelance" : "salarie";
        if (parSlug.get(o.slug) !== attendu)
          ecarts.push(`${o.slug} « ${o.titleFr} » : SQL ${parSlug.get(o.slug)}, TS ${attendu}`);
      }
      expect(ecarts).toEqual([]);
      // Le corpus a les deux issues — sinon il ne compare rien.
      expect(new Set(parSlug.values())).toEqual(new Set(["salarie", "freelance"]));
    });
  });

  it("candidatures : copie de l'offre ; spontanées par le prédicat d'intitulé, sinon NULL", async () => {
    await dansTransactionAnnulee(async (tx) => {
      for (const [i, o] of OFFRES.entries()) await insererOffre(tx, uuid(i, "0ffe0000"), o);
      await tx.$executeRawUnsafe(SQL_REMPLIR_NATURE_OFFRES);
      // Une candidature par offre, dont l'intitulé figé dit « freelance » même
      // quand l'offre est salariée : la colonne suit L'OFFRE (décision du lot).
      for (const [i] of OFFRES.entries()) {
        await insererCandidature(
          tx,
          uuid(i, "ca0d0000"),
          uuid(i, "0ffe0000"),
          "Formateur freelance",
        );
      }
      for (const [i, snap] of SNAPS_SPONTANEES.entries()) {
        await insererCandidature(tx, uuid(i, "5a0d0000"), null, snap);
      }
      await tx.$executeRawUnsafe(`UPDATE "job_applications" SET "nature_collaboration" = NULL`);
      await tx.$executeRawUnsafe(SQL_REMPLIR_NATURE_CANDIDATURES_DEPUIS_OFFRE);
      await tx.$executeRawUnsafe(SQL_REMPLIR_NATURE_CANDIDATURES_SPONTANEES);
      const lues = await tx.$queryRawUnsafe<
        Array<{ id: string; snap: string; nature: string | null; offre: string | null }>
      >(
        `SELECT a."id"::text AS id, a."offer_title_snap" AS snap,
                a."nature_collaboration"::text AS nature, o."nature_collaboration"::text AS offre
         FROM "job_applications" a LEFT JOIN "job_offers" o ON o."id" = a."offer_id"`,
      );
      const ecarts: string[] = [];
      for (const l of lues) {
        const attendu =
          l.offre !== null
            ? l.offre
            : estCandidatureFormateurFreelance(l.snap)
              ? "freelance"
              : null;
        if (l.nature !== attendu)
          ecarts.push(`« ${l.snap} » : SQL ${l.nature}, attendu ${attendu}`);
      }
      expect(ecarts).toEqual([]);
      expect(lues.length).toBe(OFFRES.length + SNAPS_SPONTANEES.length);
      expect(lues.filter((l) => l.offre === null && l.nature === "freelance").length).toBe(3);
    });
  });
});

describe("socle formateurs — comportement", () => {
  const TRAINER = "77777777-0000-4000-8000-000000000001";

  async function insererTrainer(tx: Tx, id: string, email: string, actif: boolean): Promise<void> {
    await tx.$executeRawUnsafe(
      `INSERT INTO "trainers" ("id", "nom", "prenom", "email", "statut", "actif", "updated_at")
       VALUES ($1::uuid, 'Test', 'Test', $2, 'sous_traitant', $3, now())`,
      id,
      email,
      actif,
    );
  }

  it("nombre d'actifs « antérieure au contrôle » = nombre d'actifs avant", async () => {
    await dansTransactionAnnulee(async (tx) => {
      for (let i = 0; i < 5; i += 1) {
        await insererTrainer(tx, uuid(i, "77777777"), `actif-${i}@exemple.invalid`, i % 2 === 0);
      }
      const [avant] = await tx.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT count(*)::int AS n FROM "trainers" WHERE "actif" = true`,
      );
      await tx.$executeRawUnsafe(SQL_STOCK_ACTIF_ANTERIEUR_AU_CONTROLE);
      const [apres] = await tx.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT count(*)::int AS n FROM "trainers" WHERE "actif" = true
           AND "activation_validee_source" = 'anterieure_au_controle'
           AND "activation_validee_at" IS NOT NULL AND "activation_validee_par_id" IS NULL`,
      );
      const [inactifs] = await tx.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT count(*)::int AS n FROM "trainers" WHERE "actif" = false
           AND "activation_validee_source" IS NOT NULL`,
      );
      expect(avant!.n).toBeGreaterThan(0);
      expect(apres!.n).toBe(avant!.n);
      expect(inactifs!.n).toBe(0);
    });
  });

  it("activation : « contrôle » exige date ET auteur ; « antérieure » n'a pas d'auteur", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await insererTrainer(tx, TRAINER, "activation@exemple.invalid", false);
      const maj = (sql: string): [string, string] => [
        `UPDATE "trainers" SET ${sql} WHERE "id" = $1::uuid`,
        TRAINER,
      ];
      expect(
        await essayer(
          tx,
          maj(`"activation_validee_source" = 'controle', "activation_validee_at" = now()`),
        ),
      ).toMatch(/trainers_activation_coherente/);
      expect(
        await essayer(
          tx,
          maj(
            `"activation_validee_source" = 'anterieure_au_controle', "activation_validee_at" = now(), "activation_validee_par_id" = gen_random_uuid()`,
          ),
        ),
      ).toMatch(/trainers_activation_coherente/);
      expect(
        await essayer(
          tx,
          maj(
            `"activation_validee_source" = 'controle', "activation_validee_at" = now(), "activation_validee_par_id" = gen_random_uuid()`,
          ),
        ),
      ).toBe("accepte");
    });
  });

  it("IBAN : NULL ou `enc:v2:` avec son empreinte — jamais en clair, jamais en v1", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await insererTrainer(tx, TRAINER, "iban@exemple.invalid", false);
      const empreinte = "a".repeat(64);
      const maj = (iban: string | null, emp: string | null): [string, ...unknown[]] => [
        `UPDATE "trainers" SET "iban" = $2, "iban_empreinte" = $3 WHERE "id" = $1::uuid`,
        TRAINER,
        iban,
        emp,
      ];
      expect(await essayer(tx, maj("FR7630006000011234567890189", empreinte))).toMatch(
        /trainers_iban_chiffre_v2/,
      );
      expect(await essayer(tx, maj("enc:v1:00:00:00", empreinte))).toMatch(
        /trainers_iban_chiffre_v2/,
      );
      expect(await essayer(tx, maj("enc:v2:00:00:00", null))).toMatch(
        /trainers_iban_empreinte_coherente/,
      );
      expect(await essayer(tx, maj("enc:v2:00:00:00", empreinte))).toBe("accepte");
      expect(await essayer(tx, maj(null, null))).toBe("accepte");
    });
  });

  it("preuves de vigilance et vérifications du registre : ajout seul", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await insererTrainer(tx, TRAINER, "preuves@exemple.invalid", false);
      const sha = "b".repeat(64);
      await tx.$executeRawUnsafe(
        `INSERT INTO "preuves_vigilance" ("id", "trainer_id", "verifiee_at", "resultat", "fichier_sha256")
         VALUES ('88888888-0000-4000-8000-000000000001', $1::uuid, now(), 'valide', $2)`,
        TRAINER,
        sha,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "verifications_registre_sous_traitance" ("id", "trainer_id", "verifie_at", "verdict", "source", "reponse_sha256")
         VALUES ('99999999-0000-4000-8000-000000000001', $1::uuid, now(), 'vert', 'liste publique des OF', $2)`,
        TRAINER,
        sha,
      );
      for (const table of ["preuves_vigilance", "verifications_registre_sous_traitance"]) {
        expect(
          await essayer(tx, [`UPDATE "${table}" SET "created_at" = now() - interval '1 day'`]),
          table,
        ).toMatch(/ajout seul/);
        expect(await essayer(tx, [`DELETE FROM "${table}"`]), table).toMatch(/ajout seul/);
        expect(await essayer(tx, [`TRUNCATE "${table}"`]), table).toMatch(/ajout seul/);
      }
    });
  });

  it("une candidature n'ouvre qu'une fiche", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await insererCandidature(tx, "ca0d0000-0000-4000-8000-0000000000ff", null, "Formateur");
      await insererTrainer(tx, uuid(1, "77777777"), "a@exemple.invalid", false);
      await insererTrainer(tx, uuid(2, "77777777"), "b@exemple.invalid", false);
      const lier = (id: string): [string, string] => [
        `UPDATE "trainers" SET "candidature_id" = 'ca0d0000-0000-4000-8000-0000000000ff' WHERE "id" = $1::uuid`,
        id,
      ];
      expect(await essayer(tx, lier(uuid(1, "77777777")))).toBe("accepte");
      expect(await essayer(tx, lier(uuid(2, "77777777")))).toMatch(/trainers_candidature_unique/);
    });
  });
});
