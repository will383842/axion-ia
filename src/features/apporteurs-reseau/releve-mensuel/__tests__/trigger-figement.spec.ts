/**
 * LE RELEVÉ ENVOYÉ EST FIGÉ EN BASE (plan § 2.4 et § 4, lot 3a).
 * Une garde applicative (`updateMany … where statut = prepare`) ne protège que le code qui la porte : un script
 * ou une action future pourrait réécrire un relevé déjà parti. Les deux triggers SQL le refusent.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = path.resolve(__dirname, "../../../../..");
const sql = readFileSync(
  path.join(RACINE, "prisma/migrations/20261127200000_apporteurs_releve_mensuel/migration.sql"),
  "utf8",
).replace(/--.*$/gm, "");

const corps = (fonction: string): string => {
  const m = sql.match(
    new RegExp(
      `CREATE (?:OR REPLACE )?FUNCTION "${fonction}"\\(\\)[\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$`,
    ),
  );
  expect(m, `fonction ${fonction}`).not.toBeNull();
  return (m as RegExpMatchArray)[1] as string;
};

const COLONNES_FIGEES = [
  "numero",
  "apporteur_id",
  "periode",
  "rang",
  "coupure_at",
  "contenu",
  "empreinte_sha256",
  "pdf_r2_key",
  "pdf_sha256",
];

describe("trigger de figement du relevé mensuel", () => {
  const garde = corps("releves_mensuels_apporteur_garde_update");

  it("couvre CHACUNE des colonnes figées", () => {
    for (const c of COLONNES_FIGEES) {
      expect(garde, c).toMatch(new RegExp(`NEW\\."${c}" IS DISTINCT FROM OLD\\."${c}"`));
    }
  });

  it("ne protège qu'au-delà de `prepare` (le seul statut modifiable en contenu)", () => {
    expect(garde).toMatch(/OLD\."statut"\s*(<>|!=|IS DISTINCT FROM)\s*'prepare'/);
  });

  it("refuse tout retour d'`envoye` vers un autre statut", () => {
    expect(garde).toMatch(
      /OLD\."statut"\s*=\s*'envoye'\s+AND\s+NEW\."statut"\s*(<>|!=|IS DISTINCT FROM)\s*'envoye'/,
    );
  });

  it("est branché en BEFORE UPDATE sur la table", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER "releves_mensuels_apporteur_garde_update"\s+BEFORE UPDATE ON "releves_mensuels_apporteur"\s+FOR EACH ROW EXECUTE FUNCTION "releves_mensuels_apporteur_garde_update"\(\)/,
    );
  });

  it("refuse la suppression d'une ligne qui n'est pas `prepare`", () => {
    expect(corps("releves_mensuels_apporteur_refuse_delete")).toMatch(
      /OLD\."statut"\s*(<>|!=)\s*'prepare'[\s\S]*RAISE EXCEPTION/,
    );
    expect(sql).toMatch(
      /CREATE TRIGGER "releves_mensuels_apporteur_refuse_delete"\s+BEFORE DELETE ON "releves_mensuels_apporteur"/,
    );
  });
});
