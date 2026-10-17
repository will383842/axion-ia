// @vitest-environment node

/**
 * CHANTIER QNC, L00 — LE SQL BRUT DU SOCLE EST DÉCLARÉ, ET SA DÉRIVE SE VOIT
 * (modèle : `src/server/partages/__tests__/le-sql-brut-des-partages-est-declare.spec.ts`).
 *
 * Sans base : la migration crée chaque objet déclaré, rien de non déclaré, elle
 * est ADDITIVE (ni DROP, ni RENAME, ni reprise de données) et horodatée après
 * 20261015180000 ; les migrations postérieures ne touchent pas au socle. La garde de dérive rougit pour un objet ABSENT, DÉSACTIVÉ
 * ou NON DÉCLARÉ. La preuve sur une vraie base est en Gate D
 * (`tests/integration/verrou-dossier/socle-qnc-ajout-seul.spec.ts`).
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { QUALIOPI_CONFIG_REGISTRY } from "@/server/qualiopi/config/registry";

import {
  FONCTIONS_SQL_SOCLE_QNC,
  MIGRATION_SOCLE_QNC,
  OBJETS_SQL_SOCLE_QNC,
  TABLES_AJOUT_SEUL,
  TRIGGERS_SOUS_INTERRUPTEUR,
  fautesDeriveSocleQnc,
  type ObjetPresentSocle,
} from "../objets-sql";

const DOSSIER = path.join(process.cwd(), "prisma/migrations");
const sql = readFileSync(path.join(DOSSIER, MIGRATION_SOCLE_QNC, "migration.sql"), "utf8");
/** Le SQL sans ses commentaires de ligne. */
const actif = sql
  .split(/\r?\n/)
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

function tousPresents(): ObjetPresentSocle[] {
  return OBJETS_SQL_SOCLE_QNC.map((o) => ({
    table: o.table,
    nom: o.nom,
    type: o.type,
    ...(o.type === "trigger" ? { actif: true } : {}),
  }));
}

/** Les noms que le socle déclare : tables, triggers, CHECK et fonctions. */
const NOMS_DU_SOCLE = [
  ...TABLES_AJOUT_SEUL,
  ...Object.keys(TRIGGERS_SOUS_INTERRUPTEUR),
  ...OBJETS_SQL_SOCLE_QNC.map((o) => o.nom),
  ...FONCTIONS_SQL_SOCLE_QNC,
];

/**
 * Ce qu'une migration ULTÉRIEURE ne doit pas faire au socle : éteindre ou
 * altérer un trigger, supprimer / modifier / réécrire l'un de ses objets déclarés.
 */
function fautesMigrationSurSocle(contenu: string): string[] {
  const instructions = contenu
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((i) => i.trim())
    .filter(Boolean);
  const fautes: string[] = [];
  for (const i of instructions) {
    if (/\b(DISABLE|ALTER)\s+TRIGGER\b/i.test(i)) {
      fautes.push(`éteint ou altère un trigger : ${i.slice(0, 80)}`);
      continue;
    }
    const touche =
      /^(DROP|ALTER|TRUNCATE|UPDATE|DELETE|CREATE\s+(OR\s+REPLACE\s+)?(TRIGGER|FUNCTION))\b/i.test(
        i,
      );
    const nom = NOMS_DU_SOCLE.find((n) =>
      new RegExp(`(?<![A-Za-z0-9_])${n}(?![A-Za-z0-9_])`).test(i),
    );
    if (touche && nom) fautes.push(`modifie « ${nom} » du socle : ${i.slice(0, 80)}`);
  }
  return fautes;
}

