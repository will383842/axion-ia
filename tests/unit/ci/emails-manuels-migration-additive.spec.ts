/**
 * La migration `emails_manuels` (chantier e-mails, lot I4, fiche F1) est ADDITIVE : deux tables neuves,
 * aucune colonne existante touchée, aucune ligne écrite ni supprimée. Les clés étrangères pointent VERS
 * des tables existantes sans les modifier. Le retour arrière met de côté (schéma « retrait »), sans DROP.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(process.cwd(), "prisma", "migrations");
const NOM = "20261118100000_emails_manuels";
const DOSSIER = join(RACINE, NOM);
const sansCommentaires = (f: string): string =>
  readFileSync(join(DOSSIER, f), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

// Seules formes tolérées des mots DELETE / UPDATE : les actions de clé étrangère `ON DELETE …` / `ON UPDATE …`.
const sansActionsDeCle = (sql: string): string =>
  sql.replace(/\bON (DELETE|UPDATE)\s+(RESTRICT|CASCADE|SET NULL)/gi, "");

const INTERDITES = [
  /\bDROP\b/i,
  /\bDELETE\b/i,
  /\bUPDATE\b/i,
  /\bTRUNCATE\b/i,
  /\bINSERT\b/i,
  /\bRENAME\b/i,
];

describe("migration emails_manuels : additive", () => {
  it("migration.sql et rollback.sql existent ; le nom est unique", () => {
    expect(existsSync(join(DOSSIER, "migration.sql"))).toBe(true);
    expect(existsSync(join(DOSSIER, "rollback.sql"))).toBe(true);
    expect(readdirSync(RACINE).filter((d) => d.endsWith("_emails_manuels"))).toEqual([NOM]);
  });

  it("ne crée que deux tables neuves", () => {
    const sql = sansCommentaires("migration.sql");
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(2);
    expect(sql).toMatch(/CREATE TABLE "emails_manuels" \(/);
    expect(sql).toMatch(/CREATE TABLE "emails_manuels_pieces_jointes" \(/);
  });

  it("ne supprime, ne renomme ni n'écrit rien (ON UPDATE CASCADE des clés étrangères mis à part)", () => {
    const sql = sansActionsDeCle(sansCommentaires("migration.sql"));
    for (const re of INTERDITES) expect(sql).not.toMatch(re);
  });

  it("le seul ALTER est ALTER TABLE <table neuve> ADD CONSTRAINT", () => {
    const sql = sansCommentaires("migration.sql");
    const alters = sql.match(/\bALTER\b[^;]*;/gi) ?? [];
    expect(alters).toHaveLength(4);
    for (const a of alters) {
      expect(a).toMatch(/^ALTER TABLE "emails_manuels(_pieces_jointes)?"\s+ADD CONSTRAINT\b/i);
      expect(a).not.toMatch(/\b(ALTER COLUMN|ADD COLUMN|DROP|TYPE)\b/i);
    }
  });

  it("les index ne portent que sur les tables neuves", () => {
    const sql = sansCommentaires("migration.sql");
    const index = sql.match(/CREATE (UNIQUE )?INDEX[^;]*;/g) ?? [];
    expect(index).toHaveLength(8);
    for (const i of index) expect(i).toMatch(/ON "emails_manuels(_pieces_jointes)?"\(/);
  });

  it("les clés étrangères pointent vers l'existant en RESTRICT (SET NULL pour l'auteur), jamais en CASCADE", () => {
    const sql = sansCommentaires("migration.sql");
    expect(sql).toMatch(/REFERENCES "clients"\("id"\) ON DELETE RESTRICT/);
    expect(sql).toMatch(/REFERENCES "client_contacts"\("id"\) ON DELETE RESTRICT/);
    expect(sql).toMatch(/REFERENCES "admin_users"\("id"\) ON DELETE SET NULL/);
    expect(sql).toMatch(/REFERENCES "emails_manuels"\("id"\) ON DELETE RESTRICT/);
    expect(sql).not.toMatch(/ON DELETE CASCADE/i);
  });

  it("porte les contraintes du plan (types, statuts, empreinte, taille)", () => {
    const sql = sansCommentaires("migration.sql");
    expect(sql).toMatch(
      /'Client','ClientContact','CalendlyEvent','ApporteurReseau','Trainer','Trainee'/,
    );
    expect(sql).toMatch(/'brouillon','en_file','envoye','echec','retenu','rebondi'/);
    expect(sql).toMatch(/"destinataire_hash" ~ '\^\[0-9a-f\]\{64\}\$'/);
    expect(sql).toMatch(/"taille_octets" > 0 AND "taille_octets" <= 10485760/);
    expect(sql).toMatch(/'attendue','controle','acceptee','refusee','non_recue'/);
  });

  it("le retour arrière ne contient aucun DROP : il met de côté", () => {
    const sql = sansCommentaires("rollback.sql");
    for (const re of [...INTERDITES, /\bCASCADE\b/i]) expect(sql).not.toMatch(re);
    expect(sql).toMatch(/SET SCHEMA "retrait"/);
    expect(sql.match(/SET SCHEMA/g)).toHaveLength(2);
  });

  it("le modèle Prisma porte les mêmes noms de tables et de colonnes", () => {
    const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
    const em = schema.match(/model EmailManuel \{[\s\S]*?\n\}/)?.[0] ?? "";
    const pj = schema.match(/model EmailManuelPieceJointe \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(em).toMatch(/@@map\("emails_manuels"\)/);
    expect(pj).toMatch(/@@map\("emails_manuels_pieces_jointes"\)/);
    for (const c of [
      "cle_idempotence",
      "destinataire_chiffre",
      "destinataire_hash",
      "corps_source",
      "message_id",
      "rebond_type",
      "ecrit_par_id",
    ]) {
      expect(em).toContain(`"${c}"`);
    }
    for (const c of ["email_manuel_id", "cle_stockage", "jeton_hash", "taille_octets"]) {
      expect(pj).toContain(`"${c}"`);
    }
  });
});
