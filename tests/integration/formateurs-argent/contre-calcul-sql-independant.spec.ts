/**
 * L15b — « contre-calcul SQL = fonctions pures » (Fini du lot, 08 §11.1).
 *
 * Le bloc SQL de la relecture argent (§2.1) encode les règles À LA MAIN, sans lire
 * aucune table du domaine. On l'exécute sur un vrai Postgres et on compare, au
 * centime et au jour, à ce que rendent les fonctions pures du paiement par
 * mission. Variantes retenues : celles du contrat-cadre v3 (S03 par les feuilles,
 * S08 et S27 sur les journées annulées, hors forfait).
 *
 * Sans `DATABASE_URL`, ce fichier ÉCHOUE — il ne se saute pas.
 */

import { describe, expect, it } from "vitest";

import { PrismaClient } from "../../../prisma/generated/client";
import {
  calculerReleveDuMois,
  indemniteAnnulation,
  totaliser,
} from "../../../src/server/qualiopi/formateurs-independants/argent/calcul-mission";
import {
  dateCibleVirement,
  echeanceLegale,
} from "../../../src/server/qualiopi/formateurs-independants/argent/dates";
import {
  demiJourneesSignees,
  parMoisCivil,
} from "../../../src/server/qualiopi/remuneration/heures-animees";

/** Copie du bloc de la relecture argent, §2.1 (unité : centimes). */
const SQL_RELECTURE = `
WITH scen(code, regime, demi_jours, forfait_cents, indemnite_base_cents, dernier_jour) AS (VALUES
  ('S01',    'franchise_293b', 2,     0,     0, DATE '2026-11-05'),
  ('S02',    'franchise_293b', 1,     0,     0, DATE '2026-11-05'),
  ('S03',    'franchise_293b', 2,     0,     0, DATE '2026-11-05'),
  ('S04',    'franchise_293b', 2,     0,     0, DATE '2026-11-05'),
  ('S07-10', 'franchise_293b', 2,     0,     0, DATE '2026-10-26'),
  ('S07-11', 'franchise_293b', 4,     0,     0, DATE '2026-11-23'),
  ('S07-12', 'franchise_293b', 4,     0,     0, DATE '2026-12-14'),
  ('S08',    'franchise_293b', 0,     0, 70000, DATE '2026-11-10'),
  ('S10',    'assujetti_20',   4, 24000,     0, DATE '2026-11-13'),
  ('S13',    'assujetti_20',   6, 14199,     0, DATE '2026-11-05'),
  ('S27',    'franchise_293b', 2,     0, 70000, DATE '2026-11-12')
)
SELECT code,
       ht::int AS ht,
       (CASE WHEN regime = 'assujetti_20' THEN ROUND(ht * 20 / 100.0)::int ELSE 0 END) AS tva,
       (ht + CASE WHEN regime = 'assujetti_20' THEN ROUND(ht * 20 / 100.0)::int ELSE 0 END)::int AS ttc,
       to_char(dernier_jour + 30, 'YYYY-MM-DD') AS echeance,
       to_char((dernier_jour + 30) - CASE EXTRACT(ISODOW FROM dernier_jour + 30)
                 WHEN 6 THEN 1 WHEN 7 THEN 2 ELSE 0 END, 'YYYY-MM-DD') AS virement
FROM (SELECT *, demi_jours * 17500 + forfait_cents + indemnite_base_cents / 2 AS ht FROM scen) s
ORDER BY code`;

type LigneSql = {
  code: string;
  ht: number;
  tva: number;
  ttc: number;
  echeance: string;
  virement: string;
};

const C = {
  tarifJourneeHtCents: 35_000,
  forfaitDeplacementParJourHtCents: null,
  regimeTva: "franchise_293b" as const,
};

function releve(
  jours: string[],
  demi: "journee" | "matin",
  c: Parameters<typeof calculerReleveDuMois>[1] = C,
) {
  const [m] = parMoisCivil(demiJourneesSignees(jours.map((jour) => ({ jour, demiJournee: demi }))));
  return calculerReleveDuMois(m!, c);
}

