/**
 * La migration de la table `tour_demandes` est ADDITIVE (Tour France IA, PR-2a).
 *
 * Le site (APP) joue les migrations au démarrage, en meilleur effort ; le worker lit le code TS et
 * peut tourner AVANT ou APRÈS cette migration (AGENTS.md, « DEUX conteneurs »). Une migration qui
 * retire, renomme ou réécrit quoi que ce soit casserait l'un des deux. Celle-ci ne fait que créer
 * une table neuve, ses index et sa clé étrangère.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = join(process.cwd(), "prisma", "migrations");

function migrationDuTour(): string {
  const nom = readdirSync(DOSSIER).find((n) => n.endsWith("_tour_demandes"));
  if (nom === undefined) throw new Error("migration *_tour_demandes introuvable");
  return readFileSync(join(DOSSIER, nom, "migration.sql"), "utf8");
}

/** Le SQL sans ses commentaires `--` (le « retour arrière » y est écrit, jamais exécuté). */
function sansCommentaires(sql: string): string {
  return (
    sql
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n")
      // Les actions de clé étrangère (`ON DELETE SET NULL`) ne sont pas des instructions.
      .replace(
        /\bON\s+(?:DELETE|UPDATE)\s+(?:SET\s+NULL|SET\s+DEFAULT|CASCADE|RESTRICT|NO\s+ACTION)/gi,
        "",
      )
  );
}

describe("migration tour_demandes : additive", () => {
  const sql = sansCommentaires(migrationDuTour());

  it("crée la table", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS\s+"?tour_demandes"?/i);
  });

  it("ne retire, ne renomme et n'écrase rien", () => {
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bUPDATE\b/i);
    expect(sql).not.toMatch(/\bINSERT\b/i);
  });

  it("ne crée aucun type énuméré (un type ne se retire jamais proprement)", () => {
    expect(sql).not.toMatch(/CREATE TYPE/i);
    expect(sql).not.toMatch(/ALTER TYPE/i);
  });

  it("tout ALTER TABLE vise la table neuve", () => {
    const alters = [...sql.matchAll(/ALTER TABLE\s+(?:ONLY\s+)?("?[\w.]+"?)/gi)];
    for (const m of alters) {
      expect((m[1] ?? "").replace(/"/g, "")).toBe("tour_demandes");
    }
  });

  it("tout index vise la table neuve", () => {
    const index = [...sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX[^;]*?\bON\s+("?[\w.]+"?)/gi)];
    expect(index.length).toBeGreaterThan(0);
    for (const m of index) {
      expect((m[1] ?? "").replace(/"/g, "")).toBe("tour_demandes");
    }
  });

  it("pose trois clés de comptage uniques", () => {
    const uniques = [...sql.matchAll(/CREATE UNIQUE INDEX/gi)];
    expect(uniques).toHaveLength(3);
  });
});
