/**
 * L3b — la migration `guide_reseau_origines` est ADDITIVE (worker avant app, règle des deux
 * conteneurs), et le code de l'historique ne SUPPRIME jamais une ligne (ADR contrat v3, §2, §6).
 * Chaque règle a son contre-témoin.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RACINE } from "./sources-du-circuit-visio";

const lire = (...p: string[]): string => readFileSync(path.join(RACINE, ...p), "utf8");
const sansCommentaires = (sql: string): string => sql.replace(/--.*$/gm, "");

function fautes(sql: string): string[] {
  const s = sansCommentaires(sql);
  const f: string[] = [];
  if (/\b(DROP|DELETE|UPDATE|TRUNCATE|INSERT|CREATE\s+TYPE|ALTER\s+TYPE|ALTER\s+TABLE)\b/i.test(s))
    f.push("instruction destructrice, d'écriture ou modifiant une table existante");
  if (/ON\s+DELETE\s+CASCADE/i.test(s)) f.push("cascade");
  if (!/CREATE\s+TABLE\s+"guide_reseau_origines"/i.test(s)) f.push("table absente");
  return f;
}

const SQL = lire("prisma", "migrations", "20261103100000_guide_reseau_origines", "migration.sql");

describe("migration guide_reseau_origines", () => {
  it("additive", () => expect(fautes(SQL)).toEqual([]));
  it("contre-témoin : un DROP ou un ALTER fait rougir", () => {
    expect(fautes(SQL + '\nDROP TABLE "x";')).not.toEqual([]);
    expect(fautes(SQL + '\nALTER TABLE "guide_requests" ADD COLUMN "z" INT;')).not.toEqual([]);
  });
  it("aucune adresse, aucun pseudo, aucun texte en colonne", () => {
    expect(SQL).not.toMatch(/"(email|pseudo|texte|nom|display_name)"/i);
  });
});

describe("code de l'historique", () => {
  const code = lire("src", "server", "guides-reseau", "origines.ts");
  it("ne supprime jamais une ligne", () => {
    expect(code).not.toMatch(/\.(delete|deleteMany)\s*\(/);
  });
  it("contre-témoin", () => {
    expect("tx.guideReseauOrigine.deleteMany({})").toMatch(/\.(delete|deleteMany)\s*\(/);
  });
});

describe("route", () => {
  it("corps limité à 32 Ko", () => {
    expect(lire("src", "server", "guides-reseau", "config.ts")).toMatch(
      /CORPS_MAX_GUIDES_RESEAU = 32 \* 1024/,
    );
    expect(lire("src", "app", "api", "interne", "demandes-guide-reseau", "route.ts")).toMatch(
      /corpsMaxOctets: CORPS_MAX_GUIDES_RESEAU/,
    );
  });
});
