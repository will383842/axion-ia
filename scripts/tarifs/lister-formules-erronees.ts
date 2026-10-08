/**
 * LECTURE SEULE — liste les textes déjà générés et stockés en base qui citent encore une ancienne
 * formule à prix erroné (2026-10-08) : table, identifiant, colonne, extrait.
 *
 *   DATABASE_URL=… pnpm exec tsx scripts/tarifs/lister-formules-erronees.ts [--csv chemin.csv]
 *
 * N'écrit RIEN en base. Le correctif est `corriger-formules-erronees.ts` (essai à blanc par défaut).
 */
import { writeFileSync } from "node:fs";

import { PrismaClient } from "../../prisma/generated/client";

import { COLONNES, MOTIF_SQL, contientFormuleErronee, extrait } from "./formules-erronees-regles";

export interface Trace {
  table: string;
  id: string;
  colonne: string;
  extrait: string;
}

/** Les traces, table par table. Les noms de tables et de colonnes viennent d'une liste FERMÉE. */
export async function listerTraces(prisma: PrismaClient): Promise<Trace[]> {
  const traces: Trace[] = [];
  for (const { table, colonnes } of COLONNES) {
    for (const c of colonnes) {
      const expr = c.json ? `"${c.nom}"::text` : `"${c.nom}"`;
      let lignes: Array<{ id: string; valeur: string | null }>;
      try {
        lignes = await prisma.$queryRawUnsafe(
          `SELECT id::text AS id, ${expr} AS valeur FROM "${table}" WHERE ${expr} ~ $1`,
          MOTIF_SQL,
        );
      } catch (err) {
        // Table ou colonne absente (base plus ancienne) : on le dit, on continue.
        console.warn(
          `[lister] ${table}.${c.nom} illisible : ${(err as Error).message.split("\n")[0]}`,
        );
        continue;
      }
      for (const l of lignes) {
        if (!l.valeur || !contientFormuleErronee(l.valeur)) continue;
        traces.push({ table, id: l.id, colonne: c.nom, extrait: extrait(l.valeur) });
      }
    }
  }
  return traces;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const traces = await listerTraces(prisma);
    for (const t of traces) console.warn(`${t.table}\t${t.id}\t${t.colonne}\t${t.extrait}`);
    const parTable = new Map<string, number>();
    for (const t of traces) parTable.set(t.table, (parTable.get(t.table) ?? 0) + 1);
    console.warn(`\n[lister] ${traces.length} trace(s) :`);
    for (const [t, n] of parTable) console.warn(`  ${t} : ${n}`);
    const i = process.argv.indexOf("--csv");
    if (i > 0 && process.argv[i + 1]) {
      const csv = [
        "table;id;colonne;extrait",
        ...traces.map((t) =>
          [t.table, t.id, t.colonne, `"${t.extrait.replace(/"/g, '""')}"`].join(";"),
        ),
      ].join("\n");
      writeFileSync(process.argv[i + 1]!, csv, "utf8");
      console.warn(`[lister] écrit : ${process.argv[i + 1]}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes("lister-formules-erronees")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
