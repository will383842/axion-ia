/**
 * Toute PR est gardée — y compris celle qui est empilée sur une autre.
 *
 * ## Le trou, et pourquoi il était invisible
 *
 * `ci.yml` a porté, jusqu'au 2026-09-05, ce déclencheur :
 *
 *     on:
 *       pull_request:
 *         branches: [main, staging]
 *
 * Le filtre `branches:` d'un `pull_request` porte sur la **base** de la PR, pas
 * sur sa tête. Une PR empilée — `feat/b` dont la base est `feat/a`, elle-même
 * en attente de fusion — ne franchissait donc jamais ce filtre. Elle ne
 * déclenchait **aucun** workflow.
 *
 * 🔴 Et GitHub affichait ces PR `mergeStateStatus: CLEAN`. Exactement le mot
 * qu'il emploie pour une PR dont les quatre gates sont vertes. Trois PR (#989,
 * #990, #992) sont restées des heures dans cet état, fusionnables sur ZÉRO
 * contrôle, avec l'apparence du feu vert.
 *
 * 🔑 « Aucun contrôle rapporté » n'est pas une gate rouge. C'est l'ABSENCE de
 * gate — et l'interface ne distingue pas les deux. Une équipe qui travaille en
 * piles (et celle-ci le fait : #987 → #989 → #990 → #992) fusionne alors du
 * code que rien n'a lu.
 *
 * ## Ce que cette garde vérifie, et ce qu'elle ne peut pas vérifier
 *
 * Elle vérifie qu'**aucun** workflow déclenché par `pull_request` ne restreint
 * les bases. Elle balaie le dossier plutôt que de nommer `ci.yml` : un
 * workflow écrit demain avec le même piège serait couvert le jour de sa
 * naissance, sans que personne ait à penser à l'ajouter ici. (Leçon de
 * `tout-check-est-cable.spec.ts` : une campagne ne trouve que ce qu'elle a
 * nommé.)
 *
 * ⛔ Elle ne peut PAS vérifier qu'une PR empilée est gardée contre la base
 * FINALE. Après la fusion de sa base, GitHub repointe la PR suivante sans
 * émettre d'événement d'un type déclencheur : la PR conserve la conclusion
 * calculée contre l'ancienne base. Cela reste une règle de procédure — forcer
 * un `synchronize` avant chaque fusion de pile — et c'est écrit dans `ci.yml`
 * même, à l'endroit où quelqu'un ira lire.
 *
 * ## Pourquoi un témoin POSITIF
 *
 * Un contrôle qui cherche `branches:` sous `pull_request:` et n'en trouve
 * jamais est indiscernable d'un contrôle qui ne lit rien du tout — un chemin
 * faux, un bloc mal découpé, et il verdit pour toujours. On exige donc en plus
 * que le découpage RETROUVE le filtre `branches:` du déclencheur `push:`, qui
 * lui doit rester : c'est la preuve que la lecture atteint bien le bloc, et
 * qu'elle distingue les deux déclencheurs l'un de l'autre.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const WORKFLOWS = path.join(process.cwd(), ".github", "workflows");

/** Indentation d'une ligne, en espaces. Une ligne vide n'en a pas de sens propre. */
function indentation(ligne: string): number {
  return ligne.length - ligne.trimStart().length;
}

/**
 * Les lignes de CODE d'un fichier YAML — commentaires et lignes vides retirés.
 *
 * ⚠️ Indispensable ici : `ci.yml` EXPLIQUE en commentaire, sur vingt lignes,
 * pourquoi il ne porte plus `branches: [main, staging]` sous `pull_request`.
 * Un contrôle qui lirait le texte brut trouverait sa propre explication et
 * rougirait sur elle. Même piège que `test-statique-trouve-ses-propres-commentaires`.
 */
function lignesDeCode(yaml: string): string[] {
  return yaml.split(/\r?\n/).filter((l) => l.trim().length > 0 && !l.trimStart().startsWith("#"));
}

/**
 * Les lignes FILLES d'une clé, c'est-à-dire celles strictement plus indentées
 * qu'elle et qui la suivent sans interruption.
 *
 * Rend `null` si la clé est absente — un absent et un vide ne se confondent pas.
 */
function blocDe(lignes: string[], cle: string): string[] | null {
  const i = lignes.findIndex((l) => l.trim() === cle);
  if (i === -1) return null;
  const seuil = indentation(lignes[i]!);
  const filles: string[] = [];
  for (const ligne of lignes.slice(i + 1)) {
    if (indentation(ligne) <= seuil) break;
    filles.push(ligne);
  }
  return filles;
}

const FICHIERS = readdirSync(WORKFLOWS).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

describe("une PR empilée est gardée comme les autres", () => {
  it("il y a bien des workflows à lire — sinon tout le reste verdirait sur du vide", () => {
    expect(FICHIERS.length).toBeGreaterThan(0);
  });

  // `pull_request_target` porte EXACTEMENT la même sémantique de filtre. Il
  // n'est employé nulle part aujourd'hui ; l'inclure coûte un mot et couvre le
  // jour où quelqu'un l'emploie.
  const DECLENCHEURS_DE_PR = ["pull_request:", "pull_request_target:"] as const;

  for (const fichier of FICHIERS) {
    const lignes = lignesDeCode(readFileSync(path.join(WORKFLOWS, fichier), "utf8"));

    for (const declencheur of DECLENCHEURS_DE_PR) {
      const bloc = blocDe(lignes, declencheur);
      if (bloc === null) continue;

      it(`🔴 ${fichier} — \`${declencheur}\` ne filtre AUCUNE base`, () => {
        const filtre = bloc.filter((l) => l.trim().startsWith("branches"));
        expect(
          filtre,
          `${fichier} restreint les bases de \`${declencheur}\`. Le filtre porte sur la BASE : ` +
            "une PR empilée sur une branche de feature ne déclencherait alors AUCUN contrôle, " +
            "et GitHub l'afficherait `CLEAN` — le même mot que pour quatre gates vertes. " +
            "Voir l'explication en tête de `.github/workflows/ci.yml`.",
        ).toEqual([]);
      });
    }
  }

  it("TÉMOIN POSITIF — le découpage retrouve bien le filtre du déclencheur `push`", () => {
    // Sans ce témoin, un découpage qui ne rendrait JAMAIS rien (mauvais chemin,
    // mauvaise clé, indentation mal comptée) verdirait pour toujours : « je n'ai
    // trouvé aucun filtre » et « je ne sais pas lire » ont la même couleur.
    const lignes = lignesDeCode(readFileSync(path.join(WORKFLOWS, "ci.yml"), "utf8"));

    const surPush = blocDe(lignes, "push:");
    expect(surPush, "le déclencheur `push:` de ci.yml n'a pas été trouvé").not.toBeNull();
    expect(
      surPush!.some((l) => l.trim() === "branches: [main, staging]"),
      "le filtre de `push:` doit RESTER : rien ne doit lancer la CI sur chaque poussée " +
        "de branche de travail, seules les PR et les deux branches longues comptent",
    ).toBe(true);

    // Et le bloc `pull_request:` existe bel et bien — il est simplement vide.
    expect(
      blocDe(lignes, "pull_request:"),
      "ci.yml doit garder un déclencheur `pull_request`",
    ).not.toBeNull();

    // La file de fusion reste câblée : sans elle, une file activée attend
    // indéfiniment des checks qui ne se lancent jamais.
    expect(lignes.some((l) => l.trim() === "merge_group:")).toBe(true);
  });
});
