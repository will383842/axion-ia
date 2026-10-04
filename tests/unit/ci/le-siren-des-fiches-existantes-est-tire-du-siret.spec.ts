/**
 * Lot A9 — rattrapage du SIREN des fiches existantes, par migration de DONNÉES.
 *
 * Témoins lus dans le fichier : un seul `UPDATE` sur "clients", qui ne touche
 * que les fiches SANS SIREN dont le SIRET a 14 chiffres (donc idempotent : une
 * seconde passe ne trouve plus rien) ; aucun DROP, aucun DDL ; horodatage
 * postérieur au 20261004210000 réservé par le chantier.
 *
 * Mutation qui fait rougir : retirer `"siren" IS NULL` (un SIREN saisi
 * différent serait écrasé), le motif `^[0-9]{14}$`, le refus des valeurs de
 * remplissage, ou l'un des deux contrôles de clé (relecture A09 : sans eux,
 * `00000000000000` donnait le SIREN `000000000`).
 *
 * Ce témoin LIT le fichier ; ce que le SQL ÉCRIT est prouvé contre un vrai
 * Postgres par `tests/integration/siren-deduit-du-siret/` (Gate D).
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

  it("un seul UPDATE, borné aux fiches sans SIREN au SIRET valide", () => {
    const compact = code.replace(/\s+/g, " ");
    expect(compact.match(/UPDATE/gi) ?? []).toHaveLength(1);
    expect(compact).toContain(`UPDATE "clients" c SET "siren" = left(c."siret", 9)`);
    expect(compact).toContain(`c."siren" IS NULL`);
    expect(compact).toContain(`c."siret" ~ '^[0-9]{14}$'`);
    // Valeur de remplissage (même garde que `REPDIGIT` de src/lib/siret.ts).
    expect(compact).toContain(`c."siret" !~ '^([0-9])\\1{13}$'`);
    // Clé du SIRET (14 chiffres), exception La Poste, clé du SIREN (9 chiffres).
    expect(compact).toContain("generate_series(1, 14)");
    expect(compact).toContain(`left(c."siret", 9) = '356000000'`);
    expect(compact).toContain("generate_series(1, 9)");
  });

  it("le témoin contre un vrai Postgres existe et est joué par Gate D", () => {
    const ci = readFileSync(join(process.cwd(), ".github", "workflows", "ci.yml"), "utf8");
    expect(ci).toContain("pnpm test:integration tests/integration/siren-deduit-du-siret");
  });

  it("aucun DROP, aucune modification de structure, aucune suppression", () => {
    expect(code).not.toMatch(/\b(DROP|ALTER|CREATE|DELETE|TRUNCATE|INSERT)\b/i);
  });
});
