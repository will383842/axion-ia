/**
 * Migration `20261108150000_contacts_guide_reseau_origine_optionnelle` (page « Recevoir le guide »,
 * lot S2 v2) : l'origine vit dans `guide_reseau_origines` et au CRM ; les colonnes d'origine de
 * `contacts_guide_reseau` deviennent NULLABLES. ADDITIVE : on relâche une contrainte, rien d'autre.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const NOM = "20261108150000_contacts_guide_reseau_origine_optionnelle";
const MIGRATIONS = join(process.cwd(), "prisma", "migrations");
const DOSSIER = join(MIGRATIONS, NOM);
const sansCommentaires = (t: string): string =>
  t
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
const lire = (f: string): string => readFileSync(join(DOSSIER, f), "utf8");

describe("migration contacts_guide_reseau_origine_optionnelle", () => {
  it("est horodatée APRÈS la création de la table ; seules les migrations additives des lots guide réseau 3 et 4 la suivent", () => {
    const dossiers = readdirSync(MIGRATIONS)
      .filter((d) => /^\d{14}_/.test(d))
      .sort();
    expect(dossiers).toContain("20261108140000_contacts_guide_reseau");
    // Liste fermée des migrations postérieures : toute autre doit être ajoutée ici sciemment.
    expect(dossiers.slice(dossiers.indexOf(NOM) + 1)).toEqual([
      "20261111210000_contacts_guide_reseau_infos_facultatives",
      "20261112000000_contacts_guide_reseau_preuve_statut",
      "20261112100000_guide_reseau_origines_crm",
      "20261112110000_oppositions_effacement_demande",
      "20261112120000_oppositions_conv_ref",
    ]);
    expect(dossiers.indexOf(NOM)).toBeGreaterThan(
      dossiers.indexOf("20261108140000_contacts_guide_reseau"),
    );
  });

  it("ne fait que relâcher NOT NULL de mot, reseau, compte_ref, version_m1 (post_ref l'est déjà)", () => {
    const sql = sansCommentaires(lire("migration.sql"));
    const instructions = sql
      .split(";")
      .map((i) => i.trim())
      .filter(Boolean);
    expect(instructions).toHaveLength(4);
    for (const col of ["mot", "reseau", "compte_ref", "version_m1"]) {
      expect(instructions).toContain(
        `ALTER TABLE "contacts_guide_reseau" ALTER COLUMN "${col}" DROP NOT NULL`,
      );
    }
  });

  it("aucun DROP de colonne ou de table, aucun DELETE / UPDATE / INSERT / TRUNCATE / RENAME", () => {
    const sql = sansCommentaires(lire("migration.sql"));
    const sansRelachement = sql.replace(/DROP NOT NULL/g, "");
    for (const re of [
      /\bDROP\b/i,
      /\bDELETE\b/i,
      /\bUPDATE\b/i,
      /\bINSERT\b/i,
      /\bTRUNCATE\b/i,
      /\bRENAME\b/i,
    ]) {
      expect(sansRelachement).not.toMatch(re);
    }
  });

  it("documente l'ordre de livraison dans la migration", () => {
    expect(lire("migration.sql")).toMatch(/ORDRE DE LIVRAISON/);
  });

  it("rollback.sql : remet NOT NULL derrière un garde-fou, sans rien supprimer ni modifier", () => {
    expect(existsSync(join(DOSSIER, "rollback.sql"))).toBe(true);
    const r = sansCommentaires(lire("rollback.sql"));
    expect(r.match(/SET NOT NULL/g)).toHaveLength(4);
    expect(r).toMatch(/IF EXISTS/);
    expect(r).not.toMatch(/\b(DELETE|UPDATE|TRUNCATE|DROP)\b/i);
  });

  it("le schéma Prisma déclare les cinq colonnes d'origine optionnelles", () => {
    const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
    const modele = schema.slice(schema.indexOf("model ContactGuideReseau {"));
    const bloc = modele.slice(0, modele.indexOf("\n}"));
    for (const champ of ["mot", "reseau", "compteRef", "postRef", "versionM1"]) {
      expect(bloc).toMatch(new RegExp(`\\n  ${champ}\\s+String\\?`));
    }
  });
});
