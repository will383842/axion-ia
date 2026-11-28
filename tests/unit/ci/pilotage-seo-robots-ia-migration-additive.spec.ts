/**
 * PILOTAGE SEO, PR P10 — la migration « robots d'IA » est ADDITIVE : une table neuve, aucune clé
 * étrangère, aucune énumération, aucun DROP / DELETE / UPDATE / ALTER ; ni IP ni user-agent brut.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const NOM = "20261128010064_pilotage_seo_robots_ia";
const sqlBrut = readFileSync(
  path.join(process.cwd(), "prisma", "migrations", NOM, "migration.sql"),
  "utf8",
);
const schema = readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
const sansCommentaires = (sql: string): string => sql.replace(/--.*$/gm, "");

function fautes(brut: string): string[] {
  const sql = sansCommentaires(brut);
  const out: string[] = [];
  if (/\b(DROP|DELETE|UPDATE|TRUNCATE|INSERT|CREATE\s+TYPE|CREATE\s+TRIGGER|ALTER)\b/i.test(sql))
    out.push("instruction interdite");
  if (/\bREFERENCES\b|\bFOREIGN\s+KEY\b/i.test(sql)) out.push("clé étrangère");
  const tables = [...sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/gi)].map(
    (m) => m[1],
  );
  if (JSON.stringify(tables) !== JSON.stringify(["robot_ia_jours"])) out.push(`tables : ${tables}`);
  if (/CREATE\s+(TABLE|INDEX|UNIQUE\s+INDEX)\s+(?!IF\s+NOT\s+EXISTS)/i.test(sql))
    out.push("non rejouable");
  if (/\b(ip|user_?agent)\b/i.test(sql)) out.push("donnée brute");
  return out;
}

describe("pilotage SEO P10 — migration additive", () => {
  it("est additive", () => expect(fautes(sqlBrut)).toEqual([]));

  it.each([
    ["un DROP", `${sqlBrut}\nDROP TABLE "clients";`],
    ["un ALTER", `${sqlBrut}\nALTER TABLE "robot_ia_jours" ADD COLUMN "x" TEXT;`],
    [
      "une colonne user_agent",
      sqlBrut.replace('"robot" VARCHAR(40)', '"user_agent" TEXT, "robot" VARCHAR(40)'),
    ],
    ["une table non rejouable", sqlBrut.replace("CREATE TABLE IF NOT EXISTS", "CREATE TABLE")],
  ])("contre-témoin : %s fait rougir", (_n, texte) => {
    expect(fautes(texte).length).toBeGreaterThan(0);
  });

  it("le modèle Prisma est annoté rgpd technique, sans relation, avec clé d'idempotence", () => {
    const m = schema.match(/((?:\/\/\/[^\n]*\n)*)model RobotIaJour \{([\s\S]*?)\n\}/);
    expect(m).not.toBeNull();
    const corps = `${m?.[1]}\n${m?.[2]}`;
    expect(corps).toMatch(/\/\/\/ rgpd: technique — \S+/);
    expect(corps).not.toMatch(/@relation/);
    expect(corps).toContain("@@unique([date, robot, familleChemin]");
    expect(corps).toContain('@@map("robot_ia_jours")');
  });

  it("horodatage postérieur à la migration mesure de P2", () => {
    expect(NOM.slice(0, 14) > "20261127230000").toBe(true);
  });
});
