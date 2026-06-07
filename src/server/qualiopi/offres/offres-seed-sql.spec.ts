/**
 * Anti-drift — le seed SQL runtime des offres (prisma/migrations_fts/...offres_seed.sql,
 * appliqué au boot) DOIT rester aligné sur OFFRES_SEED (SSOT prisma/seeds/qualiopi/offres.ts).
 *
 * Contexte : fix seed prod 2026-06-07 — le seed tsx ne tourne pas dans le runtime
 * standalone (offreSite=0 constaté en prod) ; on seed les offres par SQL au boot
 * comme la grille. OffreSite ne stocke pas les prix → pas de duplication pricing.ts.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { OFFRES_SEED } from "../../../../prisma/seeds/qualiopi/offres";

const SQL_PATH = join(
  process.cwd(),
  "prisma",
  "migrations_fts",
  "20260607000000_qualiopi_offres_seed.sql",
);

describe("seed SQL offres == OFFRES_SEED (anti-drift)", () => {
  const sql = readFileSync(SQL_PATH, "utf8");

  it("idempotent (ON CONFLICT tier_id DO NOTHING)", () => {
    expect(sql).toMatch(/ON CONFLICT \("tier_id"\) DO NOTHING/);
  });

  it("contient chaque offre (code AXI-OFF-NNN + tierId + slug + format)", () => {
    OFFRES_SEED.forEach((o, i) => {
      const code = `AXI-OFF-${String(i + 1).padStart(3, "0")}`;
      expect(sql, `code ${code}`).toContain(`'${code}'`);
      expect(sql, `tierId ${o.tierId}`).toContain(`'${o.tierId}'`);
      expect(sql, `slug ${o.slug}`).toContain(`'${o.slug}'`);
      expect(sql, `format ${o.formatPedagogique}`).toContain(`'${o.formatPedagogique}'`);
    });
  });

  it("le nombre de lignes VALUES == OFFRES_SEED.length", () => {
    const rows = (sql.match(/uuid_generate_v4\(\)/g) ?? []).length;
    expect(rows).toBe(OFFRES_SEED.length);
  });
});
