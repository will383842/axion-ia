/**
 * 🔴 `D9-4-01` — la réconciliation des offres ne tournait qu'à la main.
 *
 * ## Le défaut
 *
 * Deux chemins seedent le référentiel Qualiopi :
 *
 *   · `prisma/seeds/qualiopi/index.ts` — le CLI `pnpm qualiopi:seed`, lancé par
 *     un humain ;
 *   · `src/server/qualiopi/seed/reference-data.ts` — le DÉMARRAGE SERVEUR et le
 *     bouton de la console, c'est-à-dire les seuls qui tournent en production.
 *
 * Le CLI appelait `seedOffresSite` **puis** `reconcileOffresFromSkeleton`. Le
 * second n'appelait que la première. La réconciliation décidée le 2026-06-11 —
 * réaligner durée, public visé et modalités sur le squelette de
 * `src/content/formations` — ne s'exécutait donc jamais en production.
 *
 * ⚠️ Et l'en-tête de `reference-data.ts` affirmait « mêmes données que
 * `pnpm qualiopi:seed`, **zéro divergence** ». Le fichier qui promettait
 * l'équivalence était celui qui divergeait.
 *
 * 🔑 La cause est un écart de TYPE, pas de logique : `reconcileOffresFromSkeleton`
 * n'acceptait qu'un `PrismaClient`, quand le chemin de démarrage travaille dans
 * une transaction. L'y ajouter n'aurait pas compilé. Un détail de signature peut
 * décider, en silence, qu'une règle métier ne s'appliquera jamais.
 *
 * ## Ce que ce fichier garde — et ce qu'il n'exige PAS
 *
 * Il n'exige **pas** l'égalité des deux chemins, et ce serait une erreur de le
 * faire : le CLI importe aussi le catalogue, ce qui n'a rien à faire à chaque
 * démarrage. Il tient exactement deux choses — la réconciliation tourne des deux
 * côtés, et l'import de catalogue reste hors du démarrage.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();

/** Le fichier, commentaires ôtés — un commentaire qui cite un appel n'est pas un appel. */
function lireCode(...segments: string[]): string {
  return readFileSync(join(RACINE, ...segments), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const DEMARRAGE = lireCode("src", "server", "qualiopi", "seed", "reference-data.ts");
const CLI = lireCode("prisma", "seeds", "qualiopi", "index.ts");

describe("`D9-4-01` — la réconciliation des offres tourne en production", () => {
  it("le témoin : les deux fichiers seedent bien les offres", () => {
    // 🔑 Sans lui, un renommage viderait les deux lectures et tout ce fichier
    // passerait au vert en ne vérifiant plus rien.
    expect(DEMARRAGE).toMatch(/seedOffresSite\(/);
    expect(CLI).toMatch(/seedOffresSite\(/);
  });

  it("🔴 le chemin de DÉMARRAGE appelle la réconciliation", () => {
    // C'est le seul chemin qui tourne en production. Le CLI ne s'exécute que
    // si quelqu'un le lance à la main — c'est-à-dire jamais sur le serveur.
    expect(
      DEMARRAGE,
      "la dérive des offres (durée, public visé, modalités) n'est plus corrigée en production",
    ).toMatch(/reconcileOffresFromSkeleton\(/);
  });

  it("le CLI l'appelle aussi — les deux corrigent la même dérive", () => {
    expect(CLI).toMatch(/reconcileOffresFromSkeleton\(/);
  });

  it("🔴 l'import de CATALOGUE reste hors du démarrage — c'est voulu", () => {
    // ⚠️ La contrepartie du test précédent. Sans elle, « aligner les deux
    // chemins » se lirait comme « tout recopier », et un import de catalogue
    // complet tournerait à chaque boot — une régression, pas un progrès.
    for (const etape of ["seedCatalogFormations", "runCatalogueCleanup", "seedOffresV2"]) {
      expect(
        DEMARRAGE,
        `${etape} n'a rien à faire au démarrage : c'est un import, pas une réparation`,
      ).not.toContain(etape);
    }
  });

  it("la réconciliation accepte un client de TRANSACTION", () => {
    // 🔑 C'est ce qui a rendu l'oubli possible : typée `PrismaClient` seul, elle
    // ne POUVAIT pas être appelée depuis le seed de démarrage, qui travaille
    // dans une transaction. Restreindre à nouveau ce type remettrait la règle
    // hors production, sans qu'aucun test de logique ne bouge.
    const source = lireCode("prisma", "seeds", "qualiopi", "offres.ts");
    const signature = source.slice(
      source.indexOf("export async function reconcileOffresFromSkeleton"),
    );
    expect(signature.slice(0, 300)).toContain("Prisma.TransactionClient");
  });
});
