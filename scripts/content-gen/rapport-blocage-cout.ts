#!/usr/bin/env tsx
/**
 * Fiche C1 — rapport LECTURE SEULE « taux de blocage par contrôle et coût réel par
 * article et par rôle » (conception chaîne éditoriale, § 12).
 * Aucune écriture, aucune migration.
 *
 * Usage : pnpm tsx scripts/content-gen/rapport-blocage-cout.ts [jours=30] [--json]
 */
import {
  chargerRapportBlocageCout,
  FENETRE_JOURS_DEFAUT,
} from "@/server/content-gen/mesures/lecture-blocage-cout";
import { formaterRapportBlocageCout } from "@/server/content-gen/mesures/taux-blocage-cout";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const nombre = args.find((a) => /^\d+$/.test(a));
  const jours = nombre ? Math.min(365, Math.max(1, Number(nombre))) : FENETRE_JOURS_DEFAUT;
  const rapport = await chargerRapportBlocageCout(jours);
  console.log(json ? JSON.stringify(rapport, null, 2) : formaterRapportBlocageCout(rapport, jours));
}

main().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  },
);
