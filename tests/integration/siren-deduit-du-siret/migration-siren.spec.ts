/**
 * Lot A9 — la migration `siren_deduit_du_siret` contre un VRAI Postgres.
 *
 * Le témoin statique (`tests/unit/ci/le-siren-des-fiches-existantes-est-tire-du-siret.spec.ts`)
 * lit le fichier ; il ne peut pas prouver ce que le SQL ÉCRIT. Or `sirenDuClient` fait confiance
 * à la colonne `siren` : tout SIREN recopié d'un SIRET invalide passerait ensuite pour un SIREN
 * saisi valide (relecture A09 : `00000000000000`, valeur trouvée en production sur AXI-CLI-002,
 * donnait `000000000`).
 *
 * On joue donc le fichier de migration TEL QUEL sur une table temporaire `clients` (elle masque
 * la vraie table dans la transaction, `pg_temp` passant en tête du `search_path`), et on compare
 * chaque ligne à la règle TypeScript `sirenDuClient`. La transaction est annulée : aucune ligne
 * ne reste.
 *
 * Joué par Gate D (`ci.yml`). Sans `DATABASE_URL`, ce fichier ÉCHOUE — il ne se saute pas.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { PrismaClient } from "../../../prisma/generated/client";
import { sirenDuClient } from "../../../src/lib/siret";

const URL_BASE = process.env.DATABASE_URL;
if (!URL_BASE || URL_BASE.includes("stub.invalid")) {
  throw new Error(
    "[siren-deduit-du-siret] DATABASE_URL absente ou stub : ce test exige un vrai Postgres (Gate D).",
  );
}

const RACINE = join(process.cwd(), "prisma", "migrations");
const NOM = readdirSync(RACINE).find((n) => n.endsWith("_siren_deduit_du_siret"));
const SQL = readFileSync(join(RACINE, NOM!, "migration.sql"), "utf8");

/** [id, siret, siren avant, siren attendu après]. */
const FICHES: ReadonlyArray<[string, string | null, string | null, string | null]> = [
  ["valide", "73282932000074", null, "732829320"],
  ["remplissage-zeros", "00000000000000", null, null],
  ["remplissage-uns", "11111111111111", null, null],
  ["cle-fausse-nic", "73282932000075", null, null],
  ["cle-fausse-siren", "73282932100074", null, null],
  ["la-poste", "35600000000048", null, "356000000"],
  ["siren-deja-saisi", "73282932000074", "542107651", "542107651"],
  ["siret-court", "1234", null, null],
  ["sans-siret", null, null, null],
];

const prisma = new PrismaClient({ datasources: { db: { url: URL_BASE } } });
afterAll(() => prisma.$disconnect());

class Annulation extends Error {}

async function jouer(passes: number): Promise<Map<string, string | null>> {
  let resultat = new Map<string, string | null>();
  await prisma
    .$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `CREATE TEMP TABLE "clients" (id text PRIMARY KEY, siren varchar(9), siret varchar(14)) ON COMMIT DROP`,
      );
      for (const [id, siret, siren] of FICHES) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "clients" (id, siret, siren) VALUES ($1, $2, $3)`,
          id,
          siret,
          siren,
        );
      }
      for (let i = 0; i < passes; i++) await tx.$executeRawUnsafe(SQL);
      const lignes = await tx.$queryRawUnsafe<Array<{ id: string; siren: string | null }>>(
        `SELECT id, siren FROM "clients"`,
      );
      resultat = new Map(lignes.map((l) => [l.id, l.siren]));
      throw new Annulation();
    })
    .catch((e: unknown) => {
      if (!(e instanceof Annulation)) throw e;
    });
  return resultat;
}

describe("migration « SIREN déduit du SIRET » — ce qu'elle écrit vraiment", () => {
  it("n'écrit un SIREN que d'un SIRET valide, et jamais par-dessus un SIREN saisi", async () => {
    const apres = await jouer(1);
    for (const [id, , , attendu] of FICHES) expect([id, apres.get(id)]).toEqual([id, attendu]);
  });

  it("concorde avec la règle de lecture `sirenDuClient`, fiche par fiche", async () => {
    const apres = await jouer(1);
    for (const [id, siret, siren] of FICHES) {
      expect([id, apres.get(id) ?? null]).toEqual([id, sirenDuClient({ siren, siret })]);
    }
  });

  it("est idempotente : une seconde passe ne change rien", async () => {
    expect(await jouer(2)).toEqual(await jouer(1));
  });
});
