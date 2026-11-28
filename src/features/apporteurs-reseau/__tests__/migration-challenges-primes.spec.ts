import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = path.resolve(__dirname, "../../../..");
const NOM = readdirSync(path.join(RACINE, "prisma/migrations")).find((d) =>
  d.endsWith("_apporteurs_challenges_primes"),
);
const lire = (f: string) =>
  readFileSync(path.join(RACINE, "prisma/migrations", NOM ?? "", f), "utf8");
const sansCommentaires = (s: string) => s.replace(/--.*$/gm, "");

describe("migration de la table des primes de challenge", () => {
  it("existe, avec rollback.sql, et son horodatage dépasse toutes les autres", () => {
    expect(NOM).toBeDefined();
    expect(existsSync(path.join(RACINE, "prisma/migrations", NOM ?? "", "rollback.sql"))).toBe(
      true,
    );
    const autres = readdirSync(path.join(RACINE, "prisma/migrations")).filter(
      (d) => /^\d{14}_/.test(d) && d !== NOM,
    );
    expect((NOM ?? "").slice(0, 14) > autres.sort().at(-1)!.slice(0, 14)).toBe(true);
  });
  it("additive : une table neuve, sans clé étrangère, DROP ni énumération", () => {
    const sql = sansCommentaires(lire("migration.sql"));
    expect(sql).toMatch(/CREATE TABLE "challenges_primes"/);
    expect(sql).not.toMatch(/\bDROP TABLE\b|\bREFERENCES\b|FOREIGN KEY|CREATE TYPE|ALTER TYPE/i);
  });
  it("CHECK sur le statut, nb_journees >= 1, refus motivé", () => {
    const sql = lire("migration.sql");
    expect(sql).toMatch(
      /"statut" IN \('a_valider', 'validee', 'refusee', 'a_reprendre', 'reprise'\)/,
    );
    expect(sql).toMatch(/"nb_journees" >= 1/);
    expect(sql).toMatch(/"statut" <> 'refusee' OR "motif" IS NOT NULL/);
  });
  it("un apporteur, un challenge : unicité", () => {
    expect(lire("migration.sql")).toMatch(
      /UNIQUE INDEX "challenges_primes_challenge_id_apporteur_id_key"/,
    );
  });
  it("déclencheur BEFORE INSERT : jamais deux primes sur une même période", () => {
    const sql = lire("migration.sql");
    expect(sql).toMatch(/BEFORE INSERT ON "challenges_primes"/);
    expect(sql).toMatch(/"debut_le" <= /);
    expect(sql).toMatch(/<> 'refusee'/);
    expect(sql).toMatch(/RAISE EXCEPTION/);
  });
  it("jamais de DELETE", () => {
    expect(lire("migration.sql")).toMatch(/BEFORE DELETE ON "challenges_primes"/);
  });
  it("rollback : sauvegarde puis RENAME, jamais DROP", () => {
    const rb = lire("rollback.sql");
    expect(rb).toMatch(/seulement sur décision du fondateur/i);
    expect(rb).toMatch(/copy/i);
    expect(sansCommentaires(rb)).not.toMatch(/\bDROP\b/i);
  });
});
