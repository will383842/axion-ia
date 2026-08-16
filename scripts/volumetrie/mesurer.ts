#!/usr/bin/env tsx
/**
 * T0 / Lot 0 — Mesure les lectures admin CONTRE la fixture volumétrique.
 *
 * Rejoue les **vraies** fonctions de lecture (pas une requête réécrite pour
 * l'occasion : une requête recopiée mesure la copie, pas le produit), chacune
 * plusieurs fois, et compare la médiane au budget déclaré dans
 * `src/server/admin/sondes-volumetriques.ts`.
 *
 * Sortie :
 *   - tableau lisible « page → temps → verdict » ;
 *   - code de sortie 1 si une sonde n'a pas de mesure committée ou dépasse son
 *     budget. C'est ce code qui fait rougir le job CI.
 *
 * `--ecrire` réinscrit les mesures dans `_AUDIT/BASELINE-VOLUMETRIQUE.json`.
 * 🔴 À n'utiliser que délibérément : réécrire la baseline avec la mesure du jour
 * transforme une régression en nouvelle norme, et le garde-fou en greffier.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SONDES, type CleSonde } from "../../src/server/admin/sondes-volumetriques";
import { libelleVerdict, verdictSonde } from "../../src/server/admin/verdict-volumetrique";
import { VOLUMES } from "../../prisma/seeds/volumetrie/fixture-volumetrique";
import { cibleAutorisee } from "../../prisma/seeds/volumetrie/garde-cible";

const CHEMIN_BASELINE = resolve(process.cwd(), "_AUDIT/BASELINE-VOLUMETRIQUE.json");
const REPETITIONS = 5;
// 🔴 La règle de décision (budget, tolérance, plancher de bruit) vit dans
// `src/server/admin/verdict-volumetrique.ts` et NON ici : `scripts/**` est hors
// de l'`include` Vitest, donc tout ce qui est écrit dans ce fichier est du code
// que personne ne teste. Ne pas la ramener ici.

interface Mesure {
  msMediane: number | null;
  requetes: number | null;
  mesureLe: string | null;
  note?: string;
}
interface Baseline {
  volumes: Record<string, number>;
  mesures: Record<string, Mesure>;
  [k: string]: unknown;
}

function mediane(xs: number[]): number {
  const t = [...xs].sort((a, b) => a - b);
  return t[Math.floor(t.length / 2)]!;
}

async function executants(): Promise<Record<CleSonde, () => Promise<unknown>>> {
  const { listSessionsForAdmin } = await import("../../src/server/qualiopi/presence/queries");
  const { lireDossiersPipeline } = await import("../../src/server/admin/dossiers-pipeline");
  // Date fixe : la fenêtre glissante de 12 mois doit tomber sur la même tranche
  // de fixture à chaque exécution, sinon deux mesures ne portent pas sur le
  // même nombre de lignes.
  const reference = new Date("2026-08-16T00:00:00.000Z");
  return {
    sessions_liste: () => listSessionsForAdmin({ maintenant: reference }),
    sessions_liste_archives: () =>
      listSessionsForAdmin({ maintenant: reference, avecArchives: true }),
    dossiers_pipeline: () => lireDossiersPipeline(reference),
    dossiers_pipeline_archives: () => lireDossiersPipeline(reference, { avecArchives: true }),
  };
}

async function main(): Promise<void> {
  const verdict = cibleAutorisee({
    DATABASE_URL: process.env["DATABASE_URL"],
    NODE_ENV: process.env["NODE_ENV"],
  });
  if (!verdict.ok) {
    console.error(
      `\n⛔ Mesure volumétrique impossible — ${verdict.raison}\n   ${verdict.message}\n`,
    );
    process.exit(1);
  }

  const baseline = JSON.parse(readFileSync(CHEMIN_BASELINE, "utf-8")) as Baseline;

  // Une baseline mesurée à un autre volume n'est pas comparable. On refuse
  // AVANT de mesurer, pour ne pas produire un tableau qui a l'air valide.
  const divergences = Object.entries(VOLUMES).filter(
    ([k, v]) => baseline.volumes[k] !== (v as number),
  );
  if (divergences.length > 0) {
    console.error(
      `\n⛔ La baseline déclare d'autres volumes que la fixture :\n` +
        divergences
          .map(([k, v]) => `   ${k} : baseline ${baseline.volumes[k]} ≠ fixture ${v}`)
          .join("\n") +
        `\n   Re-mesurer avec --ecrire, ou corriger VOLUMES.\n`,
    );
    process.exit(1);
  }

  const run = await executants();
  const lignes: { sonde: (typeof SONDES)[number]; ms: number; ecart: string; verdict: string }[] =
    [];
  let rouge = false;

  for (const sonde of SONDES) {
    const f = run[sonde.cle];
    const temps: number[] = [];
    // Un tour à blanc : le premier appel paie la connexion et la compilation
    // du plan côté Postgres. Le compter fausserait la mesure vers le haut.
    await f();
    for (let i = 0; i < REPETITIONS; i++) {
      const t0 = performance.now();
      await f();
      temps.push(performance.now() - t0);
    }
    const ms = Math.round(mediane(temps));
    const ref = baseline.mesures[sonde.cle];
    const baselineMs = ref?.msMediane ?? null;

    const v = verdictSonde({ ms, budgetMs: sonde.budgetMs, baselineMs });
    if (v.rouge) rouge = true;

    const delta = baselineMs == null ? null : ms - baselineMs;
    const ecart = delta == null ? "—" : `${delta >= 0 ? "+" : ""}${delta} ms`;
    lignes.push({ sonde, ms, ecart, verdict: libelleVerdict(v) });
  }

  console.log(
    `\nMesure au volume cible (${VOLUMES.sessions} sessions, ${VOLUMES.inscriptions} inscriptions)\n`,
  );
  for (const l of lignes) {
    console.log(
      `  ${l.sonde.page.padEnd(44)} ${String(l.ms).padStart(6)} ms  ${l.ecart.padStart(9)}  ${l.verdict}`,
    );
  }
  console.log();

  if (process.argv.includes("--ecrire")) {
    const horodatage = new Date().toISOString().slice(0, 10);
    for (const l of lignes) {
      // La note explique CE QUE la mesure veut dire (volume, run CI, budget) :
      // l'écraser à chaque re-mesure remplacerait une baseline expliquée par
      // quatre nombres nus. On garde la précédente si aucune n'est fournie.
      const precedente = baseline.mesures[l.sonde.cle];
      baseline.mesures[l.sonde.cle] = {
        msMediane: l.ms,
        requetes: null,
        mesureLe: horodatage,
        ...(precedente?.note != null ? { note: precedente.note } : {}),
      };
    }
    writeFileSync(CHEMIN_BASELINE, `${JSON.stringify(baseline, null, 2)}\n`, "utf-8");
    console.log(`✓ Baseline réécrite (${CHEMIN_BASELINE}).\n`);
    return;
  }

  if (rouge) {
    console.error(
      `⛔ Volumétrie refusée. Une surface admin sans baseline committée, ou plus lente que\n` +
        `   son budget, ne part pas en production : le plan T0 en fait un préalable.\n` +
        `   → pnpm volumetrie:seed && pnpm volumetrie:mesure --ecrire, puis committer\n` +
        `     _AUDIT/BASELINE-VOLUMETRIQUE.json en EXPLIQUANT ce qui a changé.\n`,
    );
    process.exit(1);
  }
  console.log("✓ Toutes les surfaces admin tiennent leur budget au volume cible.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