function domaine(): LigneSql[] {
  const r = (
    code: string,
    x: {
      totalHtCents: number;
      tvaCents: number;
      totalTtcCents: number;
      echeance: string;
      dateCible: string;
    },
  ) => ({
    code,
    ht: x.totalHtCents,
    tva: x.tvaCents,
    ttc: x.totalTtcCents,
    echeance: x.echeance,
    virement: x.dateCible,
  });
  const s07 = parMoisCivil(
    demiJourneesSignees(
      ["2026-10-26", "2026-11-09", "2026-11-23", "2026-12-07", "2026-12-14"].map((jour) => ({
        jour,
        demiJournee: "journee" as const,
      })),
    ),
  ).map((m) => calculerReleveDuMois(m, C));
  const s08 = indemniteAnnulation({
    annuleeA: new Date("2026-11-10T08:00:00Z"),
    debutPremiereAnnulee: new Date("2026-11-12T08:00:00Z"),
    demiJourneesAnnulees: 4,
    tarifJourneeHtCents: 35_000,
    accepteeAvant: true,
    parAxion: true,
  });
  const s27fait = releve(["2026-11-12"], "journee");
  const s27ind = indemniteAnnulation({
    annuleeA: new Date("2026-11-11T08:00:00Z"),
    debutPremiereAnnulee: new Date("2026-11-13T08:00:00Z"),
    demiJourneesAnnulees: 4,
    tarifJourneeHtCents: 35_000,
    accepteeAvant: true,
    parAxion: true,
  });
  const s27 = totaliser(
    [{ montantHtCents: s27fait.totalHtCents }, { montantHtCents: s27ind.montantHtCents }],
    "franchise_293b",
  );
  return [
    r("S01", releve(["2026-11-05"], "journee")),
    r("S02", releve(["2026-11-05"], "matin")),
    r("S03", releve(["2026-11-05"], "journee")),
    r("S04", releve(["2026-11-05"], "journee")),
    r("S07-10", s07[0]!),
    r("S07-11", s07[1]!),
    r("S07-12", s07[2]!),
    {
      code: "S08",
      ht: s08.montantHtCents,
      tva: 0,
      ttc: s08.montantHtCents,
      echeance: s08.echeance,
      virement: s08.dateCible,
    },
    r(
      "S10",
      releve(["2026-11-12", "2026-11-13"], "journee", {
        tarifJourneeHtCents: 35_000,
        forfaitDeplacementParJourHtCents: 12_000,
        regimeTva: "assujetti_20",
      }),
    ),
    r(
      "S13",
      releve(["2026-11-03", "2026-11-04", "2026-11-05"], "journee", {
        tarifJourneeHtCents: 35_000,
        forfaitDeplacementParJourHtCents: 4_733,
        regimeTva: "assujetti_20",
      }),
    ),
    {
      code: "S27",
      ht: s27.totalHtCents,
      tva: s27.tvaCents,
      ttc: s27.totalTtcCents,
      echeance: echeanceLegale("2026-11-12"),
      virement: dateCibleVirement(echeanceLegale("2026-11-12")),
    },
  ].sort((a, b) => (a.code < b.code ? -1 : 1));
}

describe("contre-calcul SQL indépendant = fonctions pures", () => {
  it("mêmes montants (HT, TVA, TTC) et mêmes dates (échéance, virement au plus tard), au centime", async () => {
    if (!process.env["DATABASE_URL"])
      throw new Error("DATABASE_URL absent : ce test exige Postgres");
    const db = new PrismaClient();
    try {
      const sql = await db.$queryRawUnsafe<LigneSql[]>(SQL_RELECTURE);
      expect(domaine()).toEqual(
        sql.map((l) => ({ ...l, ht: Number(l.ht), tva: Number(l.tva), ttc: Number(l.ttc) })),
      );
    } finally {
      await db.$disconnect();
    }
  });
});
