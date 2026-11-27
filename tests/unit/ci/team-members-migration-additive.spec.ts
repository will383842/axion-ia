/**
 * La migration `team_members` (pages collaborateurs) est ADDITIVE (AGENTS.md « DEUX conteneurs ») : quatre
 * tables neuves, leurs index et les clés étrangères entre elles. Rien d'existant n'est altéré, aucune
 * énumération, aucune donnée. Et le schéma permet l'EFFACEMENT RÉEL d'une personne : aucune clé
 * `Restrict` vers sa fiche, le journal survit sans donnée personnelle.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const DOSSIER = join(RACINE, "prisma", "migrations", "20261127130000_team_members");
const sansCommentaires = (s: string) =>
  s
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
const sql = sansCommentaires(readFileSync(join(DOSSIER, "migration.sql"), "utf8"));
const down = readFileSync(join(DOSSIER, "down.sql"), "utf8");
const schema = readFileSync(join(RACINE, "prisma", "schema.prisma"), "utf8");
const TABLES = [
  "team_members",
  "team_questionnaire_invites",
  "team_questionnaire_submissions",
  "team_member_events",
];

function modele(nom: string): string {
  const m = new RegExp(`model ${nom} \\{[\\s\\S]*?\\n\\}`).exec(schema);
  expect(m, `modèle ${nom}`).not.toBeNull();
  return (m as RegExpExecArray)[0];
}

describe("migration team_members : additive", () => {
  it("ne contient que CREATE TABLE, CREATE INDEX et les clés étrangères des quatre tables neuves", () => {
    const instr = sql
      .split(";")
      .map((i) => i.trim())
      .filter(Boolean);
    const t = TABLES.join("|");
    for (const i of instr) {
      expect(i).toMatch(
        new RegExp(
          `^(CREATE TABLE "(${t})"|CREATE (UNIQUE )?INDEX "(${t})_[a-z_]+" ON "(${t})"|ALTER TABLE "(${t})" ADD CONSTRAINT "[a-z_]+" FOREIGN KEY)`,
        ),
      );
    }
    expect(instr.filter((i) => i.startsWith("CREATE TABLE"))).toHaveLength(4);
  });
  it("ne supprime, ne renomme, n'écrit et ne crée aucune énumération", () => {
    for (const re of [
      /\bDROP\b/i,
      /\bDELETE\s+FROM\b/i,
      /\bUPDATE\s+"/i,
      /\bINSERT\b/i,
      /\bRENAME\b/i,
      /\bTRUNCATE\b/i,
      /\bCREATE TYPE\b/i,
      /\bALTER TYPE\b/i,
      /\bALTER COLUMN\b/i,
      /\bREFERENCES\s+"(?!team_)/i,
    ]) {
      expect(sql).not.toMatch(re);
    }
  });
  it("down.sql s'arrête si une table n'est pas vide, et le contrôle précède les suppressions", () => {
    expect(down).toMatch(/RAISE EXCEPTION/);
    expect(down.indexOf("RAISE EXCEPTION")).toBeLessThan(down.indexOf("DROP TABLE"));
    for (const t of TABLES) expect(down).toContain(`"${t}"`);
  });
  it("aucune colonne énumération dans les quatre modèles", () => {
    const enums = [...schema.matchAll(/^enum (\w+)/gm)].map((m) => m[1]);
    for (const nom of [
      "TeamMember",
      "TeamQuestionnaireInvite",
      "TeamQuestionnaireSubmission",
      "TeamMemberEvent",
    ]) {
      for (const e of enums) expect(modele(nom)).not.toMatch(new RegExp(`\\s${e}\\??\\s`));
    }
  });
  it("le slug est unique en base", () => {
    expect(modele("TeamMember")).toMatch(/slug\s+String\s+@unique/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "team_members_slug_key"/);
  });
});

describe("schéma team_members : effacement réel possible, trace sans donnée personnelle", () => {
  it("aucune relation vers TeamMember ou ses invitations n'est en Restrict", () => {
    for (const nom of [
      "TeamMember",
      "TeamQuestionnaireInvite",
      "TeamQuestionnaireSubmission",
      "TeamMemberEvent",
    ]) {
      expect(modele(nom)).not.toMatch(/onDelete:\s*(Restrict|NoAction)/);
    }
  });
  it("invitations et réponses partent avec la fiche ; le journal garde ses lignes, lien mis à NULL", () => {
    expect(modele("TeamQuestionnaireInvite")).toMatch(/onDelete: Cascade/);
    expect(modele("TeamQuestionnaireSubmission").match(/onDelete: Cascade/g)).toHaveLength(2);
    const ev = modele("TeamMemberEvent");
    expect(ev).toMatch(/memberId\s+String\?/);
    expect(ev).toMatch(/onDelete: SetNull/);
  });
  it("le journal ne porte aucune colonne d'identité ni de contact", () => {
    expect(modele("TeamMemberEvent")).not.toMatch(
      /first_name|email|slug|ip_hash|user_agent|photo|linkedin/i,
    );
  });
  it("les modèles portent l'annotation RGPD exigée par la garde du schéma", () => {
    expect(schema).toMatch(/\/\/\/ rgpd: dossier-client\nmodel TeamMember \{/);
    expect(schema).toMatch(/\/\/\/ rgpd: dossier-client\nmodel TeamQuestionnaireInvite \{/);
    expect(schema).toMatch(/\/\/\/ rgpd: dossier-client\nmodel TeamQuestionnaireSubmission \{/);
    expect(schema).toMatch(/\/\/\/ rgpd: technique — [^\n]+\nmodel TeamMemberEvent \{/);
  });
});
