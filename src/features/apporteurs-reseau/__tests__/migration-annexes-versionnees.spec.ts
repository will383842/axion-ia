/**
 * LA MIGRATION DES ANNEXES VERSIONNÉES EST ADDITIVE ET FIGÉE (point 11, PR C).
 * Deux tables neuves, aucune clé étrangère, aucun DROP, aucune table existante touchée ; ajout seul garanti par
 * des déclencheurs ; états en VARCHAR + CHECK ; un `rollback.sql` qui met de côté au lieu de supprimer.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = path.resolve(__dirname, "../../../..");
const DOSSIER = readdirSync(path.join(RACINE, "prisma/migrations")).find((d) =>
  d.endsWith("_apporteurs_annexes_versionnees"),
) as string;
const lire = (f: string) =>
  readFileSync(path.join(RACINE, "prisma/migrations", DOSSIER, f), "utf8");
const sansCommentaires = (sql: string) => sql.replace(/--.*$/gm, "");
const TABLES = ["documents_annexes_versions", "apporteur_documents_remis"];

describe("migration apporteurs_annexes_versionnees", () => {
  it("existe, avec un rollback.sql, et son horodatage dépasse celui de la dernière migration de main", () => {
    expect(DOSSIER).toBeTruthy();
    expect(existsSync(path.join(RACINE, "prisma/migrations", DOSSIER, "rollback.sql"))).toBe(true);
    const autres = readdirSync(path.join(RACINE, "prisma/migrations")).filter(
      // Les migrations postérieures (annulations de rendez-vous PR D, purge RGPD PR N, numéros de pièces) viennent après : on ne compare qu'aux précédentes.
      (d) =>
        /^\d{14}_/.test(d) &&
        d !== DOSSIER &&
        !d.endsWith("_apporteurs_annulations_rendez_vous") &&
        !d.endsWith("_apporteurs_purge_rgpd") &&
        !d.endsWith("_apporteurs_numeros_pieces_uniques") &&
        !d.endsWith("_apporteurs_numeros_pieces_reservation") &&
        !d.endsWith("_apporteurs_avenants"),
    );
    expect(DOSSIER.slice(0, 14) > autres.sort().at(-1)!.slice(0, 14)).toBe(true);
  });

  const sql = () => sansCommentaires(lire("migration.sql"));
  const instructions = () => sql().replace(/\$\$[\s\S]*?\$\$/g, " ");

  it("crée exactement les deux tables prévues", () => {
    const creees = [...sql().matchAll(/CREATE TABLE\s+"(\w+)"/g)].map((m) => m[1]);
    expect(creees.sort()).toEqual([...TABLES].sort());
  });

  it("aucun DROP, aucune clé étrangère, aucune énumération, aucun ALTER TABLE hors des deux tables", () => {
    const i = instructions();
    expect(i).not.toMatch(/\bDROP\b/i);
    expect(i).not.toMatch(/\bREFERENCES\b|\bFOREIGN\s+KEY\b/i);
    expect(i).not.toMatch(/\bCREATE\s+TYPE\b|\bALTER\s+TYPE\b|\bADD\s+VALUE\b/i);
    for (const m of i.matchAll(/\bALTER\s+TABLE\s+(?:ONLY\s+)?"?(\w+)"?/gi))
      expect(TABLES).toContain(m[1]);
    expect(i).not.toMatch(/apporteurs_reseau/i);
  });

  it("refuse DELETE, TRUNCATE et UPDATE par déclencheur, sur les deux tables", () => {
    const s = sql();
    for (const t of TABLES) {
      expect(s).toMatch(new RegExp(`BEFORE DELETE ON "${t}"`));
      expect(s).toMatch(new RegExp(`BEFORE TRUNCATE ON "${t}"`));
      expect(s).toMatch(new RegExp(`BEFORE UPDATE ON "${t}"`));
    }
  });

  it("seule retiree_at peut passer de NULL à une date sur documents_annexes_versions ; tout UPDATE refusé sur les remises", () => {
    const s = sql();
    const garde =
      s.match(
        /CREATE FUNCTION "documents_annexes_versions_garde_update"[\s\S]*?\$\$ LANGUAGE/,
      )?.[0] ?? "";
    expect(garde).toMatch(/"retiree_at"/);
    expect(garde).toMatch(/OLD\."retiree_at" IS NOT NULL/);
    expect(garde).not.toMatch(/NEW\."sha256" IS NOT DISTINCT/);
    const remis =
      s.match(
        /CREATE FUNCTION "apporteur_documents_remis_garde_update"[\s\S]*?\$\$ LANGUAGE/,
      )?.[0] ?? "";
    expect(remis).toMatch(/RAISE EXCEPTION/);
    expect(remis).not.toMatch(/IF\s/);
  });

  it("porte les CHECK : document, contexte, empreinte hexadécimale", () => {
    const s = sql();
    expect(s).toMatch(/"document_id" IN \('fiche-commissions', 'livret', 'guide-demarrage'\)/);
    expect(s).toMatch(/"contexte" IN \('contrat_signe', 'renvoi_contrat', 'lien_dossier'\)/);
    expect(s).toMatch(/"sha256" ~ '\^\[0-9a-f\]\{64\}\$'/);
    expect(s).toMatch(/"version_sha256" ~ '\^\[0-9a-f\]\{64\}\$'/);
  });

  it("le rollback met de côté (RENAME) au lieu de supprimer les tables", () => {
    const r = sansCommentaires(lire("rollback.sql"));
    expect(r).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(r).toMatch(/RENAME TO "documents_annexes_versions_retire_/);
    expect(r).toMatch(/RENAME TO "apporteur_documents_remis_retire_/);
    expect(lire("rollback.sql")).toMatch(/décision du fondateur/);
  });

  it("le rollback retire aussi les quatre fonctions de déclencheur (migration réappliquable)", () => {
    const m = lire("migration.sql");
    const r = sansCommentaires(lire("rollback.sql"));
    const fonctions = [...m.matchAll(/CREATE FUNCTION "([a-z_]+)"\(\)/g)].map((x) => x[1]);
    expect(fonctions).toHaveLength(4);
    for (const f of fonctions) expect(r).toContain(`DROP FUNCTION "${f}"()`);
  });
});
