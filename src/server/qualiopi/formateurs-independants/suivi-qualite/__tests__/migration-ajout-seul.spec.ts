/**
 * Qualiopi ind. 21 — la migration du suivi qualité est ADDITIVE et ses deux tables sont
 * en AJOUT SEUL. Vérifié sur une base migrée à neuf le 17/10 (UPDATE, DELETE refusés ;
 * grille vierge ou observation sans session refusées) ; ce test garde le texte.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  path.resolve(
    __dirname,
    "../../../../../../prisma/migrations/20261017120000_formateurs_suivi_qualite/migration.sql",
  ),
  "utf8",
);
const actif = SQL.split("\n")
  .filter((l) => !l.trimStart().startsWith("--"))
  .join("\n");

describe("migration du suivi qualité (ind. 21)", () => {
  it("additive : aucun DROP, aucune ligne existante modifiée", () => {
    expect(actif).not.toMatch(/\bDROP\b/i);
    expect(actif).not.toMatch(/\bUPDATE\s+"/i);
    expect(actif).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(actif).not.toMatch(/ALTER TABLE "(?!grilles_suivi_formateur|decisions_suivi_formateur)/);
  });

  it.each(["grilles_suivi_formateur", "decisions_suivi_formateur"])(
    "%s : ni modification, ni suppression, ni vidage",
    (table) => {
      expect(actif).toContain(
        `CREATE TRIGGER "${table}_ajout_seul"\n  BEFORE UPDATE OR DELETE ON "${table}"\n  FOR EACH ROW EXECUTE FUNCTION "formateurs_preuve_ajout_seul"();`,
      );
      expect(actif).toContain(
        `CREATE TRIGGER "${table}_pas_de_truncate"\n  BEFORE TRUNCATE ON "${table}"`,
      );
    },
  );

  it("une grille vierge ou sans rattachement est refusée par la base aussi", () => {
    expect(actif).toContain('jsonb_array_length("criteres") > 0');
    expect(actif).toContain('length(btrim("conclusion")) > 0');
    expect(actif).toContain(`("type" = 'reevaluation' OR "session_id" IS NOT NULL)`);
  });
});
