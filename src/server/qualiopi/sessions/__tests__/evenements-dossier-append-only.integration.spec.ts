// @vitest-environment node
/**
 * ADR 0060 — LE JOURNAL DES RÉOUVERTURES EST EN AJOUT SEUL, EN BASE.
 *
 * Deux étages :
 *
 *   1. Sans base (toujours) : la migration crée bien chaque objet déclaré dans
 *      `verrou-dossier-objets-sql.ts`, et la garde de dérive ROUGIT quand le
 *      trigger ou le CHECK disparaît (ou est désactivé).
 *
 *   2. Contre un VRAI Postgres migré à neuf — dans
 *      `tests/integration/verrou-dossier/evenements-dossier-append-only.spec.ts`,
 *      joué par Gate D (`pnpm test:integration`, la seule forme de lancement de
 *      Vitest que `ci.yml` admet hors de « Gate A · couverture ») :
 *      - un UPDATE ou un DELETE sur `session_dossier_evenements` lève ;
 *      - une réouverture au motif de 9 caractères est rejetée par le CHECK ;
 *      - deux réouvertures successives de la même session font DEUX lignes ;
 *      - la garde de dérive, lue dans `pg_trigger` / `pg_constraint`, est verte.
 *    Chaque cas vit dans SA transaction, ANNULÉE : la base reste vide.
 *
 * Un faux client ne prouve rien de tout cela : seul Postgres dit ce qui tient.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MIGRATION_VERROU_DOSSIER,
  OBJETS_SQL_VERROU_DOSSIER,
  fautesDeriveVerrouDossier,
  type ObjetPresent,
} from "../verrou-dossier-objets-sql";

const SQL = readFileSync(
  join(process.cwd(), "prisma", "migrations", MIGRATION_VERROU_DOSSIER, "migration.sql"),
  "utf-8",
);

const TOUS_PRESENTS: ObjetPresent[] = OBJETS_SQL_VERROU_DOSSIER.map((o) => ({
  table: o.table,
  nom: o.nom,
  type: o.type,
  actif: true,
}));

describe("SQL brut du verrou — texte de la migration et garde de dérive (sans base)", () => {
  it("la migration crée chaque objet déclaré, sur sa table", () => {
    const sansCommentaires = SQL.split(/\r?\n/)
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    for (const o of OBJETS_SQL_VERROU_DOSSIER) {
      const motif =
        o.type === "check"
          ? new RegExp(`ALTER TABLE "${o.table}" ADD CONSTRAINT "${o.nom}" CHECK`)
          : new RegExp(`CREATE TRIGGER "${o.nom}"[^;]*ON "${o.table}"`);
      expect(sansCommentaires, `${o.type} ${o.nom}`).toMatch(motif);
    }
  });

  it("le CHECK porte le seuil de 10 caractères sur un motif débarrassé de ses espaces", () => {
    expect(SQL).toMatch(/char_length\(btrim\(coalesce\("motif", ''\)\)\) >= 10/);
  });

  it("la migration est ADDITIVE : ni DROP, ni RENAME, ni lock_timeout", () => {
    const code = SQL.split(/\r?\n/)
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(code).not.toMatch(/\bDROP\b/i);
    expect(code).not.toMatch(/\bRENAME\b/i);
    expect(code).not.toMatch(/lock_timeout/i);
    expect(code).not.toMatch(/ALTER TYPE/i);
  });

  it("garde de dérive : verte quand tout est là", () => {
    expect(fautesDeriveVerrouDossier(TOUS_PRESENTS)).toEqual([]);
  });

  it("🔴 garde de dérive : ROUGIT si le trigger d'ajout seul disparaît", () => {
    const sansTrigger = TOUS_PRESENTS.filter(
      (p) => p.nom !== "session_dossier_evenements_ajout_seul",
    );
    expect(fautesDeriveVerrouDossier(sansTrigger).join("\n")).toMatch(
      /ABSENT en base : trigger:session_dossier_evenements\.session_dossier_evenements_ajout_seul/,
    );
  });

  it("🔴 garde de dérive : ROUGIT si le CHECK du motif disparaît", () => {
    const sansCheck = TOUS_PRESENTS.filter((p) => p.type !== "check");
    expect(fautesDeriveVerrouDossier(sansCheck).join("\n")).toMatch(
      /ABSENT en base : check:session_dossier_evenements\.session_dossier_evenements_motif_reouverture/,
    );
  });

  it("🔴 garde de dérive : ROUGIT si le trigger est DÉSACTIVÉ (ALTER TABLE … DISABLE TRIGGER)", () => {
    const desactive = TOUS_PRESENTS.map((p) =>
      p.nom === "session_dossier_evenements_ajout_seul" ? { ...p, actif: false } : p,
    );
    expect(fautesDeriveVerrouDossier(desactive).join("\n")).toMatch(/DÉSACTIVÉ/);
  });

  it("garde de dérive : un objet NON déclaré sur la table est signalé", () => {
    const enTrop = [
      ...TOUS_PRESENTS,
      {
        table: "session_dossier_evenements",
        nom: "sournois",
        type: "trigger" as const,
        actif: true,
      },
    ];
    expect(fautesDeriveVerrouDossier(enTrop).join("\n")).toMatch(
      /NON DÉCLARÉ : trigger:session_dossier_evenements\.sournois/,
    );
  });
});
