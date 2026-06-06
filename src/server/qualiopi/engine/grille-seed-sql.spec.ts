/**
 * Anti-drift — le seed SQL runtime de la grille qualité (appliqué au boot par
 * docker-entrypoint.sh via prisma/migrations_fts/*.sql) DOIT rester strictement
 * aligné sur la SSOT DEFAULT_GRILLE_CRITERES. Sinon la grille seedée en prod
 * divergerait de la grille de référence du code (et du seed tsx local).
 *
 * Contexte : audit Qualiopi E2E 2026-06-06 — la grille était créée VIDE par
 * migrate deploy (DDL only) et seedée uniquement par `pnpm qualiopi:seed` (tsx,
 * absent du runtime). Ce fichier SQL comble le trou de déploiement.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { DEFAULT_GRILLE_CRITERES } from "./grille-schema";

const SQL_PATH = join(
  process.cwd(),
  "prisma",
  "migrations_fts",
  "20260606300000_qualiopi_grille_seed.sql",
);

describe("seed SQL runtime de la grille qualité", () => {
  const sql = readFileSync(SQL_PATH, "utf8");

  it("contient un INSERT idempotent (ON CONFLICT DO NOTHING) sur la clé unique", () => {
    expect(sql).toMatch(/INSERT INTO "grille_qualite_configs"/);
    expect(sql).toMatch(/ON CONFLICT \("cle_unique"\) DO NOTHING/);
    expect(sql).toContain("'grille_qualite_v1'");
  });

  it("seed une grille ACTIVE avec score plancher 80 et 3 passes", () => {
    // Les 5 valeurs scalaires post-JSON : 80, 3, true, 1 (prompt_version), timestamps.
    expect(sql).toMatch(/\$json\$::jsonb,\s*80,\s*3,\s*true,\s*1,/);
  });

  it("le tableau de critères JSON est identique à DEFAULT_GRILLE_CRITERES (anti-drift)", () => {
    const match = sql.match(/\$json\$([\s\S]*?)\$json\$/);
    const jsonText = match?.[1] ?? "";
    expect(jsonText.length, "bloc $json$...$json$ introuvable dans le SQL").toBeGreaterThan(0);
    const parsed = JSON.parse(jsonText);
    expect(parsed).toEqual(DEFAULT_GRILLE_CRITERES);
  });
});
