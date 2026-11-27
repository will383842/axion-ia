import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Lot GEO V2-03 : plus de chiffres orphelins.
 * Un « % » n'a le droit d'apparaître, dans le glossaire et les comparatifs publics,
 * que si sa source est nommée sur la même ligne (organisme de `chiffres-publics.ts`)
 * ou si la ligne porte le marqueur d'un percentile (définition, pas une statistique).
 * Sinon : le chiffre est ajouté à `chiffres-publics.ts` avec son URL, ou reformulé sans chiffre.
 */
const RACINE = join(__dirname, "..");
const SOURCES_NOMMEES =
  /\b(Insee|Eurostat|Bpifrance|DARES|France Num|Commission européenne|Banque de France|CNIL)\b/i;
const PERCENTILE = /\bp(50|90|95|99)\b/i;

function fichiersSurveilles(): string[] {
  const dossier = join(RACINE, "glossaire-reference");
  return [
    join(RACINE, "comparaisons.ts"),
    join(RACINE, "glossary-extension.ts"),
    ...readdirSync(dossier)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => join(dossier, f)),
  ];
}

describe("chiffres orphelins (glossaire et comparatifs)", () => {
  it.each(fichiersSurveilles().map((f) => [f.slice(RACINE.length + 1), f] as const))(
    "%s : aucun « % » sans source sur la même ligne",
    (_nom, chemin) => {
      const orphelins = readFileSync(chemin, "utf8")
        .split("\n")
        .map((ligne, i) => ({ ligne, n: i + 1 }))
        .filter(({ ligne }) => /\d\s*%|%\s*des\b/.test(ligne))
        .filter(({ ligne }) => !SOURCES_NOMMEES.test(ligne) && !PERCENTILE.test(ligne))
        .map(({ n }) => n);
      expect(orphelins).toEqual([]);
    },
  );
});
