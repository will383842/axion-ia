/**
 * ADR 0063 — LES DOCUMENTS DU PROJET CONTRE UN VRAI POSTGRES (Gate D,
 * `pnpm test:integration tests/integration/documents-projet`).
 *
 * Les 33 cas joués par l'architecte (A02) sur PostgreSQL 16 le 01/10, repris
 * tels quels (plan §9.2), puis la garde de dérive lue dans `pg_constraint` /
 * `pg_trigger`. Chaque cas vit dans SA transaction, ANNULÉE : la base reste vide.
 *
 * Les triggers de contrainte DIFFÉRÉS (contenu conforme, contenu d'un fichier)
 * ne se déclenchent qu'au COMMIT — qui n'arrive jamais ici : `SET CONSTRAINTS
 * ALL IMMEDIATE` les fait jouer dans la transaction. Un refus attendu en milieu
 * de cas passe par un SAVEPOINT, pour que la suite du cas reste jouable.
 *
 * Sans `DATABASE_URL`, ce fichier ÉCHOUE — il ne se saute pas : un test qui
 * s'efface faute de banc est un vert qui ne regarde rien.
 */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { PrismaClient } from "../../../prisma/generated/client";
import {
  SQL_CONTRAINTES_PRESENTES,
  SQL_TRIGGERS_PRESENTS,
  fautesDeriveDocumentsProjet,
  type ObjetPresent,
} from "../../../src/features/dossier-client/documents/objets-sql";

type Tx = {
  $executeRawUnsafe: (sql: string, ...v: unknown[]) => Promise<number>;
  $queryRawUnsafe: <T>(sql: string, ...v: unknown[]) => Promise<T>;
};

const CLIENT_A = "aaaaaaaa-0000-4000-8000-00000000000a";
const CLIENT_B = "bbbbbbbb-0000-4000-8000-00000000000b";
const PROJET_A = "aaaaaaaa-1111-4111-8111-00000000000a";
const PROJET_B = "bbbbbbbb-1111-4111-8111-00000000000b";
const DOC = "dddddddd-0000-4000-8000-000000000001";
const PDF = Buffer.from("%PDF-1.7 contenu de test");
const SHA = createHash("sha256").update(PDF).digest("hex");

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

/** Joue `sqls` derrière un SAVEPOINT : « accepte », ou le message d'erreur (et l'on revient au point). */
async function essayer(tx: Tx, ...sqls: Array<[string, ...unknown[]]>): Promise<string> {
  await tx.$executeRawUnsafe("SAVEPOINT essai");
  try {
    for (const [sql, ...v] of sqls) await tx.$executeRawUnsafe(sql, ...v);
    await tx.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
    await tx.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");
    await tx.$executeRawUnsafe("RELEASE SAVEPOINT essai");
    return "accepte";
  } catch (e) {
    await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT essai");
    // Les contraintes différées le redeviennent pour le cas suivant.
    await tx.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");
    return e instanceof Error ? e.message : String(e);
  }
}

async function scene(tx: Tx): Promise<void> {
  for (const [id, numero] of [
    [CLIENT_A, "TEST-DOC-CLI-A"],
    [CLIENT_B, "TEST-DOC-CLI-B"],
  ] as const) {
    await tx.$executeRawUnsafe(
      `INSERT INTO "clients" ("id", "numero", "raison_sociale", "updated_at")
       VALUES ($1::uuid, $2, 'Client de test', now())`,
      id,
      numero,
    );
  }
  for (const [id, client, numero] of [
    [PROJET_A, CLIENT_A, "TEST-DOC-PRJ-A"],
    [PROJET_B, CLIENT_B, "TEST-DOC-PRJ-B"],
  ] as const) {
    await tx.$executeRawUnsafe(
      `INSERT INTO "projets" ("id", "numero", "client_id", "titre", "updated_at")
       VALUES ($1::uuid, $2, $3::uuid, 'Projet de test', now())`,
      id,
      numero,
      client,
    );
  }
}

