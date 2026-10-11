/**
 * Écriture en lot du référentiel des communes (lot L2c).
 *
 * 🔴 INSERTION OU MISE À JOUR, JAMAIS DE SUPPRESSION : une commune absente du
 * dernier téléchargement (fusion de communes) garde sa ligne et son `majAt`.
 *
 * Un `INSERT … ON CONFLICT` par paquet de 1 000, à partir d'un JSON : 35
 * requêtes pour toute la France, au lieu de 35 000 `upsert`. Sans `server-only` :
 * appelé par le worker.
 */

import type { CommuneGeoLue } from "./communes-geo";

export const TAILLE_PAQUET_COMMUNES = 1_000;

/** Le strict nécessaire d'un client Prisma (ou d'une transaction). */
export interface ExecuteurSql {
  $executeRawUnsafe(sql: string, ...valeurs: unknown[]): Promise<number>;
}

const SQL_ECRIRE_PAQUET = `
INSERT INTO "communes_geo"
  ("code_insee", "nom", "codes_postaux", "latitude", "longitude", "departement", "population", "maj_at")
SELECT x."codeInsee", x."nom", x."codesPostaux", x."latitude", x."longitude", x."departement", x."population", $2::timestamp(3)
FROM jsonb_to_recordset($1::jsonb) AS x(
  "codeInsee" text, "nom" text, "codesPostaux" text[], "latitude" double precision,
  "longitude" double precision, "departement" text, "population" integer
)
ON CONFLICT ("code_insee") DO UPDATE SET
  "nom" = EXCLUDED."nom",
  "codes_postaux" = EXCLUDED."codes_postaux",
  "latitude" = EXCLUDED."latitude",
  "longitude" = EXCLUDED."longitude",
  "departement" = EXCLUDED."departement",
  "population" = EXCLUDED."population",
  "maj_at" = EXCLUDED."maj_at"`;

/** Écrit toutes les communes ; rend le nombre de lignes insérées ou mises à jour. */
export async function ecrireCommunes(
  db: ExecuteurSql,
  communes: ReadonlyArray<CommuneGeoLue>,
  maintenant: Date,
): Promise<number> {
  // `timestamp(3)` sans fuseau : Prisma range les dates en UTC.
  const horodatage = maintenant.toISOString().replace("T", " ").replace("Z", "");
  let total = 0;
  for (let i = 0; i < communes.length; i += TAILLE_PAQUET_COMMUNES) {
    const paquet = communes.slice(i, i + TAILLE_PAQUET_COMMUNES);
    total += await db.$executeRawUnsafe(SQL_ECRIRE_PAQUET, JSON.stringify(paquet), horodatage);
  }
  return total;
}
