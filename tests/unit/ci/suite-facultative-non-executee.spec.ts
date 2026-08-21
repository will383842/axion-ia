/**
 * CLIQUET — une suite qui se déclare FACULTATIVE ne doit pas être exécutée.
 *
 * 🔴 2026-08-21 — `tests/e2e/admin-baseline-screenshots.spec.ts` porte en tête :
 *
 *     Tag `@baseline` : opt-in. Les suites smoke par défaut ne lancent pas ces
 *     tests. Pour exécuter :
 *       pnpm exec playwright test --grep "@baseline" --update-snapshots
 *
 * L'intention était écrite ; le câblage manquait. Gate B exécutait la suite, et
 * ses douze tests échouaient tous sur « A snapshot doesn't exist » — aucune
 * capture de référence n'étant versionnée, et pour cause : elles seraient prises
 * sur le poste d'un développeur, avec ses polices, pour être comparées sur un
 * runner Linux.
 *
 * 🔑 Douze rouges permanents sans rapport avec un défaut, ce sont douze bonnes
 * raisons de ne jamais rendre le gate bloquant. Un commentaire qui décrit une
 * exclusion ne l'applique pas ; ce test relie les deux.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const CI = readFileSync(join(RACINE, ".github", "workflows", "ci.yml"), "utf8");
const SPEC = join(RACINE, "tests", "e2e", "admin-baseline-screenshots.spec.ts");

describe("Gate B n'exécute pas les suites déclarées facultatives", () => {
  it("la suite baseline se déclare bien opt-in", () => {
    // Contre-témoin : si la suite cessait de se déclarer facultative, l'exclusion
    // ci-dessous n'aurait plus de fondement — et ce test le dirait plutôt que de
    // maintenir une exclusion devenue arbitraire.
    const source = readFileSync(SPEC, "utf8");
    expect(source, "la suite baseline ne se déclare plus opt-in").toMatch(/opt-in/i);
    expect(source, "la suite baseline ne porte plus le tag @baseline").toContain("@baseline");
  });

  it("l'étape Playwright de Gate B exclut le tag @baseline", () => {
    const ligne = CI.split("\n").find((l) => /^\s+run:\s+pnpm test:e2e\b/.test(l));
    expect(ligne, "étape Playwright introuvable dans ci.yml").toBeTruthy();
    expect(
      ligne,
      "Gate B exécute la suite `@baseline`, qui se déclare pourtant facultative — " +
        "douze rouges permanents, et autant de raisons de ne jamais rendre ce gate bloquant",
    ).toMatch(/--grep-invert\s+"?@baseline"?/);
  });
});