interface Lien {
  id?: string;
  client?: string;
  projet?: string;
  cote?: "interne" | "envoye_au_client";
  envoye?: string | null;
  lien?: string;
}

function sqlLien(o: Lien = {}): [string, ...unknown[]] {
  const cote = o.cote ?? "interne";
  const envoye = o.envoye !== undefined ? o.envoye : cote === "interne" ? null : "2026-09-30";
  return [
    `INSERT INTO "documents_projet" ("id", "client_id", "projet_id", "cote", "nature", "titre", "envoye_le", "lien_url")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::cote_document_projet, 'page_en_ligne', 'Titre', $5::date, $6)`,
    o.id ?? DOC,
    o.client ?? CLIENT_A,
    o.projet ?? PROJET_A,
    cote,
    envoye,
    o.lien ?? "https://axion-ia.com/x",
  ];
}

interface Fichier {
  taille?: number;
  sha?: string;
  verdict?: "sain" | "non_analyse";
  lien?: string | null;
}

function sqlFichier(o: Fichier = {}): [string, ...unknown[]] {
  const verdict = o.verdict ?? "sain";
  return [
    `INSERT INTO "documents_projet" ("id", "client_id", "projet_id", "cote", "nature", "titre",
       "lien_url", "fichier_nom", "fichier_format", "fichier_taille_octets", "fichier_sha256",
       "analyse_antivirus", "analyse_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, 'interne', 'pdf', 'Titre', $4, 'piece.pdf', 'pdf', $5, $6,
       $7::analyse_antivirus_document, CASE WHEN $7 = 'non_analyse' THEN NULL ELSE now() END)`,
    DOC,
    CLIENT_A,
    PROJET_A,
    o.lien ?? null,
    o.taille ?? PDF.length,
    o.sha ?? SHA,
    verdict,
  ];
}

const sqlContenu = (hex: string = PDF.toString("hex")): [string, ...unknown[]] => [
  `INSERT INTO "documents_projet_contenus" ("document_id", "octets") VALUES ($1::uuid, decode($2, 'hex'))`,
  DOC,
  hex,
];

