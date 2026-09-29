#!/usr/bin/env tsx
/**
 * scripts/gates/grille-check.ts — garde `partners:grille:check`, côté axionia (DM-03-A).
 *
 *     pnpm exec tsx scripts/gates/grille-check.ts             # vérifie (code 1 si défaut)
 *     pnpm exec tsx scripts/gates/grille-check.ts --publier   # écrit commissions.v<N+1>.json si la grille a changé
 *     pnpm exec tsx scripts/gates/grille-check.ts --fixture-pseudonymisee  # fixture de Partners, sur stdout
 *
 * Ce qu'elle vérifie (REQ-DM-014, REQ-INT-017, HYP-W6-BIS) :
 *   1. COHÉRENCE — chaque palier de `pricing.ts` a SOIT un taux, SOIT une entrée
 *      `BAREMES_INDEFINIS` explicite et datée ; ligne absente → rouge, et nommée ;
 *   2. PUBLICATIONS — chaque `commissions.v<N>.json` porte le hash de son propre contenu,
 *      versions contiguës depuis 1, horodatage ISO UTC ;
 *   3. DÉRIVATION — le hash de la DERNIÈRE publication = le hash recalculé depuis
 *      `pricing.ts`. « Modifier pricing.ts sans republier la grille » → rouge.
 *
 * Le vert imprime le compte des paliers et commissions RÉELLEMENT confrontés : « 0 palier »
 * ne se lit pas comme « aucun défaut ».
 *
 * `--publier` refuse d'écrire si la cohérence est rouge : on ne publie pas une grille
 * incohérente vers Partners. Il n'écrit rien si le contenu n'a pas changé. Aucun réseau,
 * aucune base : la publication est un fichier committé, que Partners importe (DM-03-P).
 * Le témoin à deux faces de cette garde vit dans
 * `src/server/partners-sync/__tests__/grille-export.spec.ts`, exécuté par la suite unitaire.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

import {
  construireContenuGrille,
  dossierPublications,
  empreinteGrille,
  entreesDepuisPricing,
  lirePublications,
  prochainePublication,
  pseudonymiserPublication,
  verifierCoherenceGrille,
  verifierPublications,
} from "../../src/server/partners-sync/grille/export";

function main(): number {
  // La fixture de Partners (DM-03-P) : la DERNIÈRE publication, pseudonymisée, sur la sortie
  // standard. Rien n'est écrit dans ce dépôt.
  if (process.argv.includes("--fixture-pseudonymisee")) {
    const derniere = lirePublications(dossierPublications()).at(-1);
    if (derniere === undefined) {
      console.error("[partners:grille:check] aucune publication à pseudonymiser.");
      return 1;
    }
    process.stdout.write(`${JSON.stringify(pseudonymiserPublication(derniere), null, 2)}\n`);
    return 0;
  }
  const publier = process.argv.includes("--publier");
  const entrees = entreesDepuisPricing();
  const contenu = construireContenuGrille(entrees);
  const anomalies = verifierCoherenceGrille(entrees);
  const dossier = dossierPublications();
  const pubs = lirePublications(dossier);
  const defautsPubs = verifierPublications(pubs);

  console.log(
    `[partners:grille:check] périmètre : ${entrees.paliers.length} paliers, ${entrees.commissions.length} commissions, ` +
      `${entrees.baremesIndefinis.length} barèmes indéfinis déclarés, ${pubs.length} publication(s) dans ${path.relative(process.cwd(), dossier)}`,
  );

  if (anomalies.length > 0) {
    for (const a of anomalies) console.error(`  ✗ [${a.code}] ${a.message}`);
    console.error(
      `[partners:grille:check] ROUGE — ${anomalies.length} anomalie(s) de cohérence (HYP-W6-BIS).`,
    );
    return 1;
  }

  if (defautsPubs.length > 0) {
    for (const d of defautsPubs) console.error(`  ✗ ${d}`);
    console.error(`[partners:grille:check] ROUGE — publications altérées.`);
    return 1;
  }

  if (publier) {
    const suivante = prochainePublication(pubs, contenu, new Date());
    if (suivante === null) {
      console.log(
        `[partners:grille:check] rien à publier : v${pubs.at(-1)?.version} porte déjà ${pubs.at(-1)?.hash}.`,
      );
      return 0;
    }
    const fichier = path.join(dossier, `commissions.v${suivante.version}.json`);
    writeFileSync(fichier, `${JSON.stringify(suivante, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    console.log(
      `[partners:grille:check] publié : ${path.relative(process.cwd(), fichier)} — hash ${suivante.hash}.`,
    );
    return 0;
  }

  const recalcule = empreinteGrille(contenu);
  const derniere = pubs.at(-1);
  if (derniere === undefined || derniere.hash !== recalcule) {
    console.error(
      `[partners:grille:check] ROUGE — pricing.ts (hash ${recalcule}) ≠ dernière grille publiée ` +
        `(${derniere === undefined ? "aucune" : `v${derniere.version}, hash ${derniere.hash}`}). ` +
        `Republier : pnpm exec tsx scripts/gates/grille-check.ts --publier`,
    );
    return 1;
  }

  const taux = contenu.paliers.filter((p) => p.statut === "taux").length;
  console.log(
    `[partners:grille:check] VERT — v${derniere.version} = pricing.ts (${recalcule}) ; ` +
      `${taux} paliers à taux, ${contenu.paliers.length - taux} en barème indéfini daté.`,
  );
  return 0;
}

process.exit(main());
