/**
 * La migration `chaine_editoriale_tables` (C3) est ADDITIVE : six tables neuves + une colonne
 * nullable sur `cost_ledger`. Elle doit rester sans risque pour les deux conteneurs
 * (AGENTS.md, « DEUX conteneurs ») : aucune énumération, aucune donnée touchée, aucun usage en
 * production tant que C4+ n'est pas livré.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = "20261128000000_chaine_editoriale_tables";
const BRUT = readFileSync(
  join(process.cwd(), "prisma", "migrations", DOSSIER, "migration.sql"),
  "utf8",
);
const sql = BRUT.split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

const TABLES = [
  "contenu_besoins",
  "contenu_briefs",
  "contenu_faits",
  "contenu_refus",
  "contenu_resultats",
  "contenu_propositions",
];

describe("migration chaine_editoriale_tables : additive", () => {
  it("crée les six tables neuves", () => {
    for (const t of TABLES) expect(sql).toMatch(new RegExp(`CREATE TABLE "${t}"`));
  });
  it("ajoute `role` NULLABLE à cost_ledger, seul ALTER d'une table existante", () => {
    expect(sql).toMatch(/ALTER TABLE "cost_ledger" ADD COLUMN\s+"role" VARCHAR\(40\);/);
    const alters = sql.match(/ALTER TABLE "[a-z_]+"/g) ?? [];
    const existantes = alters.filter((a) => !TABLES.some((t) => a.includes(`"${t}"`)));
    expect(existantes).toEqual(['ALTER TABLE "cost_ledger"']);
  });
  it("ne retire, ne renomme, n'écrit aucune donnée", () => {
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
    expect(sql).not.toMatch(/\bINSERT\b/i);
    expect(sql).not.toMatch(/\bUPDATE\s+"/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/SET NOT NULL/i);
  });
  it("n'utilise aucune énumération (rien à tolérer côté worker plus ancien)", () => {
    expect(sql).not.toMatch(/CREATE TYPE/i);
    expect(sql).not.toMatch(/ALTER TYPE/i);
  });
  it("les clés étrangères ne bloquent jamais une suppression (SET NULL)", () => {
    const fks = sql.match(/ADD CONSTRAINT[^;]+;/g) ?? [];
    expect(fks.length).toBe(3);
    for (const fk of fks) expect(fk).toMatch(/ON DELETE SET NULL/);
  });
  it("porte le retour arrière en commentaire", () => {
    expect(BRUT).toMatch(/--\s+ALTER TABLE "cost_ledger" DROP COLUMN "role"/);
  });
  it("aucune lecture ni écriture branchée : le code de production ne touche pas ces tables", () => {
    const sortie = execSync(
      "grep -rlE 'prisma\\.contenu(Besoin|Brief|Refus|Resultat|Proposition|Fait)\\b' src || true",
      { encoding: "utf8" },
    ).trim();
    expect(sortie).toBe("");
  });
});
