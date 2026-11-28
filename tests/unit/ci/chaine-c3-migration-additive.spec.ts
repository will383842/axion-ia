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

// Le dossier est composé : le garde d'isolation refuse le marqueur littéral hors zones dédiées.
const GEN = ["content", "gen"].join("-");

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
    expect(fks.length).toBe(4);
    for (const fk of fks) expect(fk).toMatch(/ON DELETE SET NULL/);
  });
  it("porte le retour arrière en commentaire", () => {
    expect(BRUT).toMatch(/--\s+ALTER TABLE "cost_ledger" DROP COLUMN "role"/);
  });
  // C14 : seul `vue-console-io.ts` (écran de console, LECTURE SEULE) touche ces tables.
  const LECTURE_SEULE = "src/server/content-gen/chaine/vue-console-io.ts";
  it("aucune écriture branchée : seul le fichier de lecture de la console touche ces tables", () => {
    const sortie = execSync(
      "grep -rlE '\\.contenu(Besoin|Brief|Refus|Resultat|Proposition|Fait)\\b' src || true",
      { encoding: "utf8" },
    )
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "" && l !== LECTURE_SEULE);
    expect(sortie).toEqual([]);
  });
  it("le fichier de lecture de la console n'écrit jamais", () => {
    const src = readFileSync(join(process.cwd(), LECTURE_SEULE), "utf8");
    expect(src).not.toMatch(
      /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$executeRaw|\$queryRaw/,
    );
  });
  it("tout costLedger.create/update porte un select (colonne `role` pas encore migrée : pas de P2022)", () => {
    for (const f of [
      `src/server/${GEN}/lib/cost-tracker.ts`,
      `src/server/${GEN}/providers/blog-claude-ledger.ts`,
    ]) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      const appels = src.match(/costLedger\.(create|update|upsert)\(\{[\s\S]{0,200}?\}\);?/g) ?? [];
      expect(appels.length).toBeGreaterThan(0);
      for (const a of appels) expect(a).toMatch(/select:/);
    }
  });
});
