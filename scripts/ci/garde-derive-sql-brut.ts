#!/usr/bin/env tsx
/**
 * Gate D — GARDE DE DÉRIVE DU SQL BRUT du chantier visio (PR 2 ; plan §3.3 g).
 *
 * Après `prisma migrate deploy` sur une base NEUVE, lit ce qui existe
 * réellement (`pg_indexes`, `pg_constraint`, `pg_trigger`) et le compare à la
 * liste unique `prisma/objets-sql-bruts.ts` :
 *
 *   1. chaque objet déclaré EXISTE, sur sa table, avec son type ;
 *   2. sur les tables du chantier, aucun objet NON déclaré n'existe (hors
 *      ceux que Prisma génère : `_pkey`, `_key`, `_idx`, `_fkey`) ;
 *   3. l'index `enregistrements_un_actif` nomme exactement les états de
 *      `ETATS_ENREGISTREMENT_ACTIFS`.
 *
 * Pourquoi en base et pas seulement dans le texte de la migration : un objet
 * peut être écrit et ne jamais être créé (faute de syntaxe avalée, bloc
 * commenté, ordre des instructions). Seule la base dit ce qui tient.
 *
 * Mutation qui fait rougir : retirer `CREATE UNIQUE INDEX
 * "comptes_rendus_un_valide"` de la migration → « déclaré mais absent ».
 *
 * Code de sortie : 0 si tout concorde, 1 sinon (lu par la CI).
 */

import { PrismaClient } from "../../prisma/generated/client";
import {
  OBJETS_SQL_BRUTS,
  TABLES_DU_CHANTIER,
  type ObjetSqlBrut,
} from "../../prisma/objets-sql-bruts";
import { ETATS_ENREGISTREMENT_ACTIFS } from "../../src/server/visio/etats";

type Present = { table: string; nom: string; type: ObjetSqlBrut["type"] };

const GENERE_PAR_PRISMA = /_(pkey|key|idx|fkey)$/;

async function lirePresents(
  db: PrismaClient,
): Promise<{ presents: Present[]; defs: Map<string, string> }> {
  const index = await db.$queryRaw<
    Array<{ tablename: string; indexname: string; indexdef: string }>
  >`
    SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'`;
  const contraintes = await db.$queryRaw<
    Array<{ tablename: string; conname: string; contype: string }>
  >`
    SELECT c.relname AS tablename, k.conname, k.contype::text AS contype
    FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND k.contype IN ('c', 'f')`;
  const triggers = await db.$queryRaw<Array<{ tablename: string; tgname: string }>>`
    SELECT c.relname AS tablename, t.tgname
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal`;

  const presents: Present[] = [
    ...index.map((i) => ({ table: i.tablename, nom: i.indexname, type: "index" as const })),
    ...contraintes.map((k) => ({
      table: k.tablename,
      nom: k.conname,
      type: k.contype === "c" ? ("check" as const) : ("fk" as const),
    })),
    ...triggers.map((t) => ({ table: t.tablename, nom: t.tgname, type: "trigger" as const })),
  ];
  const defs = new Map(index.map((i) => [i.indexname, i.indexdef]));
  return { presents, defs };
}

async function main(): Promise<void> {
  const db = new PrismaClient();
  try {
    const { presents, defs } = await lirePresents(db);
    const cle = (o: { table: string; nom: string; type: string }): string =>
      `${o.type}:${o.table}.${o.nom}`;
    const ensemblePresents = new Set(presents.map(cle));
    const ensembleDeclares = new Set(OBJETS_SQL_BRUTS.map(cle));
    const fautes: string[] = [];

    // 1. Déclarés → présents.
    for (const o of OBJETS_SQL_BRUTS) {
      if (!ensemblePresents.has(cle(o))) fautes.push(`déclaré mais ABSENT en base : ${cle(o)}`);
    }

    // 2. Présents sur les tables du chantier → déclarés (hors objets Prisma).
    const tables = new Set<string>(TABLES_DU_CHANTIER);
    for (const p of presents) {
      if (!tables.has(p.table)) continue;
      if (ensembleDeclares.has(cle(p))) continue;
      if ((p.type === "index" || p.type === "fk") && GENERE_PAR_PRISMA.test(p.nom)) continue;
      fautes.push(`présent en base mais NON DÉCLARÉ dans prisma/objets-sql-bruts.ts : ${cle(p)}`);
    }

    // 3. L'index des enregistrements actifs suit la constante.
    const def = defs.get("enregistrements_un_actif") ?? "";
    for (const etat of ETATS_ENREGISTREMENT_ACTIFS) {
      if (!def.includes(`'${etat}'`)) {
        fautes.push(`enregistrements_un_actif ne nomme pas l'état actif « ${etat} » : ${def}`);
      }
    }
    const nbDansIndex = (def.match(/'[a-z_]+'/g) ?? []).length;
    if (def !== "" && nbDansIndex !== ETATS_ENREGISTREMENT_ACTIFS.length) {
      fautes.push(
        `enregistrements_un_actif nomme ${nbDansIndex} états, la constante ${ETATS_ENREGISTREMENT_ACTIFS.length} : ${def}`,
      );
    }

    console.log(
      `[visio] dérive du SQL brut : ${OBJETS_SQL_BRUTS.length} objets déclarés, ` +
        `${presents.filter((p) => tables.has(p.table)).length} objets lus sur ${tables.size} tables du chantier`,
    );
    if (fautes.length > 0) {
      for (const f of fautes) console.error(`::error::${f}`);
      process.exit(1);
    }
    console.log("[visio] dérive du SQL brut : aucune dérive");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error("::error::garde de dérive du SQL brut —", err instanceof Error ? err.message : err);
  process.exit(1);
});
