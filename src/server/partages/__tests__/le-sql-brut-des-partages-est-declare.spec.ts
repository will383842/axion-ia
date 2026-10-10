// @vitest-environment node

/**
 * LE SQL BRUT DES FICHIERS PARTAGÉS EST DÉCLARÉ, ET SA DÉRIVE SE VOIT (ADR 0065, modèle ADR 0063).
 *
 * Les CHECK et triggers des quatre tables du lot L4 sont invisibles à
 * `prisma migrate diff`. Une migration qui les retirerait rendrait les fichiers
 * supprimables sans que rien ne rougisse : d'où le registre `objets-sql.ts`.
 * Contre-témoins : la garde de dérive rougit pour un objet ABSENT, DÉSACTIVÉ
 * ou NON DÉCLARÉ. La migration est ADDITIVE.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  MIGRATION_PARTAGES,
  OBJETS_SQL_PARTAGES,
  fautesDerivePartages,
  type ObjetPresentPartages,
} from "../objets-sql";

const sql = readFileSync(
  path.join(process.cwd(), "prisma/migrations", MIGRATION_PARTAGES, "migration.sql"),
  "utf8",
);
const actif = sql
  .split(/\r?\n/)
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

function tousPresents(): ObjetPresentPartages[] {
  return OBJETS_SQL_PARTAGES.map((o) => ({
    table: o.table,
    nom: o.nom,
    type: o.type,
    ...(o.type === "trigger" ? { actif: true } : {}),
  }));
}

describe("le SQL brut des fichiers partagés est déclaré", () => {
  it("le registre déclare les vingt objets, sans doublon", () => {
    expect(OBJETS_SQL_PARTAGES).toHaveLength(20);
    expect(new Set(OBJETS_SQL_PARTAGES.map((o) => o.nom)).size).toBe(20);
  });

  it("la migration crée chaque objet déclaré, sur la table déclarée", () => {
    for (const o of OBJETS_SQL_PARTAGES) {
      const motif =
        o.type === "trigger"
          ? new RegExp(`CREATE TRIGGER "${o.nom}"[^;]*?ON "${o.table}"`)
          : new RegExp(`ALTER TABLE "${o.table}" ADD CONSTRAINT "${o.nom}" CHECK`);
      expect(actif, o.nom).toMatch(motif);
    }
  });

  it("tout CHECK ou trigger créé par la migration est déclaré (rien d'oublié)", () => {
    const declares = new Set(OBJETS_SQL_PARTAGES.map((o) => o.nom));
    const crees = [
      ...[...actif.matchAll(/ADD CONSTRAINT "([a-z0-9_]+)" CHECK/g)].map((m) => m[1]!),
      ...[...actif.matchAll(/CREATE (?:CONSTRAINT )?TRIGGER "([a-z_]+)"/g)].map((m) => m[1]!),
    ];
    expect(crees.length).toBe(20);
    for (const nom of crees) expect(declares.has(nom), nom).toBe(true);
  });

  it("la migration est additive : ni DROP, ni ALTER COLUMN, ni écriture de données", () => {
    expect(actif).not.toMatch(/\bDROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT|TRIGGER|FUNCTION)\b/i);
    expect(actif).not.toMatch(/\bALTER\s+COLUMN\b/i);
    expect(actif).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+"|DELETE\s+FROM)\b/i);
  });

  it("la suppression d'un fichier est refusée par la base (hors effacement RGPD manuel)", () => {
    expect(actif).toMatch(/fichiers_partages : un fichier ne se supprime pas/);
    expect(actif).toMatch(
      /CREATE TRIGGER "fichiers_partages_immuable" BEFORE UPDATE OR DELETE ON "fichiers_partages"/,
    );
    // liens_partage : PAS d'anti-DELETE, pour que la cascade d'un effacement manuel passe.
    expect(actif).toMatch(
      /CREATE TRIGGER "liens_partage_reecriture_limitee" BEFORE UPDATE ON "liens_partage"/,
    );
  });

  it("la garde de dérive est muette quand tout est là", () => {
    expect(fautesDerivePartages(tousPresents())).toEqual([]);
  });

  it("contre-témoin : elle rougit pour un trigger absent, désactivé, ou un objet non déclaré", () => {
    const sans = tousPresents().filter((o) => o.nom !== "fichiers_partages_immuable");
    expect(fautesDerivePartages(sans).join("\n")).toMatch(/ABSENT.*fichiers_partages_immuable/);
    const desactive = tousPresents().map((o) =>
      o.nom === "liens_partage_acces_ajout_seul" ? { ...o, actif: false } : o,
    );
    expect(fautesDerivePartages(desactive).join("\n")).toMatch(/DÉSACTIVÉ/);
    const intrus = [
      ...tousPresents(),
      { table: "fichiers_partages", nom: "porte_derobee", type: "trigger" as const, actif: true },
    ];
    expect(fautesDerivePartages(intrus).join("\n")).toMatch(/NON DÉCLARÉ/);
    const fk = [
      ...tousPresents(),
      { table: "liens_partage", nom: "liens_partage_application_id_fkey", type: "fk" as const },
    ];
    expect(fautesDerivePartages(fk)).toEqual([]);
  });
});
