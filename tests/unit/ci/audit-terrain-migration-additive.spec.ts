/**
 * AUDIT PRÉSENTIEL, PR1 — la migration des tables `audit_terrain_*` est ADDITIVE.
 * Compatible avec les DEUX conteneurs (app et worker) : trois tables neuves,
 * aucune énumération Postgres, aucune colonne sur une table existante, aucun
 * DROP/DELETE/UPDATE. Le journal des événements est en ajout seul (triggers).
 * Le retour arrière est un fichier à part, jamais joué par `prisma migrate deploy`,
 * transactionnel, verrouillé, et il refuse si une table n'est pas vide.
 *
 * Chaque règle a son CONTRE-TÉMOIN : un texte muté qui doit faire rougir la même fonction.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RACINE } from "./sources-du-circuit-visio";

const NOM = "20261102210000_audit_terrain_tables";
const DOSSIER = path.join(RACINE, "prisma", "migrations", NOM);
const TABLES = ["audit_terrain_sessions", "audit_terrain_evenements", "audit_terrain_rapports"];

const lireSql = (f: string): string => readFileSync(path.join(DOSSIER, f), "utf8");
const sansCommentaires = (sql: string): string => sql.replace(/--.*$/gm, "");

/** Nom de table sans guillemets, schéma ni casse. */
const nomTable = (brut: string): string =>
  brut
    .replace(/^public\./i, "")
    .replace(/"/g, "")
    .toLowerCase();

/** Retire les corps de fonctions ($fn$…$fn$ / $$…$$) et les CREATE TRIGGER, vérifiés à part. */
function sansCorpsNiTriggers(sql: string): string {
  return sql.replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, " ").replace(/CREATE\s+TRIGGER[\s\S]*?;/gi, " ");
}

/** Tables visées par une instruction, quelle que soit la forme (ONLY, IF EXISTS, guillemets, casse). */
function tablesVisees(sql: string): string[] {
  const id = String.raw`((?:"?public"?\.)?"?[A-Za-z0-9_]+"?)`;
  const motifs = [
    new RegExp(String.raw`ALTER\s+TABLE\s+(?:ONLY\s+)?(?:IF\s+EXISTS\s+)?${id}`, "gi"),
    new RegExp(
      String.raw`CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?"?[A-Za-z0-9_]+"?\s+ON\s+(?:ONLY\s+)?${id}`,
      "gi",
    ),
    new RegExp(String.raw`CREATE\s+TRIGGER[\s\S]*?\sON\s+${id}`, "gi"),
    new RegExp(String.raw`CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?${id}`, "gi"),
    new RegExp(String.raw`REFERENCES\s+${id}`, "gi"),
    new RegExp(String.raw`COMMENT\s+ON\s+\w+\s+${id}`, "gi"),
  ];
  return motifs.flatMap((re) => [...sql.matchAll(re)].map((m) => nomTable(m[1] as string)));
}

/** Fautes de la migration (liste vide = additive). */
function fautesMigration(brut: string): string[] {
  const fautes: string[] = [];
  const sql = sansCommentaires(brut);
  const corps = sansCorpsNiTriggers(sql).replace(/ON\s+(DELETE|UPDATE)\s+(RESTRICT|CASCADE)/gi, "");
  if (/\b(DROP|DELETE|UPDATE|TRUNCATE|INSERT|CREATE\s+TYPE|ALTER\s+TYPE)\b/i.test(corps)) {
    fautes.push("instruction destructrice ou d'écriture");
  }
  if (/ON\s+DELETE\s+CASCADE/i.test(sql)) fautes.push("clé étrangère en cascade");
  // Une instruction sur une table EXISTANTE (hors les trois neuves et celles qu'une FK référence).
  const existantes = ["clients", "audit_missions", "admin_users"];
  for (const t of tablesVisees(sql)) {
    if (!TABLES.includes(t) && !existantes.includes(t)) fautes.push(`table inattendue : ${t}`);
  }
  // Aucune instruction (hors FK) ne vise une table existante : REFERENCES seul est permis.
  const sansReferences = sql.replace(/REFERENCES\s+\S+/gi, " ");
  for (const t of tablesVisees(sansReferences)) {
    if (!TABLES.includes(t)) fautes.push(`instruction sur une table existante : ${t}`);
  }
  const creees = [
    ...sql.matchAll(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:"?public"?\.)?"?[A-Za-z0-9_]+"?)/gi,
    ),
  ]
    .map((m) => nomTable(m[1] as string))
    .sort();
  if (JSON.stringify(creees) !== JSON.stringify([...TABLES].sort())) {
    fautes.push(`tables créées : ${creees.join(",")}`);
  }
  return fautes;
}

