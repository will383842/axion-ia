/**
 * Garde — LE BROUILLON D'UNE SESSION NE BLOQUE PAS LES COMMITS DES AUTRES.
 *
 * ## Le défaut que cette garde ferme
 *
 * Mesuré le 2026-09-03. Le hook `pre-commit` lance `tsc --noEmit` sur le PROJET,
 * et `tsconfig.json` inclut `**​/*.ts`. Donc tout fichier TypeScript présent sur
 * le disque entre dans le typecheck — **y compris un fichier que git ne suit
 * pas**, qui ne sera jamais commité, et qui appartient à quelqu'un d'autre.
 *
 * Ce jour-là, un brouillon non suivi (`docs/partners/artefacts/scripts/lot/
 * composer.ts`, une erreur `TS2322` de narrowing sous `noUncheckedIndexedAccess`)
 * a bloqué les commits de **quatre sessions travaillant en parallèle** sur la
 * même machine. Aucune d'elles ne touchait à ce fichier. Deux ont perdu du temps
 * à chercher la panne dans leur propre travail avant de trouver l'origine.
 *
 * Le couplage est le défaut, pas l'erreur de type : de la documentation ne doit
 * pas pouvoir empêcher de livrer l'application.
 *
 * ## Pourquoi l'exclusion ne coûte rien ici
 *
 * `docs/` ne contient AUCUN `.ts` versionné — le second test le vérifie, et
 * c'est lui qui compte le plus. Si quelqu'un y ajoute un jour du TypeScript
 * destiné à être compilé, il le fera sans voir qu'il est hors du typecheck :
 * la garde rougira à sa place, et il déplacera le fichier plutôt que de
 * découvrir en production qu'il n'a jamais été vérifié.
 */

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

function excludeDuTsconfig(): string[] {
  const brut = readFileSync(path.join(RACINE, "tsconfig.json"), "utf8");
  // `tsconfig.json` autorise les commentaires ; `JSON.parse` non.
  const sansCommentaires = brut.replace(/^\s*\/\/.*$/gm, "");
  const conf = JSON.parse(sansCommentaires) as { exclude?: string[] };
  return conf.exclude ?? [];
}

describe("🔴 typecheck — un brouillon ne bloque pas les commits des autres", () => {
  it("`docs/` est hors de la portée du typecheck", () => {
    const exclude = excludeDuTsconfig();

    expect(
      exclude.some((m) => m === "docs" || m.startsWith("docs/")),
      "`docs/` est retombé dans la portée de `tsconfig.json`. Le hook `pre-commit` " +
        "typecheck le disque, pas l'index : n'importe quel brouillon TypeScript " +
        "posé là — même non suivi par git, même appartenant à une autre session — " +
        "bloquera les commits de tout le monde. C'est arrivé le 2026-09-03 sur " +
        "quatre sessions simultanées.",
    ).toBe(true);
  });

  it("aucun `.ts` versionné ne vit sous `docs/` — sinon l'exclusion en perdrait la vérification", () => {
    // Témoin de non-vacuité : on interroge git, pas le disque. Un `git ls-files`
    // qui rendrait vide parce que la commande a échoué ferait passer ce test sur
    // du vide, donc on vérifie d'abord qu'il répond bien sur un chemin connu.
    const temoin = execFileSync("git", ["ls-files", "src/lib/prisma.ts"], {
      cwd: RACINE,
      encoding: "utf8",
    }).trim();
    expect(temoin, "`git ls-files` ne répond pas — le test suivant serait aveugle").not.toBe("");

    const suivis = execFileSync("git", ["ls-files", "docs/**/*.ts", "docs/**/*.tsx"], {
      cwd: RACINE,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);

    expect(
      suivis,
      "Du TypeScript versionné est apparu sous `docs/`, qui est exclu du " +
        "typecheck : ces fichiers ne sont vérifiés par RIEN. Déplace-les sous " +
        "`scripts/` ou `src/` s'ils doivent compiler — ou retire-les du dépôt " +
        "s'ils sont illustratifs.",
    ).toEqual([]);
  });
});
