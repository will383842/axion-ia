// @vitest-environment node

/**
 * LE SQL BRUT DU SOCLE FORMATEURS EST DÉCLARÉ, ADDITIF, ET SA DÉRIVE SE VOIT
 * (schéma n° 1 du chantier formateurs freelance ; modèle ADR 0063).
 *
 * Sans base : lit le texte de `MIGRATION_FORMATEURS_SOCLE` et vérifie
 *   · que chaque objet déclaré (CHECK, trigger, index partiel) est créé, sur sa
 *     table, et que rien de créé n'échappe au registre ;
 *   · que la migration est ADDITIVE (aucun DROP, aucun RENAME, aucun
 *     changement de type de colonne) ;
 *   · que chaque `ALTER TYPE … ADD VALUE` est une instruction seule, et que la
 *     valeur ajoutée n'est UTILISÉE nulle part ailleurs dans la migration
 *     (PostgreSQL refuse d'utiliser une valeur ajoutée dans la même transaction) ;
 *   · que le remplissage de `nature_collaboration` est le texte EXACT exporté
 *     par `nature-collaboration-sql.ts` — celui que le test d'intégration
 *     compare au prédicat TypeScript ;
 *   · que le stock actif est marqué `anterieure_au_controle`.
 *
 * La preuve en base (`pg_constraint`, `pg_trigger`, `pg_indexes`) est
 * `tests/integration/formateurs-socle/`.
 *
 * Contre-témoins : la garde de dérive rougit pour un objet ABSENT, DÉSACTIVÉ,
 * NON DÉCLARÉ, ou un index qui a perdu sa clause partielle.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  SQL_REMPLIR_NATURE_CANDIDATURES_DEPUIS_OFFRE,
  SQL_REMPLIR_NATURE_CANDIDATURES_SPONTANEES,
  SQL_REMPLIR_NATURE_OFFRES,
} from "@/lib/careers/nature-collaboration-sql";
import {
  MIGRATION_FORMATEURS_SOCLE,
  OBJETS_SQL_SOCLE_FORMATEURS,
  SQL_STOCK_ACTIF_ANTERIEUR_AU_CONTROLE,
  fautesDeriveSocleFormateurs,
  type ObjetPresentSocle,
} from "../socle-objets-sql";

const FICHIER = path.join(
  process.cwd(),
  "prisma/migrations",
  MIGRATION_FORMATEURS_SOCLE,
  "migration.sql",
);
const SQL = existsSync(FICHIER) ? readFileSync(FICHIER, "utf8") : "";

/** Le texte actif : commentaires `--` retirés. */
const ACTIF = SQL.split(/\r?\n/)
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

const espaces = (s: string): string => s.replace(/\s+/g, " ").trim();

/** Les valeurs d'énumération que le lot AJOUTE à des types existants. */
const VALEURS_AJOUTEES: ReadonlyArray<readonly [string, string]> = [
  ["MissionFormateurStatut", "desistee"],
  ["SessionFormateurRetraitMotif", "desistement_formateur"],
  ["SessionFormateurRetraitMotif", "formateur_desactive"],
  ["TrainerDocumentType", "recepisse_declaration_activite"],
  ["TrainerDocumentType", "rib"],
];

function tousPresents(): ObjetPresentSocle[] {
  return OBJETS_SQL_SOCLE_FORMATEURS.map((o) => ({
    table: o.table,
    nom: o.nom,
    type: o.type,
    ...(o.type === "trigger" ? { actif: true } : {}),
    ...(o.type === "index"
      ? { definition: `CREATE UNIQUE INDEX ${o.nom} ON public.${o.table} ${o.definitionContient}` }
      : {}),
  }));
}

