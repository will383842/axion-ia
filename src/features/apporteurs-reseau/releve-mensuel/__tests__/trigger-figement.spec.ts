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
  "id",
  "rectifie_id",
  "format_version",
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

  it("refuse tout retour vers `prepare` depuis un statut pris", () => {
    expect(garde).toMatch(
      /OLD\."statut"\s+IN\s*\(\s*'envoi_en_cours'\s*,\s*'echec'\s*,\s*'envoye'\s*\)\s+AND\s+NEW\."statut"\s*=\s*'prepare'[\s\S]*?RAISE EXCEPTION/,
    );
  });

  it("ferme le détour envoi_en_cours → ecarte → prepare → modification → suppression", () => {
    // 1. on n'écarte pas une ligne en plein envoi
    expect(garde).toMatch(
      /OLD\."statut"\s*=\s*'envoi_en_cours'\s+AND\s+NEW\."statut"\s*=\s*'ecarte'[\s\S]*?RAISE EXCEPTION/,
    );
    // 2. désécarter est refusé dès que la ligne a été prise ou porte un job
    expect(garde).toMatch(
      /NEW\."statut"\s*=\s*'prepare'\s+AND\s+OLD\."statut"\s*<>\s*'prepare'\s+AND\s+\(OLD\."pris_at" IS NOT NULL OR OLD\."email_job_id" IS NOT NULL\)\s+THEN\s+RAISE EXCEPTION/,
    );
    // 3. une ligne prise est figée même si son statut est `prepare`, et ses traces ne s'effacent pas
    expect(garde).toMatch(
      /OLD\."pris_at" IS NOT NULL OR OLD\."email_job_id" IS NOT NULL\)\s+AND \(NEW\."id"/,
    );
    expect(garde).toMatch(
      /OLD\."pris_at" IS NOT NULL AND NEW\."pris_at" IS DISTINCT FROM OLD\."pris_at"/,
    );
    expect(garde).toMatch(
      /OLD\."email_job_id" IS NOT NULL AND NEW\."email_job_id" IS DISTINCT FROM OLD\."email_job_id"/,
    );
    // 4. la suppression est refusée pour une ligne prise
    expect(corps("releves_mensuels_apporteur_refuse_delete")).toMatch(
      /OLD\."pris_at" IS NOT NULL OR OLD\."email_job_id" IS NOT NULL/,
    );
    // 5. toute ligne envoi_en_cours / echec / envoye porte la trace de sa prise
    expect(sql).toMatch(
      /"releves_mensuels_apporteur_prise_tracee"\s+CHECK \("statut" NOT IN \('envoi_en_cours', 'echec', 'envoye'\) OR "pris_at" IS NOT NULL\)/,
    );
  });

  it("fige les totaux, envoye_at et envoye_par dès `envoye`", () => {
    for (const c of [
      "nb_lignes",
      "factures_ht_cents",
      "avoirs_ht_cents",
      "vires_ttc_cents",
      "en_attente_ht_cents",
      "cumul_annee_ht_cents",
      "envoye_at",
      "envoye_par",
    ]) {
      expect(garde, c).toMatch(
        new RegExp(
          `OLD\\."statut"\\s*=\\s*'envoye'\\s+AND\\s+\\([\\s\\S]*?NEW\\."${c}" IS DISTINCT FROM OLD\\."${c}"[\\s\\S]*?RAISE EXCEPTION`,
        ),
      );
    }
  });

  it("ferme ecarte → envoi_en_cours (prise depuis prepare | echec seulement)", () => {
    expect(garde).toMatch(
      /OLD\."statut"\s*=\s*'ecarte'\s+AND\s+NEW\."statut"\s*=\s*'envoi_en_cours'\s+THEN\s+RAISE EXCEPTION/,
    );
  });

  it("refuse TRUNCATE par un trigger BEFORE TRUNCATE qui lève", () => {
    expect(corps("releves_mensuels_apporteur_refuse_truncate")).toMatch(/RAISE EXCEPTION/);
    expect(sql).toMatch(
      /CREATE TRIGGER "releves_mensuels_apporteur_refuse_truncate"\s+BEFORE TRUNCATE ON "releves_mensuels_apporteur"\s+FOR EACH STATEMENT EXECUTE FUNCTION "releves_mensuels_apporteur_refuse_truncate"\(\)/,
    );
  });

  it("pose la clé étrangère rectifie_id en RESTRICT / RESTRICT", () => {
    expect(sql).toMatch(
      /FOREIGN KEY \("rectifie_id"\) REFERENCES "releves_mensuels_apporteur"\("id"\) ON DELETE RESTRICT ON UPDATE RESTRICT/,
    );
  });

  it("pose les contraintes CHECK et n'a pas d'index redondant sur apporteur_id", () => {
    for (const c of [
      "periode_format",
      "rang_coherent",
      "ecart_motive",
      "envoye_complet",
      "prise_tracee",
      "empreinte_format",
    ]) {
      expect(sql).toContain(`"releves_mensuels_apporteur_${c}"`);
    }
    expect(sql).not.toContain("releves_mensuels_apporteur_apporteur_id_idx");
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
