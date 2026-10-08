/**
 * Corrige, dans les textes déjà générés et stockés en base, les anciennes formules à prix erronés
 * (2026-10-08) : remplace SEULEMENT le montant et le nom de formule par la valeur de la matrice
 * (`formules-erronees-regles.ts`). Ne supprime rien. Idempotent : un second passage ne change rien.
 *
 *   # 1. ESSAI À BLANC (par défaut) : n'écrit rien, montre chaque avant → après.
 *   DATABASE_URL=… pnpm exec tsx scripts/tarifs/corriger-formules-erronees.ts
 *
 *   # 2. Application, après validation de Will : sauvegarde d'abord chaque valeur d'origine dans
 *   #    un fichier JSON (restaurable), puis écrit ligne par ligne.
 *   DATABASE_URL=… pnpm exec tsx scripts/tarifs/corriger-formules-erronees.ts --appliquer --sauvegarde avant.json
 *
 * ⚠️ À ne lancer qu'après la fusion de la PR qui supprime les formules, et avec l'accord de Will.
 */
import { writeFileSync } from "node:fs";

import { PrismaClient } from "../../prisma/generated/client";

import { COLONNES, MOTIF_SQL, corrigerJson, corrigerTexte } from "./formules-erronees-regles";

interface Correction {
  table: string;
  id: string;
  colonne: string;
  json: boolean;
  avant: unknown;
  apres: unknown;
  changements: string[];
}

export async function calculerCorrections(prisma: PrismaClient): Promise<Correction[]> {
  const out: Correction[] = [];
  for (const { table, colonnes } of COLONNES) {
    for (const c of colonnes) {
      const filtre = c.json ? `"${c.nom}"::text ~ $1` : `"${c.nom}" ~ $1`;
      let lignes: Array<{ id: string; valeur: unknown }>;
      try {
        lignes = await prisma.$queryRawUnsafe(
          `SELECT id::text AS id, "${c.nom}" AS valeur FROM "${table}" WHERE ${filtre}`,
          MOTIF_SQL,
        );
      } catch (err) {
        console.warn(
          `[corriger] ${table}.${c.nom} illisible : ${(err as Error).message.split("\n")[0]}`,
        );
        continue;
      }
      for (const l of lignes) {
        if (l.valeur === null || l.valeur === undefined) continue;
        const r = c.json
          ? corrigerJson(l.valeur)
          : (() => {
              const t = corrigerTexte(String(l.valeur));
              return { valeur: t.texte, changements: t.changements };
            })();
        if (r.changements.length === 0) continue;
        out.push({
          table,
          id: l.id,
          colonne: c.nom,
          json: c.json === true,
          avant: l.valeur,
          apres: r.valeur,
          changements: [...new Set(r.changements)],
        });
      }
    }
  }
  return out;
}

function apercu(v: unknown): string {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 400 ? `${s.slice(0, 400)}…` : s;
}

async function main(): Promise<void> {
  const appliquer = process.argv.includes("--appliquer");
  const iSauv = process.argv.indexOf("--sauvegarde");
  const sauvegarde = iSauv > 0 ? process.argv[iSauv + 1] : undefined;
  if (appliquer && !sauvegarde) {
    console.error("[corriger] --appliquer exige --sauvegarde <fichier.json> (valeurs d'origine).");
    process.exit(2);
  }
  const prisma = new PrismaClient();
  try {
    const corrections = await calculerCorrections(prisma);
    for (const c of corrections) {
      console.warn(`\n— ${c.table} ${c.id} [${c.colonne}] (${c.changements.join(", ")})`);
      console.warn(`  AVANT : ${apercu(c.avant)}`);
      console.warn(`  APRÈS : ${apercu(c.apres)}`);
    }
    console.warn(`\n[corriger] ${corrections.length} valeur(s) à corriger.`);
    if (!appliquer) {
      console.warn(
        "[corriger] ESSAI À BLANC : rien n'a été écrit. Ajoutez --appliquer --sauvegarde <f>.",
      );
      return;
    }
    writeFileSync(sauvegarde!, JSON.stringify(corrections, null, 2), "utf8");
    console.warn(`[corriger] sauvegarde des valeurs d'origine : ${sauvegarde}`);
    let n = 0;
    for (const c of corrections) {
      // Écriture CONDITIONNELLE : seulement si la valeur n'a pas bougé depuis la lecture.
      const r = c.json
        ? await prisma.$executeRawUnsafe(
            `UPDATE "${c.table}" SET "${c.colonne}" = $1::jsonb WHERE id::text = $2 AND "${c.colonne}" = $3::jsonb`,
            JSON.stringify(c.apres),
            c.id,
            JSON.stringify(c.avant),
          )
        : await prisma.$executeRawUnsafe(
            `UPDATE "${c.table}" SET "${c.colonne}" = $1 WHERE id::text = $2 AND "${c.colonne}" = $3`,
            c.apres,
            c.id,
            c.avant,
          );
      if (r === 1) n++;
      else
        console.warn(
          `[corriger] ${c.table} ${c.id} [${c.colonne}] a changé entre-temps : laissé tel quel.`,
        );
    }
    console.warn(`[corriger] ${n}/${corrections.length} valeur(s) corrigée(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes("corriger-formules-erronees")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
