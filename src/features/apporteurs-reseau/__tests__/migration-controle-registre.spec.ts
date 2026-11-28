import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = path.resolve(__dirname, "../../../..");
const NOM = readdirSync(path.join(RACINE, "prisma/migrations")).find((d) =>
  d.endsWith("_apporteurs_controle_registre"),
);
const lire = (f: string) =>
  readFileSync(path.join(RACINE, "prisma/migrations", NOM ?? "", f), "utf8");
const sansCommentaires = (s: string) => s.replace(/--.*$/gm, "");

describe("migration du contrôle du registre", () => {
  it("existe, avec rollback.sql, et son horodatage dépasse les précédentes", () => {
    expect(NOM).toBeDefined();
    expect(existsSync(path.join(RACINE, "prisma/migrations", NOM ?? "", "rollback.sql"))).toBe(
      true,
    );
    const autres = readdirSync(path.join(RACINE, "prisma/migrations")).filter(
      // Les migrations postérieures (annexes versionnées, annulations de rendez-vous, purge RGPD) viennent après : on ne compare qu'aux précédentes.
      (d) =>
        /^\d{14}_/.test(d) &&
        d !== NOM &&
        !d.endsWith("_apporteurs_annexes_versionnees") &&
        !d.endsWith("_apporteurs_annulations_rendez_vous") &&
        !d.endsWith("_apporteurs_purge_rgpd") &&
        !d.endsWith("_apporteurs_annexes_versionnees") &&
        !d.endsWith("_apporteurs_numeros_pieces_uniques") &&
        !d.endsWith("_apporteurs_numeros_pieces_reservation") &&
        !d.endsWith("_apporteurs_challenges_primes") &&
        !d.endsWith("_porte_qualite_content_intentions"),
    );
    expect((NOM ?? "").slice(0, 14) > autres.sort().at(-1)!.slice(0, 14)).toBe(true);
  });
  it("additive : une table neuve, sans clé étrangère, DROP, ni énumération", () => {
    const sql = sansCommentaires(lire("migration.sql"));
    expect(sql).toMatch(/CREATE TABLE "apporteur_controles_registre"/);
    expect(sql).not.toMatch(
      /\bDROP\b|\bREFERENCES\b|FOREIGN KEY|CREATE TYPE|ALTER TYPE|ALTER TABLE/i,
    );
  });
  it("CHECK sur l'état : active, fermee, introuvable seulement", () => {
    const sql = lire("migration.sql");
    expect(sql).toMatch(/CHECK \("etat" IN \('active', 'fermee', 'introuvable'\)\)/);
  });
  it("rollback : sauvegarde puis RENAME, jamais DROP", () => {
    const rb = lire("rollback.sql");
    expect(rb).toMatch(/seulement sur décision du fondateur/i);
    expect(rb).toMatch(/COPY/);
    expect(sansCommentaires(rb)).not.toMatch(/\bDROP\b/i);
  });
});
