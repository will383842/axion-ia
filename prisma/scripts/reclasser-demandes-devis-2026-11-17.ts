/**
 * E0-D — reclasse en « devis » les demandes passées de la page /demande-devis
 * rangées « audit » par erreur (avant #2020). Logique dans
 * `src/server/donnees/reclasser-demandes-devis.ts` ; ce script n'est que l'enveloppe.
 *
 * Lancé par la session de pilotage SEULE, dans le conteneur worker, après audit :
 *
 *   node_modules/.bin/tsx prisma/scripts/reclasser-demandes-devis-2026-11-17.ts --lire --avant=<ISO en UTC>
 *   node_modules/.bin/tsx prisma/scripts/reclasser-demandes-devis-2026-11-17.ts --appliquer --avant=<ISO> --attendu=<N> --base=<nom>
 *   node_modules/.bin/tsx prisma/scripts/reclasser-demandes-devis-2026-11-17.ts --revenir --lot=E0-D-2026-11-17 --attendu=<N> --base=<nom>
 *
 * `--lire` n'écrit jamais, affiche le nom de la base à recopier dans `--base` ; `--avant` (avec fuseau Z ou ±HH:MM, date réelle) est exigé. `--appliquer` et `--revenir` exigent `--attendu` et `--base`, comparé au nom lu dans DATABASE_URL. Aucune donnée de personne n'est affichée.
 */

import { PrismaClient } from "../generated/client";
import {
  ReclassementRefuse,
  appliquer,
  cibleBase,
  lire,
  lireArguments,
  revenir,
  verifierBase,
  type BaseReclassement,
} from "../../src/server/donnees/reclasser-demandes-devis";

const prisma = new PrismaClient();
const base = prisma as unknown as BaseReclassement;

async function main(): Promise<void> {
  const cmd = lireArguments(process.argv.slice(2));
  // Garde contre une mauvaise base : avant tout accès, et affichée en tête de chaque mode.
  const cible = cibleBase(process.env.DATABASE_URL);
  console.log(`[E0-D] mode=${cmd.mode} base visée : hôte=${cible.hote} nom=${cible.base}`);
  if (cmd.mode !== "lire") verifierBase(cmd.base, cible);
  if (cmd.mode === "lire") {
    console.log(`[E0-D] pour appliquer ou revenir : --base=${cible.base}`);
    console.log(JSON.stringify(await lire(base, cmd.avant), null, 2));
    return;
  }
  if (cmd.mode === "appliquer") {
    // Journal de retour arrière : à conserver (identifiants + horodatage).
    const r = await appliquer(base, cmd);
    console.log(JSON.stringify(r, null, 2));
    console.log(
      `[E0-D] ${r.modifiees} ligne(s) reclassée(s) le ${r.le} : ${r.identifiants.join(", ")}`,
    );
    return;
  }
  console.log(JSON.stringify(await revenir(base, cmd.lot, cmd.attendu)));
}

main()
  .catch((err) => {
    console.error("[E0-D] refus ou échec :", err instanceof ReclassementRefuse ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
