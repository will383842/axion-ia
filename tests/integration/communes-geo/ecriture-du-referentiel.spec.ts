/**
 * Lot L2c — écriture du référentiel des communes CONTRE UN VRAI POSTGRES
 * (`pnpm test:integration tests/integration/communes-geo`).
 *
 *   1. l'écriture en lot insère, puis met à jour au passage suivant ;
 *   2. une commune absente du nouveau téléchargement GARDE sa ligne (jamais de
 *      suppression) ;
 *   3. la recherche par code postal passe par l'index GIN.
 *
 * Chaque cas vit dans SA transaction, ANNULÉE : la base reste vide.
 * Sans `DATABASE_URL`, ce fichier ÉCHOUE — il ne se saute pas.
 */

import { describe, expect, it } from "vitest";

import { PrismaClient } from "../../../prisma/generated/client";
import type { CommuneGeoLue } from "../../../src/server/qualiopi/formateurs-proches/communes-geo";
import { ecrireCommunes } from "../../../src/server/qualiopi/formateurs-proches/communes-geo-ecriture";

const ANNULE = new Error("ANNULE");

async function dansTransactionAnnulee(fn: (tx: PrismaClient) => Promise<void>): Promise<void> {
  if (!process.env["DATABASE_URL"]) throw new Error("DATABASE_URL absent : ce test exige Postgres");
  const db = new PrismaClient();
  try {
    await expect(
      db.$transaction(async (tx) => {
        await fn(tx as unknown as PrismaClient);
        throw ANNULE;
      }),
    ).rejects.toBe(ANNULE);
  } finally {
    await db.$disconnect();
  }
}

const commune = (codeInsee: string, nom: string, cps: string[]): CommuneGeoLue => ({
  codeInsee,
  nom,
  codesPostaux: cps,
  latitude: 45.1,
  longitude: 5.7,
  departement: codeInsee.slice(0, 2),
  population: 1000,
});

describe("ecrireCommunes (vraie base)", () => {
  it("insère, met à jour, ne supprime jamais", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const t1 = new Date("2026-10-11T08:00:00Z");
      const t2 = new Date("2026-11-11T08:00:00Z");
      expect(
        await ecrireCommunes(
          tx,
          [commune("74010", "Annecy", ["74000", "74370"]), commune("01053", "Bourg", ["01000"])],
          t1,
        ),
      ).toBe(2);
      // Passage suivant : Annecy renommée, Bourg absente du téléchargement.
      expect(await ecrireCommunes(tx, [commune("74010", "Annecy (nouveau)", ["74000"])], t2)).toBe(
        1,
      );

      const lignes = await tx.communeGeo.findMany({ orderBy: { codeInsee: "asc" } });
      expect(
        lignes.map((l) => [l.codeInsee, l.nom, l.codesPostaux, l.majAt.toISOString()]),
      ).toEqual([
        ["01053", "Bourg", ["01000"], t1.toISOString()],
        ["74010", "Annecy (nouveau)", ["74000"], t2.toISOString()],
      ]);

      const parCp = await tx.communeGeo.findMany({ where: { codesPostaux: { has: "01000" } } });
      expect(parCp.map((c) => c.codeInsee)).toEqual(["01053"]);
    });
  });

  it("l'index GIN des codes postaux est présent", async () => {
    await dansTransactionAnnulee(async (tx) => {
      const rows = await tx.$queryRawUnsafe<Array<{ indexdef: string }>>(
        "SELECT indexdef FROM pg_indexes WHERE tablename = 'communes_geo' AND indexname = 'communes_geo_codes_postaux_idx'",
      );
      expect(rows[0]?.indexdef).toMatch(/USING gin/i);
    });
  });
});
