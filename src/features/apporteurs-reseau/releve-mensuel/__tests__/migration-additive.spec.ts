/**
 * LA MIGRATION DU RELEVÉ MENSUEL EST ADDITIVE (plan docs/plans/PLAN-RELEVE-MENSUEL-APPORTEURS.md § 4, lot 3a).
 *
 * Pendant une mise en ligne, l'application et le worker ne tournent pas le même code (AGENTS.md, « DEUX
 * conteneurs ») : un type et deux tables NEUFS, deux colonnes NULLABLES sur `commissions_apporteur`, aucun DROP,
 * aucun UPDATE, aucun remplissage rétroactif, rien de recréé de l'existant (autofacture, mandat, TVA figée).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = path.resolve(__dirname, "../../../../..");
const NOM = "20261127200000_apporteurs_releve_mensuel";
const MIGRATION = `prisma/migrations/${NOM}/migration.sql`;
const lire = (rel: string) => readFileSync(path.join(RACINE, rel), "utf8");
const sansCommentaires = (sql: string) => sql.replace(/--.*$/gm, "");

const TABLES_NEUVES = ["releves_mensuels_apporteur", "lots_releve_mensuel"];

/** Les fautes d'une migration additive ; le contre-témoin la nourrit d'un texte muté. */
function fautes(sqlBrut: string): string[] {
  const sql = sansCommentaires(sqlBrut);
  const instructions = sql.replace(/\$\$[\s\S]*?\$\$/g, " "); // corps de fonctions retirés
  const out: string[] = [];
  if (/\bDROP\b/i.test(instructions)) out.push("DROP");
  if (/\bRENAME\b|(?<!BEFORE\s)\bTRUNCATE\b/i.test(instructions)) out.push("renommage ou TRUNCATE");
  if (/\bALTER\s+TYPE\b|\bADD\s+VALUE\b/i.test(instructions)) out.push("énumération existante");
  if (/\bALTER\s+COLUMN\b|\bSET\s+NOT\s+NULL\b/i.test(instructions)) out.push("colonne modifiée");
  if (/\b(UPDATE\s+"|DELETE\s+FROM|INSERT\s+INTO)\b/i.test(instructions)) out.push("écriture");
  for (const m of instructions.matchAll(/\bCREATE\s+TABLE\s+"?(\w+)"?/gi)) {
    if (!TABLES_NEUVES.includes(m[1] as string)) out.push(`CREATE TABLE ${m[1]}`);
  }
  for (const m of instructions.matchAll(/\bALTER\s+TABLE\s+"?(\w+)"?\s+([^;]*);/gi)) {
    const table = m[1] as string;
    const corps = m[2] as string;
    if (table === "commissions_apporteur") {
      // Seulement des colonnes NULLABLES, jamais NOT NULL ni DEFAULT.
      for (const part of corps.split(/,\s*(?=ADD\b)/i)) {
        if (
          !/^ADD\s+COLUMN\s+"(regle_appliquee|version_contrat)"\s+VARCHAR\(\d+\)\s*$/i.test(
            part.trim(),
          )
        )
          out.push(`commissions_apporteur : ${part.trim()}`);
      }
    } else if (!TABLES_NEUVES.includes(table)) {
      out.push(`ALTER TABLE ${table}`);
    }
  }
  return out;
}

describe("la migration du relevé mensuel est additive", () => {
  const sql = lire(MIGRATION);

  it("est horodatée APRÈS toutes les autres migrations et après 20261127160000", () => {
    const toutes = readdirSync(path.join(RACINE, "prisma/migrations"))
      .filter((d) => /^\d{14}_/.test(d))
      .sort();
    expect(toutes).toContain(NOM);
    // Seules les migrations additives de pilotage SEO et de chaîne éditoriale et de la porte qualité Q1 (nouvelles tables) peuvent la suivre.
    expect(toutes.slice(toutes.indexOf(NOM) + 1)).toEqual(
      toutes
        .slice(toutes.indexOf(NOM) + 1)
        .filter((d) =>
          [
            "_pilotage_seo_mesure",
            "_chaine_editoriale_tables",
            "_porte_qualite_tables",
            "_team_invite_envoi",
          ].some((s) =>
            d.endsWith(s),
          ),
        ),
    );
    expect(NOM.slice(0, 14) > "20261127160000").toBe(true);
  });

  it("crée le type, les deux tables et les deux colonnes nullables, rien d'autre", () => {
    const s = sansCommentaires(sql);
    expect([...s.matchAll(/CREATE TYPE\s+"(\w+)"/g)].map((m) => m[1])).toEqual([
      "statut_releve_mensuel",
    ]);
    expect([...s.matchAll(/CREATE TABLE\s+"(\w+)"/g)].map((m) => m[1]).sort()).toEqual(
      [...TABLES_NEUVES].sort(),
    );
    expect(s).toMatch(/ALTER TABLE "commissions_apporteur"[\s\S]*"regle_appliquee" VARCHAR\(40\)/);
    expect(s).toMatch(/"version_contrat" VARCHAR\(10\)/);
  });

  it("ni DROP, ni UPDATE, ni colonne existante modifiée, ni table existante touchée", () => {
    expect(fautes(sql)).toEqual([]);
  });

  it("ne recrée rien de l'existant (autofacture, mandat, TVA figée)", () => {
    const s = sansCommentaires(sql);
    for (const t of [
      "pieces_autofacture_apporteur",
      "apporteur_regime_tva_changements",
      "trainer_statements",
    ]) {
      expect(s).not.toContain(`"${t}"`);
    }
  });

  it("pose l'index unique PARTIEL : un seul lot vivant par période", () => {
    expect(sansCommentaires(sql)).toMatch(
      /CREATE UNIQUE INDEX "lots_releve_mensuel_un_en_cours"\s+ON "lots_releve_mensuel"\s*\("periode"\)\s+WHERE "fin_at" IS NULL AND "abandonne_at" IS NULL/,
    );
  });

  it("porte l'unicité (apporteur, période, rang) et celle du numéro", () => {
    const s = sansCommentaires(sql);
    expect(s).toMatch(/UNIQUE INDEX "releves_mensuels_apporteur_numero_key"/);
    expect(s).toMatch(/UNIQUE INDEX "releves_mensuels_apporteur_apporteur_id_periode_rang_key"/);
  });

  it("clé étrangère vers l'apporteur en RESTRICT (conservation légale)", () => {
    expect(sansCommentaires(sql)).toMatch(
      /FOREIGN KEY \("apporteur_id"\) REFERENCES "apporteurs_reseau"\("id"\) ON DELETE RESTRICT/,
    );
  });

  it("contre-témoins : chaque faute interdite fait rougir la garde", () => {
    expect(fautes(sql + '\nDROP TABLE "x";')).toContain("DROP");
    expect(fautes(sql + '\nUPDATE "commissions_apporteur" SET "statut" = \'due\';')).toContain(
      "écriture",
    );
    expect(
      fautes(sql + '\nALTER TABLE "commissions_apporteur" ADD COLUMN "z" TEXT NOT NULL;').length,
    ).toBeGreaterThan(0);
    expect(
      fautes(sql + '\nALTER TABLE "pieces_autofacture_apporteur" ADD COLUMN "z" TEXT;'),
    ).toContain("ALTER TABLE pieces_autofacture_apporteur");
    expect(fautes(sql + '\nCREATE TABLE "autre" ("id" INT);')).toContain("CREATE TABLE autre");
  });
});

describe("le schéma Prisma porte les mêmes objets", () => {
  const schema = lire("prisma/schema.prisma");
  it("déclare les deux modèles, l'énumération, les deux colonnes et la relation inverse", () => {
    expect(schema).toMatch(/model ReleveMensuelApporteur \{/);
    expect(schema).toMatch(/model LotReleveMensuel \{/);
    expect(schema).toMatch(/enum StatutReleveMensuel \{/);
    expect(schema).toMatch(/regleAppliquee\s+String\?\s+@map\("regle_appliquee"\)/);
    expect(schema).toMatch(/versionContrat\s+String\?\s+@map\("version_contrat"\)/);
    expect(schema).toMatch(/relevesMensuels\s+ReleveMensuelApporteur\[\]/);
  });
  it("classe les deux tables au registre RGPD (annotation rgpd:)", () => {
    for (const m of ["ReleveMensuelApporteur", "LotReleveMensuel"]) {
      const avant = schema.slice(0, schema.indexOf(`model ${m} {`));
      const derniers = avant.split("\n").slice(-12).join("\n");
      expect(derniers).toMatch(/\/\/\/ rgpd: /);
    }
  });
});