describe("le SQL brut du socle QNC est déclaré", () => {
  it("le registre déclare 29 objets sans doublon : 20 triggers d'ajout seul, 6 CHECK, 3 triggers éteints", () => {
    expect(OBJETS_SQL_SOCLE_QNC).toHaveLength(29);
    expect(new Set(OBJETS_SQL_SOCLE_QNC.map((o) => o.nom)).size).toBe(29);
    for (const t of TABLES_AJOUT_SEUL) {
      expect(OBJETS_SQL_SOCLE_QNC.map((o) => o.nom)).toEqual(
        expect.arrayContaining([`${t}_ajout_seul`, `${t}_pas_de_truncate`]),
      );
    }
  });

  it("la migration crée chaque objet déclaré, sur la table déclarée", () => {
    for (const o of OBJETS_SQL_SOCLE_QNC) {
      const motif =
        o.type === "trigger"
          ? new RegExp(`CREATE TRIGGER "${o.nom}"[^;]*?ON "${o.table}"`)
          : new RegExp(`ALTER TABLE "${o.table}" ADD CONSTRAINT "${o.nom}" CHECK`);
      expect(actif, o.nom).toMatch(motif);
    }
    for (const f of FONCTIONS_SQL_SOCLE_QNC) {
      expect(actif, f).toMatch(new RegExp(`CREATE FUNCTION "${f}"\\(`));
    }
  });

  it("tout CHECK ou trigger créé par la migration est déclaré (rien d'oublié)", () => {
    const declares = new Set(OBJETS_SQL_SOCLE_QNC.map((o) => o.nom));
    const crees = [
      ...actif.matchAll(/CREATE TRIGGER "([^"]+)"/g),
      ...actif.matchAll(/ADD CONSTRAINT "([^"]+)" CHECK/g),
    ].map((m) => m[1] as string);
    expect(crees.length).toBe(29);
    for (const nom of crees) expect(declares.has(nom), nom).toBe(true);
  });

  it("les journaux en ajout seul partagent la fonction qui refuse, sans condition", () => {
    for (const t of TABLES_AJOUT_SEUL) {
      expect(actif).toMatch(
        new RegExp(
          `CREATE TRIGGER "${t}_ajout_seul" BEFORE UPDATE OR DELETE ON "${t}"\\s+FOR EACH ROW EXECUTE FUNCTION "qualiopi_ajout_seul"\\(\\)`,
        ),
      );
      expect(actif).toMatch(
        new RegExp(
          `CREATE TRIGGER "${t}_pas_de_truncate" BEFORE TRUNCATE ON "${t}"\\s+FOR EACH STATEMENT EXECUTE FUNCTION "qualiopi_ajout_seul"\\(\\)`,
        ),
      );
    }
  });

  it("les triggers posés éteints lisent chacun SA clé `qualiopi.<lot>.actif`", () => {
    expect(actif).toContain(
      `"qualiopi_interrupteur_etat"('${TRIGGERS_SOUS_INTERRUPTEUR.veilles}')`,
    );
    expect(actif).toContain(
      `"qualiopi_interrupteur_etat"('${TRIGGERS_SOUS_INTERRUPTEUR.revues_direction}')`,
    );
  });

  it("la migration est ADDITIVE : ni DROP, ni RENAME, ni reprise de données", () => {
    expect(actif).not.toMatch(/\bDROP\b/i);
    expect(actif).not.toMatch(/\bRENAME\b/i);
    // Une instruction qui COMMENCE par UPDATE / DELETE / INSERT / TRUNCATE
    // réécrirait des données existantes (les triggers, eux, disent « BEFORE … »).
    expect(actif).not.toMatch(/^\s*(UPDATE|DELETE|INSERT|TRUNCATE)\b/im);
    expect(actif).not.toMatch(/ON DELETE CASCADE/);
  });

  it("aucune valeur n'est ajoutée à une énumération existante (pas de migration d'enum séparée requise)", () => {
    expect(actif).not.toMatch(/ALTER TYPE/i);
  });

  it("elle est horodatée après 20261015180000, la dernière migration de main à sa création", () => {
    expect(MIGRATION_SOCLE_QNC.slice(0, 14) > "20261015180000").toBe(true);
  });

  it("toute migration horodatée APRÈS le socle laisse intacts ses tables, triggers et fonctions", () => {
    const apres = readdirSync(DOSSIER)
      .filter((n) => /^\d{14}_/.test(n) && n > MIGRATION_SOCLE_QNC)
      .sort();
    const fautes = apres.flatMap((nom) =>
      fautesMigrationSurSocle(readFileSync(path.join(DOSSIER, nom, "migration.sql"), "utf8")).map(
        (f) => `${nom} : ${f}`,
      ),
    );
    expect(fautes).toEqual([]);
  });

  it("le détecteur voit bien une atteinte au socle (et laisse passer le reste)", () => {
    expect(
      fautesMigrationSurSocle('DROP TRIGGER "relances_journal_ajout_seul" ON "relances_journal";'),
    ).not.toEqual([]);
    expect(
      fautesMigrationSurSocle('ALTER TABLE "questionnaire_versions" DISABLE TRIGGER ALL;'),
    ).not.toEqual([]);
    expect(fautesMigrationSurSocle('ALTER TABLE "veilles" ADD COLUMN "x" TEXT;')).not.toEqual([]);
    expect(fautesMigrationSurSocle('DROP FUNCTION "qualiopi_ajout_seul"();')).not.toEqual([]);
    expect(fautesMigrationSurSocle('ALTER TABLE "autre" DISABLE TRIGGER "t";')).not.toEqual([]);
    expect(
      fautesMigrationSurSocle(
        '-- DROP TRIGGER "relances_journal_ajout_seul"\nCREATE TABLE "autre" ("id" TEXT);',
      ),
    ).toEqual([]);
    expect(fautesMigrationSurSocle('ALTER TABLE "autre" ADD COLUMN "x" TEXT;')).toEqual([]);
  });

  it("aucun interrupteur `qualiopi.<lot>.actif` n'est inscrit au registre de config (le seed le poserait)", () => {
    const cles = Object.keys(QUALIOPI_CONFIG_REGISTRY);
    expect(cles.filter((k) => /^[a-z0-9_]+\.actif$/.test(k))).toEqual([]);
  });
});

describe("la garde de dérive du socle", () => {
  it("verte quand tout est présent et actif", () => {
    expect(fautesDeriveSocleQnc(tousPresents())).toEqual([]);
  });

  it("rouge pour un objet ABSENT", () => {
    const presents = tousPresents().filter((p) => p.nom !== "remises_retours_ajout_seul");
    expect(fautesDeriveSocleQnc(presents).join("\n")).toMatch(
      /ABSENT en base : trigger:remises_retours\.remises_retours_ajout_seul/,
    );
  });

  it("rouge pour un trigger DÉSACTIVÉ", () => {
    const presents = tousPresents().map((p) =>
      p.nom === "veilles_ajout_seul" ? { ...p, actif: false } : p,
    );
    expect(fautesDeriveSocleQnc(presents).join("\n")).toMatch(
      /DÉSACTIVÉ en base : trigger:veilles\.veilles_ajout_seul/,
    );
  });

  it("rouge pour un objet NON DÉCLARÉ sur un journal (une clé `_fkey` de Prisma passe)", () => {
    const presents = [
      ...tousPresents(),
      { table: "incident_notes", nom: "incident_notes_incident_id_fkey", type: "fk" as const },
      { table: "incident_notes", nom: "incident_notes_bricole", type: "trigger" as const },
    ];
    expect(fautesDeriveSocleQnc(presents)).toEqual([
      "présent en base mais NON DÉCLARÉ : trigger:incident_notes.incident_notes_bricole",
    ]);
  });
});
