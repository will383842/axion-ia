import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = join(
  process.cwd(),
  "prisma/migrations/20261128120000_apporteurs_annulations_rendez_vous",
);
const sql = readFileSync(join(DOSSIER, "migration.sql"), "utf8")
  .split("\n")
  .filter((l) => !l.trimStart().startsWith("--"))
  .join("\n");
const retour = readFileSync(join(DOSSIER, "rollback.sql"), "utf8");
const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");

describe("migration des annulations de rendez-vous", () => {
  it("est additive : aucun DROP, aucune clé étrangère, aucune énumération", () => {
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/REFERENCES|FOREIGN KEY/i);
    expect(sql).not.toMatch(/CREATE TYPE/i);
    expect(sql).not.toMatch(/ALTER TABLE "(?!annulations_rendez_vous_presentation)/);
  });

  it("pose les trois CHECK", () => {
    expect(sql).toContain(`"auteur" IS NULL OR "auteur" IN ('axion', 'entreprise')`);
    expect(sql).toContain(`("auteur" IS NULL) = ("qualifiee_at" IS NULL)`);
    expect(sql).toContain(`"auteur" IS DISTINCT FROM 'entreprise' OR "motif" IS NOT NULL`);
  });

  it("pose le déclencheur BEFORE UPDATE de qualification unique", () => {
    expect(sql).toMatch(/BEFORE UPDATE ON "annulations_rendez_vous_presentation"/);
    expect(sql).toMatch(/OLD\."auteur" IS NOT NULL/);
    expect(sql).toMatch(/NEW\."qualifiee_par" IS DISTINCT FROM OLD\."qualifiee_par"/);
  });

  it("garde l'unicité (présentation, rendez-vous)", () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX[^;]+\("presentation_id", "rendez_vous_cle"\)/);
  });

  it("a un rollback.sql prudent : sauvegarde d'abord, RENAME plutôt que DROP TABLE", () => {
    expect(retour).toContain("décision du fondateur");
    expect(retour.indexOf("COPY")).toBeGreaterThan(-1);
    expect(retour.indexOf("COPY")).toBeLessThan(retour.indexOf("RENAME TO"));
    expect(retour).not.toMatch(/DROP TABLE/i);
  });

  it("le schéma Prisma déclare le modèle correspondant", () => {
    expect(schema).toContain("model AnnulationRendezVousPresentation");
    expect(schema).toContain('@@map("annulations_rendez_vous_presentation")');
  });
});
