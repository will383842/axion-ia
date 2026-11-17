/**
 * Migration `20261118120000_cible_effacement_emails_manuels` (lot I4, fiche F1c) : UNE valeur ajoutée à
 * l'énumération `cible_effacement`. Garde : une seule instruction, aucune écriture, aucune table ni colonne
 * touchée, retour arrière sans instruction, dossier trié après `20261118100000_emails_manuels`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(process.cwd(), "prisma", "migrations");
const NOM = "20261118120000_cible_effacement_emails_manuels";
const lire = (f: string): string => readFileSync(join(RACINE, NOM, f), "utf8");

const sansCommentaires = (t: string): string =>
  t
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

const INSTRUCTION_ATTENDUE = `ALTER TYPE "cible_effacement" ADD VALUE IF NOT EXISTS 'emails_manuels'`;
const MOTS_INTERDITS = /\b(?:DROP|DELETE|UPDATE|INSERT|RENAME|TRUNCATE|COLUMN)\b|\bSET\s+SCHEMA\b/i;

function instructions(sql: string): string[] {
  return sansCommentaires(sql)
    .split(";")
    .map((i) => i.replace(/\s+/g, " ").trim())
    .filter((i) => i !== "");
}

/** Faute(s) d'un texte de migration : vide si conforme. */
function fautesMigration(sql: string): string[] {
  const fautes: string[] = [];
  const liste = instructions(sql);
  if (liste.length !== 1 || liste[0] !== INSTRUCTION_ATTENDUE) {
    fautes.push("l'unique instruction attendue est absente ou accompagnée d'une autre");
  }
  if (MOTS_INTERDITS.test(sansCommentaires(sql))) fautes.push("mot interdit");
  return fautes;
}

describe("migration cible_effacement_emails_manuels", () => {
  it("ne contient, hors commentaires, que l'ADD VALUE IF NOT EXISTS attendu", () => {
    expect(instructions(lire("migration.sql"))).toEqual([INSTRUCTION_ATTENDUE]);
    expect(fautesMigration(lire("migration.sql"))).toEqual([]);
  });

  it("aucun DROP, DELETE, UPDATE, INSERT, RENAME, TRUNCATE, COLUMN ni SET SCHEMA", () => {
    expect(sansCommentaires(lire("migration.sql"))).not.toMatch(MOTS_INTERDITS);
  });

  it("le retour arrière est vide hors commentaires", () => {
    expect(sansCommentaires(lire("rollback.sql")).trim()).toBe("");
  });

  it("le dossier est trié après 20261118100000_emails_manuels", () => {
    const dossiers = readdirSync(RACINE)
      .filter((d) => /^\d{14}_/.test(d))
      .sort();
    expect(dossiers.indexOf(NOM)).toBeGreaterThan(
      dossiers.indexOf("20261118100000_emails_manuels"),
    );
    expect(dossiers.indexOf("20261118100000_emails_manuels")).toBeGreaterThanOrEqual(0);
  });

  describe("contre-témoins : la garde rougit", () => {
    const base = sansCommentaires(lire("migration.sql"));
    it.each([
      ["DROP TYPE", `${base}\nDROP TYPE "cible_effacement";`],
      [
        "RENAME VALUE",
        `${base}\nALTER TYPE "cible_effacement" RENAME VALUE 'emails_manuels' TO 'autre';`,
      ],
      ["autre valeur", `ALTER TYPE "cible_effacement" ADD VALUE IF NOT EXISTS 'autre';`],
      ["sans IF NOT EXISTS", `ALTER TYPE "cible_effacement" ADD VALUE 'emails_manuels';`],
      ["instruction ajoutée", `${base}\nUPDATE "effacements_journal" SET "motif" = 'x';`],
    ])("%s", (_nom, sql) => {
      expect(fautesMigration(sql).length).toBeGreaterThan(0);
    });
    it("le texte réel est conforme (témoin sain)", () => {
      expect(fautesMigration(lire("migration.sql"))).toEqual([]);
    });
  });
});
