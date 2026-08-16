#!/usr/bin/env tsx
/**
 * Écrit la liste des hubs villes PRÉ-RENDUS AU BUILD, pour le job `warm`.
 *
 * POURQUOI (GEO-118, audit GEO/AEO du 2026-08-14)
 *
 * Ces pages affichent un bloc « articles mentionnant {ville} » qui LIT LA BASE.
 * Le build tourne sous les URLs stub (ADR 0026) : la requête rend `[]` et le
 * bloc n'est pas rendu. Avec `revalidate = 86400` et des déploiements plus
 * fréquents qu'une fois par jour, ces pages ne repassent JAMAIS par un rendu
 * peuplé — le bloc est structurellement absent, sur Paris, Lyon, Marseille…
 *
 * Les ~2 100 autres villes vont bien : `dynamicParams` les rend au RUNTIME, avec
 * la vraie base.
 *
 * POURQUOI UN FICHIER PLUTÔT QU'UN APPEL DIRECT
 *
 * Le job `warm` n'a NI `actions/checkout` NI Node : c'est cinq `curl` sur un
 * runner nu, et c'est très bien ainsi — une chauffe best-effort n'a pas à
 * installer un dépôt. Il ne peut donc pas exécuter ce script. On dépose donc le
 * résultat dans un fichier versionné, que le workflow lit avec `jq`.
 *
 * Le fichier est un ARTEFACT, pas une source : le seuil de population n'est
 * écrit qu'une fois, dans `src/content/villes/prerendu.ts`, d'où
 * `generateStaticParams` le lit aussi. `tests/unit/ci/deploy-warm-listes.spec.ts`
 * recalcule la liste et rougit si le fichier a dérivé — ce qui arrivera le jour
 * où une ville franchira les 100 000 habitants.
 *
 * ## Usage
 *
 *   pnpm tsx scripts/ci/hubs-villes-prerendus.ts            → affiche le JSON
 *   pnpm tsx scripts/ci/hubs-villes-prerendus.ts --ecrire   → écrit le fichier
 */

import { writeFileSync } from "node:fs";
import path from "node:path";

import { cheminsHubsVillesPrerendus } from "../../src/content/villes/prerendu";

/** Chemin du fichier lu par le job `warm`, relatif à la racine du dépôt. */
export const FICHIER_HUBS_VILLES = ".github/warm/hubs-villes-prerendus.json";

/** Le contenu attendu du fichier, recalculé depuis la source. */
export function contenuAttendu(): string {
  const chemins = cheminsHubsVillesPrerendus("fr");
  return `${JSON.stringify(chemins, null, 2)}\n`;
}

function main(): void {
  const contenu = contenuAttendu();

  if (process.argv.includes("--ecrire")) {
    const cible = path.join(process.cwd(), FICHIER_HUBS_VILLES);
    writeFileSync(cible, contenu, "utf8");
    process.stdout.write(`écrit : ${FICHIER_HUBS_VILLES}\n`);
    return;
  }

  process.stdout.write(contenu);
}

if (process.argv[1]?.includes("hubs-villes-prerendus")) main();