/** Fautes du retour arrière (liste vide = complet). */
function fautesRollback(brut: string): string[] {
  const fautes: string[] = [];
  const sql = sansCommentaires(brut);
  if (!/^\s*BEGIN\s*;/i.test(sql)) fautes.push("BEGIN absent");
  if (!/COMMIT\s*;\s*$/i.test(sql)) fautes.push("COMMIT absent");
  if (!/DO\s+\$\$[\s\S]*RAISE\s+EXCEPTION[\s\S]*\$\$\s*;/i.test(sql)) {
    fautes.push("bloc DO / RAISE EXCEPTION absent");
  }
  const lock = sql.search(/LOCK\s+TABLE[\s\S]*?IN\s+ACCESS\s+EXCLUSIVE\s+MODE/i);
  const doBloc = sql.search(/DO\s+\$\$/i);
  if (lock < 0) fautes.push("LOCK TABLE … ACCESS EXCLUSIVE absent");
  else if (doBloc >= 0 && lock > doBloc) fautes.push("LOCK TABLE après le bloc DO");
  const drops = [...sql.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?"([a-z_]+)"/gi)]
    .map((m) => m[1])
    .sort();
  if (JSON.stringify(drops) !== JSON.stringify([...TABLES].sort())) {
    fautes.push(`DROP TABLE : ${drops.join(",")}`);
  }
  const fonctions = [...sql.matchAll(/DROP\s+FUNCTION\s+"([a-z_]+)"/gi)].map((m) => m[1]).sort();
  if (
    !fonctions.includes("audit_terrain_ajout_seul") ||
    !fonctions.includes("audit_terrain_rapports_garde")
  ) {
    fautes.push("DROP FUNCTION des deux fonctions de trigger absent");
  }
  if (/\b(DELETE|TRUNCATE)\b/i.test(sql.replace(/\$\$[\s\S]*?\$\$/g, " "))) {
    fautes.push("DELETE/TRUNCATE dans le retour arrière");
  }
  return fautes;
}

describe("migration audit_terrain_* : additive seulement", () => {
  it("la migration existe, crée exactement les trois tables et ne touche rien d'autre", () => {
    expect(existsSync(path.join(DOSSIER, "migration.sql"))).toBe(true);
    expect(fautesMigration(lireSql("migration.sql"))).toEqual([]);
  });

  it("les triggers d'ajout seul existent (événements : UPDATE/DELETE/TRUNCATE ; rapports : garde)", () => {
    const sql = sansCommentaires(lireSql("migration.sql"));
    expect(sql).toMatch(
      /CREATE TRIGGER "audit_terrain_evenements_ajout_seul" BEFORE UPDATE OR DELETE ON "audit_terrain_evenements"/,
    );
    expect(sql).toMatch(/BEFORE TRUNCATE ON "audit_terrain_evenements"/);
    expect(sql).toMatch(
      /CREATE TRIGGER "audit_terrain_rapports_garde" BEFORE UPDATE OR DELETE ON "audit_terrain_rapports"/,
    );
    expect(sql).toMatch(/BEFORE TRUNCATE ON "audit_terrain_rapports"/);
  });

  it("le retour arrière existe, hors de migration.sql, transactionnel, verrouillé et à vide seulement", () => {
    expect(existsSync(path.join(DOSSIER, "rollback.sql"))).toBe(true);
    expect(fautesRollback(lireSql("rollback.sql"))).toEqual([]);
  });

  it("le schéma Prisma déclare les trois modèles, annotés RGPD, contenu en colonnes chiffrées", () => {
    const schema = readFileSync(path.join(RACINE, "prisma", "schema.prisma"), "utf8");
    for (const [modele, table] of [
      ["AuditTerrainSession", TABLES[0]],
      ["AuditTerrainEvenement", TABLES[1]],
      ["AuditTerrainRapport", TABLES[2]],
    ] as const) {
      const re = new RegExp(
        String.raw`(///[^\n]*\n)+model ${modele} \{[\s\S]*?@@map\("${table}"\)`,
      );
      const bloc = re.exec(schema)?.[0] ?? "";
      expect(bloc, modele).toContain("rgpd: dossier-client");
    }
    expect(schema).toMatch(/donneesChiffrees\s+String/);
    expect(schema).toMatch(/contenuChiffre\s+String/);
  });
});

