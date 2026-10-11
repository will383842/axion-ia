// @vitest-environment node

/**
 * LE SQL BRUT DU PAIEMENT PAR MISSION EST DÉCLARÉ, ADDITIF, ET SA DÉRIVE SE VOIT
 * (schéma n° 2 du chantier formateurs freelance : M-C « expand », M-E, M-F).
 *
 * Sans base : lit le texte de `MIGRATION_FORMATEURS_PAIEMENT` et vérifie
 *   · que la migration est la DERNIÈRE du dépôt, datée après le schéma n° 1 ;
 *   · que chaque objet déclaré (CHECK, trigger, index partiel) est créé, sur sa
 *     table, et que rien de créé n'échappe au registre ;
 *   · que chaque index partiel est le texte EXACT de `SQL_INDEX_PAIEMENT` (la
 *     clause d'occupation est dérivée de `STATUT_RELEVE_LIBERE`, jamais recopiée) ;
 *   · qu'elle est ADDITIVE (aucun DROP, RENAME, changement de type, NOT NULL
 *     posé sur des données) — et en particulier que M-D N'Y EST PAS : l'unique
 *     historique `statement_unique_trainer_periode` reste, dans la base ET dans
 *     le schéma Prisma ;
 *   · qu'elle ne touche ni `commissions_apporteur`, ni aucune table apporteur ;
 *   · que le stock est revendiqué par le texte EXACT exporté, AVANT les triggers
 *     d'ajout seul.
 *
 * La preuve en base est `tests/integration/formateurs-paiement/`.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { MIGRATION_FORMATEURS_SOCLE } from "../socle-objets-sql";
import {
  MIGRATION_FORMATEURS_PAIEMENT,
  OBJETS_SQL_PAIEMENT_FORMATEURS,
  SQL_INDEX_PAIEMENT,
  SQL_REVENDIQUER_STOCK_MENSUEL,
  STATUTS_RELEVE_OCCUPANTS,
  fautesDerivePaiementFormateurs,
  type ObjetPresentPaiement,
} from "../paiement-objets-sql";

const DOSSIER = path.join(process.cwd(), "prisma/migrations");
const FICHIER = path.join(DOSSIER, MIGRATION_FORMATEURS_PAIEMENT, "migration.sql");
const SQL = existsSync(FICHIER) ? readFileSync(FICHIER, "utf8") : "";
const SCHEMA = readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");

/** Le texte actif : commentaires `--` retirés. */
const ACTIF = SQL.split(/\r?\n/)
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

const espaces = (s: string): string => s.replace(/\s+/g, " ").trim();

function tousPresents(): ObjetPresentPaiement[] {
  return OBJETS_SQL_PAIEMENT_FORMATEURS.map((o) => ({
    table: o.table,
    nom: o.nom,
    type: o.type,
    ...(o.type === "trigger" ? { actif: true } : {}),
    ...(o.type === "index"
      ? {
          definition: `CREATE UNIQUE INDEX ${o.nom} ON public.${o.table} WHERE ${o.definitionContient}`,
        }
      : {}),
  }));
}