describe("documents_projet contre un vrai Postgres (Gate D)", () => {
  it("1. un lien https est accepté", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      expect(await essayer(tx, sqlLien())).toBe("accepte");
    });
  });

  it("2. un fichier conforme (contenu, taille, SHA-256) est accepté", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      expect(await essayer(tx, sqlFichier(), sqlContenu())).toBe("accepte");
    });
  });

  it("3. le projet d'un AUTRE client est refusé (clé composée)", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      expect(await essayer(tx, sqlLien({ client: CLIENT_A, projet: PROJET_B }))).toMatch(
        /documents_projet_projet_meme_client/,
      );
    });
  });

  it.each([
    ["4. http:", "http://axion-ia.com/x"],
    ["5. javascript:", "javascript:alert(1)"],
    ["6. identifiants", "https://u:p@axion-ia.com/x"],
  ])("%s est refusé", async (_cas, lien) => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      expect(await essayer(tx, sqlLien({ lien }))).toMatch(/documents_projet_lien_https/);
    });
  });

  it("7. ni lien ni fichier est refusé", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      const [sql, ...v] = sqlLien();
      expect(await essayer(tx, [sql.replace("$6)", "NULL)"), ...v.slice(0, 5)])).toMatch(
        /documents_projet_lien_ou_fichier/,
      );
    });
  });

  it("8. lien ET fichier est refusé", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      expect(await essayer(tx, sqlFichier({ lien: "https://axion-ia.com/x" }))).toMatch(
        /documents_projet_lien_ou_fichier/,
      );
    });
  });

  it("9. un fichier sans contenu est refusé au COMMIT (AXD03)", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      expect(await essayer(tx, sqlFichier())).toMatch(/un fichier sans contenu/);
    });
  });

  it("10. une empreinte fausse est refusée (AXD03)", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      expect(await essayer(tx, sqlFichier({ sha: "0".repeat(64) }), sqlContenu())).toMatch(
        /ne correspond pas/,
      );
    });
  });

  it("11. 15 Mo + 1 octet est refusé (description et octets)", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      expect(await essayer(tx, sqlFichier({ taille: 15_728_641 }))).toMatch(
        /documents_projet_fichier_taille/,
      );
      expect(
        await essayer(tx, sqlFichier(), [
          `INSERT INTO "documents_projet_contenus" ("document_id", "octets")
             VALUES ($1::uuid, decode(repeat('00', 15728641), 'hex'))`,
          DOC,
        ]),
      ).toMatch(/documents_projet_contenus_taille/);
    });
  });

  it("12. un contenu sur un LIEN est refusé", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      expect(await essayer(tx, sqlLien(), sqlContenu())).toMatch(
        /un lien n'a pas de contenu|appartient à un document fichier/,
      );
    });
  });

  it("13. « envoyé au client » sans date est refusé", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      expect(await essayer(tx, sqlLien({ cote: "envoye_au_client", envoye: null }))).toMatch(
        /documents_projet_date_envoi/,
      );
    });
  });

  it("14-17. DELETE et TRUNCATE d'un document, DELETE et UPDATE de ses octets sont refusés", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      expect(await essayer(tx, sqlFichier(), sqlContenu())).toBe("accepte");
      expect(await essayer(tx, [`DELETE FROM "documents_projet"`])).toMatch(/ne se supprime pas/);
      expect(await essayer(tx, [`DELETE FROM "documents_projet_contenus"`])).toMatch(
        /ne se modifie ni ne se supprime/,
      );
      expect(
        await essayer(tx, [
          `UPDATE "documents_projet_contenus" SET "octets" = decode('00', 'hex')`,
        ]),
      ).toMatch(/ne se modifie ni ne se supprime/);
      expect(await essayer(tx, [`TRUNCATE "documents_projet_contenus"`])).toMatch(
        /TRUNCATE refusé/,
      );
      expect(await essayer(tx, [`TRUNCATE "documents_projet" CASCADE`])).not.toBe("accepte");
    });
  });

  it("18-19. réécrire le titre, ou déplacer vers le projet d'un autre client, est refusé", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      expect(await essayer(tx, sqlLien())).toBe("accepte");
      expect(await essayer(tx, [`UPDATE "documents_projet" SET "titre" = 'Autre'`])).toMatch(
        /ne se réécrit pas/,
      );
      expect(
        await essayer(tx, [
          `UPDATE "documents_projet" SET "projet_id" = $1::uuid, "client_id" = $2::uuid`,
          PROJET_B,
          CLIENT_B,
        ]),
      ).not.toBe("accepte");
    });
  });

  it("20-21. archiver puis réafficher sont acceptés", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      expect(await essayer(tx, sqlLien())).toBe("accepte");
      expect(
        await essayer(tx, [
          `UPDATE "documents_projet" SET "archive_le" = now(), "archive_par_id" = gen_random_uuid()`,
        ]),
      ).toBe("accepte");
      expect(
        await essayer(tx, [
          `UPDATE "documents_projet" SET "archive_le" = NULL, "archive_par_id" = NULL`,
        ]),
      ).toBe("accepte");
    });
  });

  it("22. un verdict « sain » ne devient pas « infecté »", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      expect(await essayer(tx, sqlFichier(), sqlContenu())).toBe("accepte");
      expect(
        await essayer(tx, [
          `UPDATE "documents_projet" SET "analyse_antivirus" = 'infecte', "analyse_signature" = 'x', "archive_le" = now()`,
        ]),
      ).toMatch(/verdict antivirus rendu ne change plus/);
    });
  });

  it("23. fusion de fiches : le projet change de client, le document SUIT (CASCADE)", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      expect(await essayer(tx, sqlLien())).toBe("accepte");
      expect(
        await essayer(tx, [
          `UPDATE "projets" SET "client_id" = $1::uuid WHERE "id" = $2::uuid`,
          CLIENT_B,
          PROJET_A,
        ]),
      ).toBe("accepte");
      const [d] = await tx.$queryRawUnsafe<Array<{ client_id: string }>>(
        `SELECT "client_id"::text FROM "documents_projet" WHERE "id" = $1::uuid`,
        DOC,
      );
      expect(d?.client_id).toBe(CLIENT_B);
    });
  });

  it("24. sous le drapeau d'effacement RGPD, la suppression est admise", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      expect(await essayer(tx, sqlFichier(), sqlContenu())).toBe("accepte");
      await tx.$executeRawUnsafe(`SELECT set_config('axion.effacement_rgpd', 'on', true)`);
      expect(
        await essayer(
          tx,
          [`DELETE FROM "documents_projet_contenus"`],
          [`DELETE FROM "documents_projet"`],
        ),
      ).toBe("accepte");
    });
  });

  it("25. un projet qui porte des documents ne se supprime pas", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      expect(await essayer(tx, sqlLien())).toBe("accepte");
      expect(await essayer(tx, [`DELETE FROM "projets" WHERE "id" = $1::uuid`, PROJET_A])).not.toBe(
        "accepte",
      );
    });
  });

  it("26-29. une ouverture s'écrit ; elle ne se modifie, ne se supprime (même sous drapeau) ni ne se vide", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const ouvrir: [string, ...unknown[]] = [
        `INSERT INTO "documents_projet_ouvertures" ("id", "document_id", "origine")
         VALUES (gen_random_uuid(), $1::uuid, 'navigateur')`,
        DOC,
      ];
      expect(await essayer(tx, ouvrir)).toBe("accepte");
      expect(
        await essayer(tx, [
          `UPDATE "documents_projet_ouvertures" SET "origine" = 'apercu_automatique'`,
        ]),
      ).toMatch(/ajout seul/);
      expect(await essayer(tx, [`TRUNCATE "documents_projet_ouvertures"`])).toMatch(
        /TRUNCATE refusé/,
      );
      await tx.$executeRawUnsafe(`SELECT set_config('axion.effacement_rgpd', 'on', true)`);
      expect(await essayer(tx, [`DELETE FROM "documents_projet_ouvertures"`])).toMatch(
        /ajout seul/,
      );
    });
  });

  it("30-33. non analysé accepté ; infecté exige l'archivage ; un infecté ne se réaffiche pas", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      expect(await essayer(tx, sqlFichier({ verdict: "non_analyse" }), sqlContenu())).toBe(
        "accepte",
      );
      expect(
        await essayer(tx, [
          `UPDATE "documents_projet" SET "analyse_antivirus" = 'infecte', "analyse_le" = now(), "analyse_signature" = 'Eicar'`,
        ]),
      ).toMatch(/documents_projet_infecte_archive/);
      expect(
        await essayer(tx, [
          `UPDATE "documents_projet" SET "analyse_antivirus" = 'infecte', "analyse_le" = now(), "analyse_signature" = 'Eicar', "archive_le" = now()`,
        ]),
      ).toBe("accepte");
      expect(await essayer(tx, [`UPDATE "documents_projet" SET "archive_le" = NULL`])).toMatch(
        /documents_projet_infecte_archive/,
      );
    });
  });

  it("35-39. chaque CHECK restant refuse sa faute : titre vide, empreinte, nom de fichier, auteur sans archivage, verdict non daté", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      const [lien, ...vLien] = sqlLien();
      expect(await essayer(tx, [lien.replace("'Titre'", "'   '"), ...vLien])).toMatch(
        /documents_projet_titre_non_vide/,
      );
      expect(await essayer(tx, sqlFichier({ sha: "Z".repeat(64) }), sqlContenu())).toMatch(
        /documents_projet_fichier_sha256/,
      );
      const [fichier, ...vFichier] = sqlFichier();
      expect(
        await essayer(
          tx,
          [fichier.replace("'piece.pdf'", "'dossier/piece.pdf'"), ...vFichier],
          sqlContenu(),
        ),
      ).toMatch(/documents_projet_fichier_nom/);
      expect(
        await essayer(
          tx,
          [
            fichier.replace("CASE WHEN $7 = 'non_analyse' THEN NULL ELSE now() END", "NULL"),
            ...vFichier,
          ],
          sqlContenu(),
        ),
      ).toMatch(/documents_projet_verdict_coherent/);
      expect(await essayer(tx, sqlLien())).toBe("accepte");
      expect(
        await essayer(tx, [`UPDATE "documents_projet" SET "archive_par_id" = gen_random_uuid()`]),
      ).toMatch(/documents_projet_archive_coherent/);
    });
  });

  it("40. TRUNCATE de documents_projet refusé par SON trigger (celui des contenus retiré dans la transaction)", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      expect(await essayer(tx, sqlLien())).toBe("accepte");
      // Le trigger des contenus retiré : seul `documents_projet_pas_de_truncate` peut refuser.
      await tx.$executeRawUnsafe(
        `DROP TRIGGER "documents_projet_contenus_pas_de_truncate" ON "documents_projet_contenus"`,
      );
      expect(
        await essayer(tx, [`TRUNCATE "documents_projet", "documents_projet_contenus"`]),
      ).toMatch(/documents_projet : TRUNCATE refusé/);
    });
  });

  it("34. purge du pilote : sans drapeau le projet ne part pas ; sous le drapeau, octets puis documents puis projet partent, aucun octet ne reste", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await scene(tx);
      expect(await essayer(tx, sqlFichier(), sqlContenu())).toBe("accepte");
      // L'ordre de `supprimerDonneesPilote` (src/lib/rgpd-erase.ts), SANS le drapeau : refusé.
      const purge: Array<[string, ...unknown[]]> = [
        [
          `DELETE FROM "documents_projet_contenus" WHERE "document_id" IN
             (SELECT "id" FROM "documents_projet" WHERE "projet_id" = $1::uuid)`,
          PROJET_A,
        ],
        [`DELETE FROM "documents_projet" WHERE "projet_id" = $1::uuid`, PROJET_A],
        [`DELETE FROM "projets" WHERE "id" = $1::uuid`, PROJET_A],
      ];
      expect(await essayer(tx, ...purge)).not.toBe("accepte");
      expect(await essayer(tx, [`DELETE FROM "projets" WHERE "id" = $1::uuid`, PROJET_A])).not.toBe(
        "accepte",
      );
      // Sous le drapeau (posé par `executerSousDrapeauEffacement`), dans la même transaction.
      await tx.$executeRawUnsafe(`SELECT set_config('axion.effacement_rgpd', 'on', true)`);
      expect(await essayer(tx, ...purge)).toBe("accepte");
      const [n] = await tx.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT (SELECT count(*) FROM "documents_projet_contenus")::int
              + (SELECT count(*) FROM "documents_projet")::int AS n`,
      );
      expect(n?.n).toBe(0);
    });
  });

  it("la garde de dérive, lue dans le catalogue, est vide — et rougit sans un trigger", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const lire = async (): Promise<ObjetPresent[]> => [
        ...(await tx.$queryRawUnsafe<ObjetPresent[]>(SQL_TRIGGERS_PRESENTS)),
        ...(await tx.$queryRawUnsafe<ObjetPresent[]>(SQL_CONTRAINTES_PRESENTES)),
      ];
      expect(fautesDeriveDocumentsProjet(await lire())).toEqual([]);
      await tx.$executeRawUnsafe(`DROP TRIGGER "documents_projet_immuable" ON "documents_projet"`);
      expect(fautesDeriveDocumentsProjet(await lire()).join("\n")).toMatch(
        /ABSENT.*documents_projet_immuable/,
      );
    });
  });
});
