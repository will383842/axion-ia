/**
 * ⛔ TOUT OBJET SQL BRUT EST DANS SA MIGRATION — ET RÉCIPROQUEMENT
 * (chantier visio, PR 2 ; plan §3.3 g).
 *
 * `prisma/objets-sql-bruts.ts` est la liste unique des index partiels, CHECK,
 * clés composées et triggers du chantier. Cette garde vérifie, sans base :
 *   · que chaque objet déclaré est CRÉÉ par la migration du chantier, sur la
 *     bonne table ;
 *   · que chaque objet créé en SQL brut par cette migration est DÉCLARÉ (un
 *     objet non déclaré échapperait à la garde de dérive de Gate D).
 *
 * La vérification sur une vraie base (l'objet EXISTE après `migrate deploy`)
 * est `scripts/ci/garde-derive-sql-brut.ts`, en Gate D.
 *
 * Mutation qui fait rougir : retirer la ligne `CREATE UNIQUE INDEX
 * "comptes_rendus_un_valide"` de la migration, ou retirer sa déclaration.
 */

import { describe, expect, it } from "vitest";
import {
  MIGRATION_VISIO,
  OBJETS_SQL_BRUTS,
  type ObjetSqlBrut,
} from "../../../prisma/objets-sql-bruts";
import { lire } from "./sources-du-circuit-visio";

const SQL = lire(`prisma/migrations/${MIGRATION_VISIO}/migration.sql`);

/** La partie SQL brut (après le marqueur), commentaires retirés. */
function partieBrute(sql: string): string {
  const i = sql.indexOf("═══ 2. SQL BRUT");
  if (i < 0) throw new Error("marqueur « 2. SQL BRUT » absent de la migration");
  return sql
    .slice(i)
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
}

/** Les objets que le SQL brut crée, lus dans le texte. */
function objetsCrees(sql: string): ObjetSqlBrut[] {
  const brut = partieBrute(sql);
  const out: ObjetSqlBrut[] = [];
  for (const m of brut.matchAll(/CREATE (?:UNIQUE )?INDEX "([^"]+)" ON "([^"]+)"/g)) {
    out.push({ nom: m[1] as string, type: "index", table: m[2] as string, role: "" });
  }
  for (const m of brut.matchAll(
    /ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)" (CHECK|FOREIGN KEY)/g,
  )) {
    out.push({
      nom: m[2] as string,
      type: m[3] === "CHECK" ? "check" : "fk",
      table: m[1] as string,
      role: "",
    });
  }
  for (const m of brut.matchAll(
    /CREATE (?:CONSTRAINT )?TRIGGER "([^"]+)"[\s\S]*?\bON "([^"]+)"/g,
  )) {
    out.push({ nom: m[1] as string, type: "trigger", table: m[2] as string, role: "" });
  }
  return out;
}

const cle = (o: Pick<ObjetSqlBrut, "nom" | "type" | "table">): string =>
  `${o.type}:${o.table}.${o.nom}`;

describe("tout objet SQL brut est dans une migration", () => {
  const crees = objetsCrees(SQL);

  it("la lecture de la migration trouve bien des objets de chaque type", () => {
    for (const type of ["index", "check", "fk", "trigger"] as const) {
      expect(crees.filter((o) => o.type === type).length, type).toBeGreaterThan(0);
    }
  });

  it("chaque objet déclaré est créé par la migration, sur sa table", () => {
    const presents = new Set(crees.map(cle));
    const manquants = OBJETS_SQL_BRUTS.filter((o) => !presents.has(cle(o))).map(cle);
    expect(
      manquants,
      "déclarés dans prisma/objets-sql-bruts.ts, absents de la migration :",
    ).toEqual([]);
  });

  it("chaque objet créé en SQL brut est déclaré", () => {
    const declares = new Set(OBJETS_SQL_BRUTS.map(cle));
    const orphelins = crees.filter((o) => !declares.has(cle(o))).map(cle);
    expect(orphelins, "créés par la migration, absents de prisma/objets-sql-bruts.ts :").toEqual(
      [],
    );
  });

  it("aucun nom n'est déclaré deux fois", () => {
    const noms = OBJETS_SQL_BRUTS.map((o) => o.nom);
    expect(new Set(noms).size).toBe(noms.length);
  });

  it("les clés composées ne se terminent jamais par _fkey (réservé à Prisma)", () => {
    const mal = OBJETS_SQL_BRUTS.filter((o) => o.type === "fk" && o.nom.endsWith("_fkey"));
    expect(mal).toEqual([]);
  });

  it("contre-témoin : un index retiré du texte est vu manquant", () => {
    const coupe = SQL.replace(/CREATE UNIQUE INDEX "comptes_rendus_un_valide"[^;]*;/, "");
    expect(coupe).not.toBe(SQL);
    const presents = new Set(objetsCrees(coupe).map(cle));
    expect(presents.has("index:comptes_rendus.comptes_rendus_un_valide")).toBe(false);
  });

  it("la migration est additive : aucun DROP ni ALTER COLUMN hors commentaires", () => {
    const actif = SQL.split(/\r?\n/)
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(actif).not.toMatch(/\bDROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT)\b/i);
    expect(actif).not.toMatch(/\bALTER\s+COLUMN\b/i);
    expect(actif).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+"|DELETE\s+FROM)\b/i);
  });
});
