// @vitest-environment node

/**
 * LE SQL BRUT DES DOCUMENTS EST DÉCLARÉ, ET SA DÉRIVE SE VOIT (ADR 0063, modèle ADR 0060).
 *
 * Prisma n'exprime ni CHECK, ni trigger, ni clé composée DEFERRABLE : ceux de
 * `documents_projet*` vivent en SQL brut, invisibles à `prisma migrate diff`.
 * Une migration qui les retirerait rendrait les documents supprimables SANS
 * QUE RIEN NE ROUGISSE. D'où le registre `objets-sql.ts`, lu ici (texte de la
 * migration) et en Gate D (catalogue `pg_constraint` / `pg_trigger`).
 *
 * Contre-témoins : la garde de dérive rougit pour un objet ABSENT, DÉSACTIVÉ
 * ou NON DÉCLARÉ.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  MIGRATION_DOCUMENTS_PROJET,
  OBJETS_SQL_DOCUMENTS_PROJET,
  fautesDeriveDocumentsProjet,
  type ObjetPresent,
} from "../objets-sql";

const sql = readFileSync(
  path.join(process.cwd(), "prisma/migrations", MIGRATION_DOCUMENTS_PROJET, "migration.sql"),
  "utf8",
);

function tousPresents(): ObjetPresent[] {
  return OBJETS_SQL_DOCUMENTS_PROJET.map((o) => ({
    table: o.table,
    nom: o.nom,
    type: o.type,
    ...(o.type === "trigger" ? { actif: true } : {}),
  }));
}

describe("le SQL brut des documents est déclaré", () => {
  it("le registre déclare les vingt objets de l'architecture", () => {
    expect(OBJETS_SQL_DOCUMENTS_PROJET).toHaveLength(20);
    expect(new Set(OBJETS_SQL_DOCUMENTS_PROJET.map((o) => o.nom)).size).toBe(20);
  });

  it("la migration crée chaque objet déclaré, sur la table déclarée", () => {
    for (const o of OBJETS_SQL_DOCUMENTS_PROJET) {
      const motif =
        o.type === "trigger"
          ? new RegExp(`CREATE (CONSTRAINT )?TRIGGER "${o.nom}"[^;]*?ON "${o.table}"`) // sans traverser l'instruction suivante
          : new RegExp(
              `ALTER TABLE "${o.table}" ADD CONSTRAINT "${o.nom}" ${o.type === "fk" ? "FOREIGN KEY" : "CHECK"}`,
            );
      expect(sql, o.nom).toMatch(motif);
    }
  });

  it("toute contrainte ou trigger créé par la migration est déclaré (rien d'oublié)", () => {
    const declares = new Set(OBJETS_SQL_DOCUMENTS_PROJET.map((o) => o.nom));
    const crees = [
      ...[
        ...sql.matchAll(
          /ADD CONSTRAINT "(documents_projet[a-z0-9_]*)" (CHECK|FOREIGN KEY \("projet_id")/g,
        ),
      ].map((m) => m[1]!),
      ...[...sql.matchAll(/CREATE (?:CONSTRAINT )?TRIGGER "([a-z_]+)"/g)].map((m) => m[1]!),
    ];
    expect(crees.length).toBeGreaterThanOrEqual(20);
    for (const nom of crees) expect(declares.has(nom), nom).toBe(true);
  });

  it("la garde de dérive est muette quand tout est là", () => {
    expect(fautesDeriveDocumentsProjet(tousPresents())).toEqual([]);
  });

  it("contre-témoin : elle rougit pour un trigger absent, désactivé, ou un objet non déclaré", () => {
    const sansTrigger = tousPresents().filter((o) => o.nom !== "documents_projet_immuable");
    expect(fautesDeriveDocumentsProjet(sansTrigger).join("\n")).toMatch(
      /ABSENT.*documents_projet_immuable/,
    );
    const desactive = tousPresents().map((o) =>
      o.nom === "documents_projet_contenus_immuable" ? { ...o, actif: false } : o,
    );
    expect(fautesDeriveDocumentsProjet(desactive).join("\n")).toMatch(/DÉSACTIVÉ/);
    const intrus = [
      ...tousPresents(),
      {
        table: "documents_projet",
        nom: "documents_projet_porte_derobee",
        type: "trigger" as const,
        actif: true,
      },
    ];
    expect(fautesDeriveDocumentsProjet(intrus).join("\n")).toMatch(/NON DÉCLARÉ/);
  });
});
