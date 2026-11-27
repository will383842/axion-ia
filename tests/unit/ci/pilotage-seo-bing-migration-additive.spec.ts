/**
 * PILOTAGE SEO, P17 (Bing Webmaster) — la migration est ADDITIVE : trois tables neuves, aucune
 * clé étrangère, aucune énumération, aucun DROP / DELETE / UPDATE / ALTER / INSERT.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const NOM = "20261128010078_pilotage_seo_bing";
const brut = readFileSync(
  path.join(process.cwd(), "prisma", "migrations", NOM, "migration.sql"),
  "utf8",
);
const schema = readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
const sql = brut.replace(/--.*$/gm, "");

describe("migration pilotage_seo_bing", () => {
  it("n'ajoute que trois tables, sans instruction destructrice ni clé étrangère", () => {
    expect(sql).not.toMatch(/\b(DROP|DELETE|UPDATE|TRUNCATE|INSERT|ALTER|CREATE\s+TYPE)\b/i);
    expect(sql).not.toMatch(/\bREFERENCES\b|\bFOREIGN\s+KEY\b/i);
    const tables = [...sql.matchAll(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+"([a-z_0-9]+)"/gi)]
      .map((m) => m[1])
      .sort();
    expect(tables).toEqual([
      "bing_exploration_jours",
      "bing_page_semaines",
      "bing_requete_semaines",
    ]);
  });

  it("chaque table a son modèle Prisma", () => {
    for (const m of ["BingPageSemaine", "BingRequeteSemaine", "BingExplorationJour"]) {
      expect(schema).toContain(`model ${m} {`);
    }
  });

  it("contre-témoin : un DROP ferait rougir la règle", () => {
    expect(`${sql}\nDROP TABLE x;`).toMatch(/\bDROP\b/i);
  });
});
