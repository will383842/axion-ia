// @vitest-environment node
//
// L12 — États des vidéos et des liens des candidats en LISTES FERMÉES (phase
// « expand », chantier « candidatures unifiées », paquet 4a).
//
// Avant : `job_application_videos.statut` et `job_application_links.etat` sont
// des VARCHAR. « rejete » au lieu de « rejetee » s'écrivait sans un mot, et la
// vidéo disparaissait de la console (qui filtre sur la liste exacte).
//
// Ce que ces tests protègent :
//   · les enums Prisma portent EXACTEMENT les valeurs que le code écrit ;
//   · la migration est ADDITIVE : type + colonne NULLABLE + rattrapage borné
//     à la liste, aucune suppression, ancienne colonne gardée ;
//   · une valeur hors liste est refusée par le TYPAGE (et, en base, par le type
//     Postgres — cf. `tests/integration/etats-candidat/`).

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { EtatLienCandidat, EtatVideoCandidat } from "../../../../prisma/generated/client";
import { ETATS_LIEN_CANDIDAT, ETATS_VIDEO_CANDIDAT, etatLien, etatVideo } from "../etats-candidat";

const RACINE = join(__dirname, "../../../..");
const SCHEMA = readFileSync(join(RACINE, "prisma/schema.prisma"), "utf8");
const MIGRATIONS = join(RACINE, "prisma/migrations");

function valeursEnum(nom: string): string[] {
  const m = SCHEMA.match(new RegExp(`enum ${nom} \\{([^}]*)\\}`));
  if (!m) return [];
  return m[1]!
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"));
}

function modele(nom: string): string {
  const m = SCHEMA.match(new RegExp(`model ${nom} \\{([\\s\\S]*?)\\n\\}`));
  return m?.[1] ?? "";
}

function migrationL12(): { nom: string; sql: string } {
  const noms = readdirSync(MIGRATIONS).filter((n) => /^\d{14}_/.test(n));
  const trouvees = noms.filter((n) => {
    try {
      return readFileSync(join(MIGRATIONS, n, "migration.sql"), "utf8").includes(
        'CREATE TYPE "EtatVideoCandidat"',
      );
    } catch {
      return false;
    }
  });
  expect(trouvees, "une seule migration crée les deux types").toHaveLength(1);
  const nom = trouvees[0]!;
  return { nom, sql: readFileSync(join(MIGRATIONS, nom, "migration.sql"), "utf8") };
}

describe("les valeurs sont celles que le code écrit", () => {
  it("vidéos : envoi → analyse → disponible | rejetee", () => {
    expect([...ETATS_VIDEO_CANDIDAT]).toEqual(["envoi", "analyse", "disponible", "rejetee"]);
    expect(valeursEnum("EtatVideoCandidat")).toEqual([...ETATS_VIDEO_CANDIDAT]);
  });

  it("liens : vivant | mort | inverifiable", () => {
    expect([...ETATS_LIEN_CANDIDAT]).toEqual(["vivant", "mort", "inverifiable"]);
    expect(valeursEnum("EtatLienCandidat")).toEqual([...ETATS_LIEN_CANDIDAT]);
  });

  it("chaque écriture porte les DEUX colonnes, identiques", () => {
    expect(etatVideo("rejetee")).toEqual({ statut: "rejetee", etatFerme: "rejetee" });
    expect(etatLien("mort")).toEqual({ etat: "mort", etatFerme: "mort" });
  });

  it("une valeur hors liste est refusée par le typage", () => {
    // @ts-expect-error — « rejete » n'est pas un état de vidéo.
    const v: EtatVideoCandidat = "rejete";
    // @ts-expect-error — « morte » n'est pas un état de lien.
    const l: EtatLienCandidat = "morte";
    // @ts-expect-error — l'écrivain refuse aussi la faute de frappe.
    etatVideo("dispo");
    expect([v, l]).toHaveLength(2);
  });
});

describe("schéma : colonnes enum NULLABLES, ancienne colonne texte gardée", () => {
  it("job_application_videos", () => {
    const m = modele("JobApplicationVideo");
    expect(m).toMatch(/\n\s+statut\s+String\s+@db\.VarChar\(20\)/);
    expect(m).toMatch(/\n\s+etatFerme\s+EtatVideoCandidat\?\s+@map\("etat_ferme"\)/);
  });

  it("job_application_links", () => {
    const m = modele("JobApplicationLink");
    expect(m).toMatch(/\n\s+etat\s+String\s+@db\.VarChar\(20\)/);
    expect(m).toMatch(/\n\s+etatFerme\s+EtatLienCandidat\?\s+@map\("etat_ferme"\)/);
  });
});

describe("migration ADDITIVE", () => {
  it("horodatée après la dernière migration de main au départ du paquet", () => {
    const { nom } = migrationL12();
    expect(nom.slice(0, 14) > "20261008120000").toBe(true);
  });

  it("crée les types avec la liste exacte, ajoute des colonnes NULLABLES", () => {
    const { sql } = migrationL12();
    expect(sql).toContain(
      `CREATE TYPE "EtatVideoCandidat" AS ENUM (${ETATS_VIDEO_CANDIDAT.map((v) => `'${v}'`).join(", ")});`,
    );
    expect(sql).toContain(
      `CREATE TYPE "EtatLienCandidat" AS ENUM (${ETATS_LIEN_CANDIDAT.map((v) => `'${v}'`).join(", ")});`,
    );
    expect(sql).toMatch(
      /ALTER TABLE "job_application_videos" ADD COLUMN "etat_ferme" "EtatVideoCandidat";/,
    );
    expect(sql).toMatch(
      /ALTER TABLE "job_application_links" ADD COLUMN "etat_ferme" "EtatLienCandidat";/,
    );
  });

  it("rattrapage idempotent, borné à la liste : une valeur inconnue reste NULL", () => {
    const { sql } = migrationL12();
    expect(sql).toContain(
      `UPDATE "job_application_videos" SET "etat_ferme" = "statut"::"EtatVideoCandidat" WHERE "etat_ferme" IS NULL AND "statut" IN (${ETATS_VIDEO_CANDIDAT.map((v) => `'${v}'`).join(", ")});`,
    );
    expect(sql).toContain(
      `UPDATE "job_application_links" SET "etat_ferme" = "etat"::"EtatLienCandidat" WHERE "etat_ferme" IS NULL AND "etat" IN (${ETATS_LIEN_CANDIDAT.map((v) => `'${v}'`).join(", ")});`,
    );
  });

  it("aucune suppression, aucune contrainte NOT NULL", () => {
    const { sql } = migrationL12();
    const code = sql
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(code).not.toMatch(/\b(DROP|DELETE|TRUNCATE|RENAME)\b/i);
    expect(code).not.toMatch(/NOT NULL/i);
  });
});
