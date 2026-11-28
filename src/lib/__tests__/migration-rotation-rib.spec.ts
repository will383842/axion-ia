// PR P : la sortie « rotation » du garde des RIB joints est étroite.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(process.cwd(), "prisma/migrations/20261128157000_apporteurs_rotation_rib");
const sql = readFileSync(join(dir, "migration.sql"), "utf8");
const retour = readFileSync(join(dir, "rollback.sql"), "utf8");

describe("migration rotation RIB", () => {
  it("la sortie n'existe que sous le réglage 'rotation', octets AXB1 des deux côtés, autres colonnes égales", () => {
    expect(sql).toContain("current_setting('axion.reecriture_pii', true) = 'rotation'");
    expect(sql).toContain("(to_jsonb(NEW) - 'octets') = (to_jsonb(OLD) - 'octets')");
    expect((sql.match(/\\x41584231/g) ?? []).length).toBe(2);
    expect(sql).toContain("les octets ne sont jamais remplacés, seulement purgés");
  });
  it("le rollback restaure le garde sans la sortie", () => {
    expect(retour).not.toContain("reecriture_pii");
    expect(retour).toContain("seulement purgés");
  });
  it("aucun DROP", () => {
    expect(sql + retour).not.toMatch(/DROP\s/i);
  });
});
