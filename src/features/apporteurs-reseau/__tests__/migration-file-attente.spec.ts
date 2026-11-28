import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const NOM = "20261128190000_apporteurs_file_attente";
const DOSSIER = join(process.cwd(), "prisma/migrations", NOM);
const sql = readFileSync(join(DOSSIER, "migration.sql"), "utf8")
  .split("\n")
  .filter((l) => !l.trimStart().startsWith("--"))
  .join("\n");
const retour = readFileSync(join(DOSSIER, "rollback.sql"), "utf8");
const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");

describe("migration de la file d'attente", () => {
  it("porte un horodatage unique et supérieur aux migrations de main (≥ 20261128155000)", () => {
    const horodatages = readdirSync(join(process.cwd(), "prisma/migrations"))
      .filter((d) => /^\d{14}_/.test(d))
      .map((d) => d.slice(0, 14));
    expect(horodatages.filter((h) => h === NOM.slice(0, 14))).toHaveLength(1);
    expect(NOM.slice(0, 14) > "20261128155000").toBe(true);
  });

  it("est additive : aucun DROP, aucune clé étrangère, aucune énumération, aucune autre table", () => {
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/REFERENCES|FOREIGN KEY/i);
    expect(sql).not.toMatch(/CREATE TYPE/i);
    expect(sql).not.toMatch(/ALTER TABLE "(?!declarations_en_attente)/);
  });

  it("pose les trois CHECK de l'énoncé", () => {
    expect(sql).toContain(
      `"statut" IN ('en_attente', 'informee', 'redeclaree', 'effacee', 'eteinte')`,
    );
    expect(sql).toContain(
      `"statut" <> 'informee' OR ("informee_at" IS NOT NULL AND "fenetre_fin_at" IS NOT NULL)`,
    );
    expect(sql).toContain(
      `"statut" NOT IN ('redeclaree', 'effacee', 'eteinte') OR "cloturee_at" IS NOT NULL`,
    );
  });

  it("n'autorise que les transitions prévues et fige les autres colonnes", () => {
    expect(sql).toMatch(/BEFORE UPDATE ON "declarations_en_attente"/);
    expect(sql).toContain(
      `OLD."statut" = 'en_attente' AND NEW."statut" IN ('informee', 'eteinte')`,
    );
    expect(sql).toContain(
      `OLD."statut" = 'informee' AND NEW."statut" IN ('redeclaree', 'effacee', 'eteinte')`,
    );
    for (const c of ["presentation_id", "apporteur_id", "siren", "siret", "cle_file", "recue_at"])
      expect(sql).toContain(`NEW."${c}" IS DISTINCT FROM OLD."${c}"`);
  });

  it("interdit la suppression", () => {
    expect(sql).toMatch(/BEFORE DELETE ON "declarations_en_attente"/);
  });

  it("n'autorise qu'un seul premier rang informé par clé de file (index unique partiel)", () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX[^;]+\("cle_file"\) WHERE "statut" = 'informee'/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX[^;]+\("presentation_id"\)/);
  });

  it("a un rollback.sql prudent : sauvegarde d'abord, RENAME plutôt que DROP TABLE", () => {
    expect(retour).toMatch(/décision du fondateur/);
    expect(retour).toMatch(/COPY "declarations_en_attente" TO/);
    expect(retour).toMatch(/RENAME TO "declarations_en_attente_retire_\d{8}"/);
    expect(retour.split("\n").filter((l) => /^\s*DROP TABLE/i.test(l))).toEqual([]);
  });

  it("le modèle Prisma suit la migration", () => {
    const m =
      /(?:\/\/\/[^\n]*\n)+model DeclarationEnAttente \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? "";
    expect(m).toContain('@@map("declarations_en_attente")');
    expect(m).toContain("presentationId           String    @unique");
    expect(m).not.toMatch(/@relation/);
    expect(m).toContain("/// rgpd: technique");
  });
});
