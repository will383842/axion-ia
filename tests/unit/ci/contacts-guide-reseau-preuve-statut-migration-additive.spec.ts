/**
 * La migration `contacts_guide_reseau_preuve_statut` (preuve d'accord « en attente » → « confirmée »
 * → « non vérifiée, à l'écart ») est ADDITIVE : trois colonnes NULLABLES et un index. Rien n'est
 * supprimé, renommé ni rendu obligatoire (AGENTS.md « DEUX conteneurs » : l'ancien conteneur, qui
 * ne connaît pas ces colonnes, continue de tourner ; le nouveau lit NULL comme « en attente »).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = join(
  process.cwd(),
  "prisma",
  "migrations",
  "20261112000000_contacts_guide_reseau_preuve_statut",
);
const sansCommentaires = (t: string): string =>
  t
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
const sql = sansCommentaires(readFileSync(join(DOSSIER, "migration.sql"), "utf8"));
const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
const modele = schema.slice(
  schema.indexOf("model ContactGuideReseau {"),
  schema.indexOf('@@map("contacts_guide_reseau")'),
);

describe("migration contacts_guide_reseau_preuve_statut : additive", () => {
  it("ne supprime, ne renomme, ne contraint et n'efface rien", () => {
    for (const re of [
      /\bDROP\b/i,
      /\bDELETE\b/i,
      /\bTRUNCATE\b/i,
      /\bRENAME\b/i,
      /\bALTER COLUMN\b/i,
      /\bSET NOT NULL\b/i,
      /\bCREATE TYPE\b/i,
      /\bALTER TYPE\b/i,
      /\bINSERT\b/i,
    ]) {
      expect(sql).not.toMatch(re);
    }
  });

  it("ne touche que contacts_guide_reseau (et lit guide_requests pour la reprise)", () => {
    expect(sql).not.toMatch(/\bALTER TABLE "(?!contacts_guide_reseau")/i);
    expect(sql).not.toMatch(/\bUPDATE "(?!contacts_guide_reseau")/i);
  });

  it("n'écrit que les trois nouvelles colonnes", () => {
    const sets = [...sql.matchAll(/\bSET\s+([\s\S]*?)(?:\bFROM\b|\bWHERE\b)/gi)].map((m) => m[1]!);
    expect(sets.length).toBeGreaterThan(0);
    for (const s of sets) {
      const colonnes = [...s.matchAll(/"([a-z_]+)"\s*=/g)].map((m) => m[1]!);
      for (const c of colonnes) {
        expect(["preuve_statut", "preuve_confirmee_le", "preuve_ecartee_le"]).toContain(c);
      }
    }
  });

  it("ajoute trois colonnes NULLABLES et l'index (statut, consenti_le)", () => {
    expect(sql).toMatch(/ADD COLUMN "preuve_statut"\s+VARCHAR\(16\)(?!\s+NOT NULL)/);
    expect(sql).toMatch(/ADD COLUMN "preuve_confirmee_le"\s+TIMESTAMPTZ\(3\)(?!\s+NOT NULL)/);
    expect(sql).toMatch(/ADD COLUMN "preuve_ecartee_le"\s+TIMESTAMPTZ\(3\)(?!\s+NOT NULL)/);
    expect(sql).toContain('CREATE INDEX "contacts_guide_reseau_preuve_statut_consenti_le_idx"');
  });

  it("le schéma Prisma porte les mêmes colonnes, nullables, et l'index", () => {
    expect(modele).toMatch(
      /preuveStatut\s+String\?\s+@map\("preuve_statut"\)\s+@db\.VarChar\(16\)/,
    );
    expect(modele).toMatch(
      /preuveConfirmeeLe\s+DateTime\?\s+@map\("preuve_confirmee_le"\)\s+@db\.Timestamptz\(3\)/,
    );
    expect(modele).toMatch(
      /preuveEcarteeLe\s+DateTime\?\s+@map\("preuve_ecartee_le"\)\s+@db\.Timestamptz\(3\)/,
    );
    expect(modele).toContain('map: "contacts_guide_reseau_preuve_statut_consenti_le_idx"');
  });

  it("ne touche pas merci_statut", () => {
    expect(sql).not.toContain("merci_statut");
  });
});
