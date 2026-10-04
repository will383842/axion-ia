/**
 * Lot A9 — rattrapage du SIREN des fiches existantes, par migration de DONNÉES.
 *
 * Témoins lus dans le fichier : un seul `UPDATE` sur "clients", qui ne touche
 * que les fiches SANS SIREN dont le SIRET a 14 chiffres (donc idempotent : une
 * seconde passe ne trouve plus rien) ; aucun DROP, aucun DDL ; horodatage
 * postérieur au 20261004210000 réservé par le chantier.
 *
 * Mutation qui fait rougir : retirer `"siren" IS NULL` (un SIREN saisi
 * différent serait écrasé) ou le motif `^[0-9]{14}$`.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(process.cwd(), "prisma", "migrations");
const NOM = readdirSync(RACINE).find((n) => n.endsWith("_siren_deduit_du_siret"));

describe("migration « SIREN déduit du SIRET »", () => {
  it("existe, et est horodatée après 20261004210000", () => {
    expect(NOM).toBeDefined();
    expect(Number(NOM!.slice(0, 14))).toBeGreaterThan(20261004210000);
  });

  const sql = NOM === undefined ? "" : readFileSync(join(RACINE, NOM, "migration.sql"), "utf8");
  const code = sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

  it("un seul UPDATE, borné aux fiches sans SIREN au SIRET de 14 chiffres", () => {
    const compact = code.replace(/\s+/g, " ");
    expect(compact.match(/UPDATE/gi) ?? []).toHaveLength(1);
    expect(compact).toContain(`UPDATE "clients" SET "siren" = left("siret", 9)`);
    expect(compact).toContain(`"siren" IS NULL`);
    expect(compact).toContain(`"siret" ~ '^[0-9]{14}$'`);
  });

  it("aucun DROP, aucune modification de structure, aucune suppression", () => {
    expect(code).not.toMatch(/\b(DROP|ALTER|CREATE|DELETE|TRUNCATE|INSERT)\b/i);
  });
});
