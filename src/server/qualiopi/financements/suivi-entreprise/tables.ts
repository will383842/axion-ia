/**
 * Lot OPCO A8 — les tables du suivi sont-elles DÉJÀ posées ?
 *
 * 🔴 `AGENTS.md` — deux conteneurs, deux vitesses : le WORKER atterrit ~50 min
 * avant l'app, et c'est l'entrypoint de l'APP qui migre. Pendant cette fenêtre,
 * le passage quotidien et les règles d'alerte (tous deux dans le worker)
 * connaissent `opco_suivi_entreprise` sur une base qui ne l'a pas : une requête
 * casserait, et, côté alertes, le fail-soft de l'évaluateur suspendrait la
 * résolution automatique de TOUTES les alertes ce tour-là. La lecture se rend
 * donc conditionnelle (même doctrine que `adaptation/colonne-declaration.ts`).
 *
 * ⚠️ Seul le OUI est mis en cache : mettre le NON en cache figerait le
 * processus sur l'état d'avant-migration.
 */

import { prisma } from "@/lib/prisma";

let vuesPresentes = false;

export async function tablesSuiviDisponibles(): Promise<boolean> {
  if (vuesPresentes) return true;
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return false;
  try {
    const lignes = await prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n
      FROM information_schema.tables
      WHERE table_name IN ('opco_suivi_entreprise', 'opco_suivi_messages')`;
    vuesPresentes = lignes[0]?.n === 2;
  } catch (err) {
    console.error(
      "[suivi-entreprise-opco] présence des tables non vérifiable :",
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
  return vuesPresentes;
}

/** Réservé aux tests. */
export function oublierPresenceTables(): void {
  vuesPresentes = false;
}
