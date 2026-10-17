// @vitest-environment node

/**
 * Qualiopi ind. 21 — la fixture du banc `@formateurs` recopie les codes des critères (elle
 * n'importe pas le domaine : cloisonnement). Ce test refuse qu'ils divergent.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  BLOCS_MISE_EN_SITUATION,
  CRITERES_ENTRETIEN,
  VERSION_CONFIGURATION_EVALUATION,
} from "../configuration";

const FIXTURE = readFileSync(
  path.join(process.cwd(), "tests/e2e/fixtures/formateurs/competences-q21.ts"),
  "utf8",
);

const liste = (nom: string): string[] => {
  const m = new RegExp(`const ${nom} = \\[([^\\]]*)\\]`).exec(FIXTURE);
  return m ? [...m[1]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]!) : [];
};

describe("fixture du banc — critères d'évaluation", () => {
  it("mêmes codes, même version que la configuration", () => {
    expect(liste("CRITERES_ENTRETIEN")).toEqual(CRITERES_ENTRETIEN.map((c) => c.code));
    expect(liste("BLOCS_MISE_EN_SITUATION")).toEqual(BLOCS_MISE_EN_SITUATION.map((c) => c.code));
    expect(FIXTURE).toContain(
      `const VERSION_CONFIGURATION_EVALUATION = ${VERSION_CONFIGURATION_EVALUATION};`,
    );
  });
});