describe("migration du paiement par mission (schéma n° 2)", () => {
  it("existe, est la dernière du dépôt, datée après le schéma n° 1", () => {
    expect(existsSync(FICHIER), FICHIER).toBe(true);
    expect(MIGRATION_FORMATEURS_PAIEMENT > MIGRATION_FORMATEURS_SOCLE).toBe(true);
    const datees = readdirSync(DOSSIER)
      .filter((n) => /^\d{14}_/.test(n))
      .sort();
    expect(datees.at(-1)).toBe(MIGRATION_FORMATEURS_PAIEMENT);
  });

  it("crée chaque objet déclaré, sur la table déclarée", () => {
    for (const o of OBJETS_SQL_PAIEMENT_FORMATEURS) {
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
    const declares = new Set(OBJETS_SQL_PAIEMENT_FORMATEURS.map((o) => o.nom));
    const crees = [
      ...[...ACTIF.matchAll(/ADD CONSTRAINT "([^"]+)" CHECK/g)].map((m) => m[1]!),
      ...[...ACTIF.matchAll(/CREATE (?:CONSTRAINT )?TRIGGER "([^"]+)"/g)].map((m) => m[1]!),
      ...[...ACTIF.matchAll(/CREATE UNIQUE INDEX "([^"]+)"[^;]*WHERE/g)].map((m) => m[1]!),
    ];
    expect(crees.length).toBe(OBJETS_SQL_PAIEMENT_FORMATEURS.length);
    for (const nom of crees) expect(declares.has(nom), nom).toBe(true);
  });

  it("chaque index partiel est le texte EXACT du registre", () => {
    const actif = espaces(ACTIF);
    for (const [nom, texte] of Object.entries(SQL_INDEX_PAIEMENT)) {
      expect(actif, nom).toContain(espaces(texte));
    }
  });

  it("la clause d'occupation est dérivée : seul `annule` libère une place", () => {
    expect(STATUTS_RELEVE_OCCUPANTS).not.toContain("annule");
    expect([...STATUTS_RELEVE_OCCUPANTS].sort()).toEqual(
      ["a_valider", "brouillon", "facture_recue", "paye", "valide"].sort(),
    );
    const relevesEtLignes = Object.values(SQL_INDEX_PAIEMENT).filter(
      (t) => t.includes('"statut"') && /ON "trainer_(statements|fee_lines)"/.test(t),
    );
    expect(relevesEtLignes.length).toBeGreaterThan(5);
    for (const texte of relevesEtLignes) {
      expect(texte).toContain(`"statut" <> 'annule'`);
    }
  });

  it("est ADDITIVE : aucun DROP, aucun RENAME, aucun changement de type, aucun NOT NULL posé", () => {
    expect(ACTIF).not.toMatch(/\bDROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT|TRIGGER|VALUE)\b/i);
    expect(ACTIF).not.toMatch(/\bRENAME\b/i);
    expect(ACTIF).not.toMatch(/\bALTER\s+COLUMN\b/i);
    expect(ACTIF).not.toMatch(/\bSET\s+NOT\s+NULL\b/i);
    expect(ACTIF).not.toMatch(/\b(UPDATE|DELETE\s+FROM|TRUNCATE)\s+"/i);
    // Une colonne NOT NULL ajoutée porte TOUJOURS un défaut (aucune donnée réécrite).
    for (const m of ACTIF.matchAll(/ADD COLUMN\s+"[^"]+"[^,;]*NOT NULL[^,;]*/g)) {
      expect(m[0], m[0]).toMatch(/DEFAULT/);
    }
  });

  it("M-D N'EST PAS ICI : l'unique historique reste, en base comme dans le schéma", () => {
    expect(ACTIF).not.toContain("statement_unique_trainer_periode");
    expect(SCHEMA).toMatch(
      /@@unique\(\[trainerId, periodeYear, periodeMonth\], map: "statement_unique_trainer_periode"\)/,
    );
  });

  it("ne touche aucune table des apporteurs (la trace L12j vit dans sa propre table)", () => {
    expect(ACTIF).not.toMatch(/ALTER TABLE "commissions_apporteur"/);
    expect(ACTIF).not.toMatch(/ALTER TABLE "(apporteurs?_[a-z_]+|[a-z_]*apporteur[a-z_]*)"/);
  });

  it("revendique le stock avec le texte EXACT, avant les triggers d'ajout seul", () => {
    const actif = espaces(ACTIF);
    const remplissage = espaces(SQL_REVENDIQUER_STOCK_MENSUEL);
    expect(actif).toContain(remplissage);
    expect(actif.indexOf(remplissage)).toBeLessThan(
      actif.indexOf('CREATE TRIGGER "revendications_paiement_ajout_seul"'),
    );
    // Quel que soit le statut du relevé : seule la LIGNE annulée est écartée.
    expect(SQL_REVENDIQUER_STOCK_MENSUEL).not.toMatch(/trainer_statements/);
    expect(SQL_REVENDIQUER_STOCK_MENSUEL).toContain(`fl."statut" <> 'annule'`);
    expect(SQL_REVENDIQUER_STOCK_MENSUEL).toContain(`t."statut" = 'sous_traitant'`);
  });
});

describe("garde de dérive du paiement par mission", () => {
  it("muette quand tout est là", () => {
    expect(fautesDerivePaiementFormateurs(tousPresents())).toEqual([]);
  });

  it("contre-témoin : absent, désactivé, non déclaré, clause partielle perdue", () => {
    const sans = tousPresents().filter((o) => o.nom !== "revendications_paiement_ajout_seul");
    expect(fautesDerivePaiementFormateurs(sans).join("\n")).toMatch(
      /ABSENT.*revendications_paiement_ajout_seul/,
    );
    const desactive = tousPresents().map((o) =>
      o.nom === "revendications_paiement_ajout_seul" ? { ...o, actif: false } : o,
    );
    expect(fautesDerivePaiementFormateurs(desactive).join("\n")).toMatch(/DÉSACTIVÉ/);
    const intrus = [
      ...tousPresents(),
      {
        table: "revendications_paiement",
        nom: "porte_derobee",
        type: "trigger" as const,
        actif: true,
      },
    ];
    expect(fautesDerivePaiementFormateurs(intrus).join("\n")).toMatch(/NON DÉCLARÉ/);
    const globale = tousPresents().map((o) =>
      o.nom === "trainer_fee_lines_indemnite_annulation_unique"
        ? {
            ...o,
            definition:
              "CREATE UNIQUE INDEX trainer_fee_lines_indemnite_annulation_unique ON trainer_fee_lines (trainer_id, session_id)",
          }
        : o,
    );
    expect(fautesDerivePaiementFormateurs(globale).join("\n")).toMatch(/SANS sa clause/);
  });
});
