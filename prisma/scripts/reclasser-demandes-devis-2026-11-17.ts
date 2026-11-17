/**
 * E0-D — reclasse en « devis » les demandes passées de la page /demande-devis
 * rangées « audit » par erreur (avant #2020). Logique dans
 * `src/server/donnees/reclasser-demandes-devis.ts` ; ce script n'est que l'enveloppe.
 *
 * Lancé par la session de pilotage SEULE, dans le conteneur worker, après audit :
 *
 *   pnpm tsx prisma/scripts/reclasser-demandes-devis-2026-11-17.ts --lire --avant=<ISO>
 *   pnpm tsx prisma/scripts/reclasser-demandes-devis-2026-11-17.ts --appliquer --avant=<ISO> --attendu=<N>
 *   pnpm tsx prisma/scripts/reclasser-demandes-devis-2026-11-17.ts --revenir --lot=E0-D-2026-11-17
 *
 * `--lire` est le défaut et n'écrit jamais. Aucune donnée de personne n'est affichée.
 */

import { PrismaClient } from "../generated/client";
import {
  ReclassementRefuse,
  appliquer,
  lire,
  lireArguments,
  revenir,
  type BaseReclassement,
} from "../../src/server/donnees/reclasser-demandes-devis";

const prisma = new PrismaClient();
const base = prisma as unknown as BaseReclassement;

async function main(): Promise<void> {
  const cmd = lireArguments(process.argv.slice(2));
  if (cmd.mode === "lire") {
    // Sans --avant, aucune exclusion de fenêtre n'est calculable : on le dit.
    if (!cmd.avant) console.warn("[E0-D] pas de --avant : fenêtre « à revoir » non calculée.");
    const rapport = await lire(base, cmd.avant ?? new Date(8.64e15));
    console.log(JSON.stringify(rapport, null, 2));
    return;
  }
  if (cmd.mode === "appliquer") {
    console.log(JSON.stringify(await appliquer(base, cmd)));
    return;
  }
  console.log(JSON.stringify(await revenir(base, cmd.lot)));
}

main()
  .catch((err) => {
    console.error("[E0-D] refus ou échec :", err instanceof ReclassementRefuse ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