describe("migration du socle formateurs", () => {
  it("la migration existe, horodatée après 20261010100100", () => {
    expect(existsSync(FICHIER), FICHIER).toBe(true);
    expect(MIGRATION_FORMATEURS_SOCLE > "20261010100100").toBe(true);
  });

  it("crée chaque objet déclaré, sur la table déclarée", () => {
    for (const o of OBJETS_SQL_SOCLE_FORMATEURS) {
      const motif =
        o.type === "trigger"
          ? new RegExp(`CREATE (CONSTRAINT )?TRIGGER "${o.nom}"[^;]*?ON "${o.table}"`)
          : o.type === "index"
            ? new RegExp(`CREATE UNIQUE INDEX "${o.nom}" ON "${o.table}"[^;]*WHERE`)
            : new RegExp(`ALTER TABLE "${o.table}" ADD CONSTRAINT "${o.nom}" CHECK`);
      expect(ACTIF, o.nom).toMatch(motif);
    }
  });

  it("tout CHECK, trigger ou index partiel créé est déclaré (rien d'oublié)", () => {
    const declares = new Set(OBJETS_SQL_SOCLE_FORMATEURS.map((o) => o.nom));
    const crees = [
      ...[...ACTIF.matchAll(/ADD CONSTRAINT "([^"]+)" CHECK/g)].map((m) => m[1]!),
      ...[...ACTIF.matchAll(/CREATE (?:CONSTRAINT )?TRIGGER "([^"]+)"/g)].map((m) => m[1]!),
      ...[...ACTIF.matchAll(/CREATE UNIQUE INDEX "([^"]+)"[^;]*WHERE/g)].map((m) => m[1]!),
    ];
    expect(crees.length).toBe(OBJETS_SQL_SOCLE_FORMATEURS.length);
    for (const nom of crees) expect(declares.has(nom), nom).toBe(true);
  });

  it("est ADDITIVE : aucun DROP, aucun RENAME, aucun changement de type", () => {
    expect(ACTIF).not.toMatch(/\bDROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT|TRIGGER|VALUE)\b/i);
    expect(ACTIF).not.toMatch(/\bRENAME\b/i);
    expect(ACTIF).not.toMatch(/\bALTER\s+COLUMN\b[^;]*\bTYPE\b/i);
    expect(ACTIF).not.toMatch(/\bSET\s+NOT\s+NULL\b/i);
  });

  it("chaque ADD VALUE est seul dans son instruction, et la valeur n'est pas utilisée ailleurs", () => {
    const instructions = ACTIF.split(";").map(espaces);
    for (const [type, valeur] of VALEURS_AJOUTEES) {
      const attendu = `ALTER TYPE "${type}" ADD VALUE IF NOT EXISTS '${valeur}'`;
      expect(instructions, attendu).toContain(attendu);
      const usages = instructions.filter((i) => i.includes(`'${valeur}'`));
      expect(usages, `'${valeur}' utilisée hors de son ADD VALUE`).toEqual([attendu]);
    }
    const toutes = instructions.filter((i) => /ADD VALUE/.test(i));
    expect(toutes.length).toBe(VALEURS_AJOUTEES.length);
  });

  it("remplit nature_collaboration avec le texte EXACT comparé au prédicat TypeScript", () => {
    const actif = espaces(ACTIF);
    expect(actif).toContain(espaces(SQL_REMPLIR_NATURE_OFFRES));
    expect(actif).toContain(espaces(SQL_REMPLIR_NATURE_CANDIDATURES_DEPUIS_OFFRE));
    expect(actif).toContain(espaces(SQL_REMPLIR_NATURE_CANDIDATURES_SPONTANEES));
    // L'offre d'abord, la candidature ensuite : elle copie la valeur de son offre.
    expect(actif.indexOf(espaces(SQL_REMPLIR_NATURE_OFFRES))).toBeLessThan(
      actif.indexOf(espaces(SQL_REMPLIR_NATURE_CANDIDATURES_DEPUIS_OFFRE)),
    );
  });

  it("marque le stock ACTIF « antérieure au contrôle », avant de poser le CHECK", () => {
    const actif = espaces(ACTIF);
    const update = espaces(SQL_STOCK_ACTIF_ANTERIEUR_AU_CONTROLE);
    expect(actif).toContain(update);
    expect(actif.indexOf(update)).toBeLessThan(
      actif.indexOf('ADD CONSTRAINT "trainers_activation_coherente"'),
    );
  });
});

describe("garde de dérive du socle", () => {
  it("muette quand tout est là", () => {
    expect(fautesDeriveSocleFormateurs(tousPresents())).toEqual([]);
  });

  it("contre-témoin : absent, désactivé, non déclaré, clause partielle perdue", () => {
    const sans = tousPresents().filter((o) => o.nom !== "preuves_vigilance_ajout_seul");
    expect(fautesDeriveSocleFormateurs(sans).join("\n")).toMatch(
      /ABSENT.*preuves_vigilance_ajout_seul/,
    );
    const desactive = tousPresents().map((o) =>
      o.nom === "verifications_registre_sous_traitance_ajout_seul" ? { ...o, actif: false } : o,
    );
    expect(fautesDeriveSocleFormateurs(desactive).join("\n")).toMatch(/DÉSACTIVÉ/);
    const intrus = [
      ...tousPresents(),
      { table: "preuves_vigilance", nom: "porte_derobee", type: "trigger" as const, actif: true },
    ];
    expect(fautesDeriveSocleFormateurs(intrus).join("\n")).toMatch(/NON DÉCLARÉ/);
    const globale = tousPresents().map((o) =>
      o.nom === "trainers_email_ouverte_unique"
        ? {
            ...o,
            definition: "CREATE UNIQUE INDEX trainers_email_ouverte_unique ON trainers (email)",
          }
        : o,
    );
    expect(fautesDeriveSocleFormateurs(globale).join("\n")).toMatch(/SANS sa clause/);
  });
});
