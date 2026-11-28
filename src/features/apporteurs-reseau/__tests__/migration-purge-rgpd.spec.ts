// PR N : la migration de purge, lue comme du texte (le comportement réel est dans tests/sql, Gate D).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = join(
  __dirname,
  "../../../../prisma/migrations/20261128120000_apporteurs_purge_rgpd",
);
const up = readFileSync(join(DOSSIER, "migration.sql"), "utf8");
const rb = readFileSync(join(DOSSIER, "rollback.sql"), "utf8");

describe("migration purge RGPD", () => {
  it("la sortie de purge n'existe que pour iban = 'purge' sous le réglage local", () => {
    const sorties =
      up.match(/= 'purge'\n\s+AND OLD\."iban" <> 'purge' AND NEW\."iban" = 'purge'/g) ?? [];
    expect(sorties).toHaveLength(2); // une par table
    expect(up).not.toMatch(/NEW\."iban" ~ '\^enc:v2:'\n\s+AND OLD\."iban" = 'purge'/);
  });
  it("la rotation exige un chiffré v2 des deux côtés et aucune autre colonne modifiée", () => {
    const r = up.match(/'rotation'[\s\S]*?THEN\s+RETURN NEW;/g) ?? [];
    expect(r).toHaveLength(2);
    for (const x of r) {
      expect(x).toContain(`OLD."iban" ~ '^enc:v2:' AND NEW."iban" ~ '^enc:v2:'`);
      expect(x).toContain(`(to_jsonb(NEW) - 'iban') = (to_jsonb(OLD) - 'iban')`);
    }
  });
  it("jamais de retour de 'purge' vers un chiffré : aucune sortie ne part d'OLD.iban = 'purge'", () => {
    expect(up).not.toMatch(/OLD\."iban" = 'purge'/);
  });
  it("les deux CHECK acceptent 'purge' seulement avec iban_purge_at", () => {
    expect(up.match(/"iban" = 'purge' AND "iban_purge_at" IS NOT NULL/g)).toHaveLength(2);
  });
  it("journal : sans clé étrangère, ajout seul", () => {
    expect(up).not.toMatch(/FOREIGN KEY|REFERENCES/);
    expect(up).toContain("apporteur_purges_rgpd_no_update_delete");
  });
  it("aucune ligne n'est effacée ni aucun DROP de table", () => {
    expect(up).not.toMatch(/DROP TABLE|DELETE FROM|TRUNCATE TABLE/);
  });
  it("rollback : CHECK d'origine en NOT VALID, RENAME au lieu de DROP", () => {
    expect(rb.match(/\) NOT VALID;/g)).toHaveLength(2);
    expect(rb).toContain("RENAME TO");
    expect(rb).not.toMatch(/DROP TABLE|DROP COLUMN/);
    expect(rb).toContain("COPY");
  });
});