describe("contre-témoins : la garde rougit quand on mute", () => {
  const rb = lireSql("rollback.sql");
  const mig = lireSql("migration.sql");

  it("retirer BEGIN, COMMIT, le bloc DO/RAISE, le LOCK ou un DROP FUNCTION rougit le retour arrière", () => {
    const sansBegin = rb.replace(/^BEGIN;$/m, "");
    const sansCommit = rb.replace(/^COMMIT;$/m, "");
    const sansDo = rb.replace(/RAISE EXCEPTION/g, "RAISE NOTICE");
    const sansDoTotal = rb.replace(/DO \$\$[\s\S]*?END \$\$;/, "");
    const sansLock = rb.replace(/^LOCK TABLE.*$/m, "");
    const sansFonction = rb.replace(/^DROP FUNCTION "audit_terrain_ajout_seul"\(\);$/m, "");
    expect(fautesRollback(sansBegin)).toContain("BEGIN absent");
    expect(fautesRollback(sansCommit)).toContain("COMMIT absent");
    expect(fautesRollback(sansDo)).toContain("bloc DO / RAISE EXCEPTION absent");
    expect(fautesRollback(sansDoTotal)).toContain("bloc DO / RAISE EXCEPTION absent");
    expect(fautesRollback(sansLock)).toContain("LOCK TABLE … ACCESS EXCLUSIVE absent");
    expect(fautesRollback(sansFonction)).toContain(
      "DROP FUNCTION des deux fonctions de trigger absent",
    );
  });

  it("un LOCK placé après le bloc DO rougit", () => {
    const lockLigne = /^LOCK TABLE.*$/m.exec(rb)?.[0] ?? "";
    const deplace = rb.replace(lockLigne, "").replace("DROP TABLE", `${lockLigne}\nDROP TABLE`);
    expect(fautesRollback(deplace)).toContain("LOCK TABLE après le bloc DO");
  });

  it("la migration mutée rougit : ALTER, INDEX, DROP, minuscules, ONLY, IF EXISTS, sans guillemets", () => {
    const cas = [
      'ALTER TABLE "clients" ADD COLUMN "x" INT;',
      'alter table "clients" add column x int;',
      "ALTER TABLE ONLY clients ADD COLUMN x INT;",
      'ALTER TABLE IF EXISTS public."clients" ADD COLUMN x INT;',
      'ALTER TABLE ONLY IF EXISTS "audit_missions" ADD COLUMN x INT;',
      'CREATE INDEX "i" ON "clients"("id");',
      "create unique index if not exists i on only public.admin_users(id);",
      'DROP TABLE "clients";',
      'update "clients" set numero = numero;',
      "CREATE TYPE x AS ENUM ('a');",
      'CREATE TRIGGER t BEFORE UPDATE ON "clients" FOR EACH ROW EXECUTE FUNCTION f();',
      'ALTER TABLE "audit_terrain_sessions" DROP COLUMN "statut";',
      'ALTER TABLE "audit_terrain_sessions" ADD CONSTRAINT c FOREIGN KEY (a) REFERENCES "clients"("id") ON DELETE CASCADE;',
    ];
    for (const c of cas) {
      expect(fautesMigration(`${mig}\n${c}\n`), c).not.toEqual([]);
    }
    expect(
      fautesMigration(mig.replace(/CREATE TABLE "audit_terrain_rapports"/, 'CREATE TABLE "autre"')),
    ).not.toEqual([]);
  });
});
