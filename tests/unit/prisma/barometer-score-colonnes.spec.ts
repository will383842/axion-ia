/**
 * GEO V2-10 PR-1 — la migration des colonnes du Score IA PME doit rester
 * strictement additive (compatibilité des DEUX conteneurs, cf. AGENTS.md) :
 * uniquement des ADD COLUMN nullables + un index unique ; aucune donnée touchée.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const SQL = readFileSync(
  join(RACINE, "prisma/migrations/20261120090000_observatoire_score_consentement/migration.sql"),
  "utf8",
);
const SCHEMA = readFileSync(join(RACINE, "prisma/schema.prisma"), "utf8");

// SQL sans commentaires, pour ne pas confondre un mot cité en commentaire avec une instruction.
const CODE = SQL.replace(/--[^\n]*/g, "").trim();
const INSTRUCTIONS = CODE.split(";")
  .map((s) => s.trim())
  .filter(Boolean);

describe("migration observatoire_score_consentement", () => {
  it("ne contient que ALTER TABLE barometer_responses et CREATE UNIQUE INDEX", () => {
    expect(INSTRUCTIONS.length).toBe(2);
    expect(INSTRUCTIONS[0]).toMatch(/^ALTER TABLE "barometer_responses"/);
    expect(INSTRUCTIONS[1]).toMatch(/^CREATE UNIQUE INDEX /);
  });

  it("ajoute exactement les trois colonnes prévues, en ADD COLUMN", () => {
    const ajouts = [...CODE.matchAll(/ADD COLUMN\s+"([a-z_]+)"\s+([A-Z]+\(\d+\))([^,;]*)/g)];
    expect(ajouts.map((m) => m[1])).toEqual(["source", "consent_version", "code_retrait_hash"]);
    expect(ajouts.map((m) => m[2])).toEqual(["VARCHAR(40)", "VARCHAR(64)", "VARCHAR(64)"]);
  });

  it("n'impose ni NOT NULL ni DEFAULT (colonnes nullables, aucune réécriture)", () => {
    expect(CODE).not.toMatch(/NOT\s+NULL/i);
    expect(CODE).not.toMatch(/\bDEFAULT\b/i);
    for (const m of CODE.matchAll(/ADD COLUMN\s+"[a-z_]+"\s+[A-Z]+\(\d+\)([^,;]*)/g)) {
      expect((m[1] ?? "").trim()).toBe("");
    }
  });

  it("ne contient aucun UPDATE, DELETE, DROP, TRUNCATE, RENAME ni type enum", () => {
    expect(CODE).not.toMatch(/\b(UPDATE|DELETE|DROP|TRUNCATE|RENAME|INSERT|CREATE\s+TYPE)\b/i);
  });

  it("pose l'index unique sur code_retrait_hash", () => {
    expect(CODE).toMatch(
      /CREATE UNIQUE INDEX "barometer_responses_code_retrait_hash_key"\s+ON "barometer_responses"\("code_retrait_hash"\)/,
    );
  });

  it("le schéma Prisma déclare les trois champs nullables, alignés sur le SQL", () => {
    const bloc = SCHEMA.match(/model BarometerResponse \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(bloc).toMatch(/source\s+String\?\s+@db\.VarChar\(40\)/);
    expect(bloc).toMatch(
      /consentVersion\s+String\?\s+@map\("consent_version"\)\s+@db\.VarChar\(64\)/,
    );
    expect(bloc).toMatch(
      /codeRetraitHash\s+String\?\s+@unique\s+@map\("code_retrait_hash"\)\s+@db\.VarChar\(64\)/,
    );
  });
});
