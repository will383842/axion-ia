/**
 * Le harnais E2E de Gate B doit MESURER quelque chose — garde d'infrastructure.
 *
 * Le 2026-08-21, les 237 tests Playwright de Gate B échouaient tous, et depuis
 * assez longtemps pour que trois commentaires différents du workflow proposent
 * trois coupables, tous faux. La cause tenait à l'ORDRE DES ÉTAPES :
 *
 *   1. `Build` produisait un vrai `.next` (run 32443013208, 03:31:22).
 *   2. `Bundle delta vs main` — `andresz1/size-limit-action` — relançait
 *      `pnpm run build` DANS LE MÊME RÉPERTOIRE pour comparer à `main`. Elle
 *      vidait donc `.next` (03:31:24) puis mourait en « JavaScript heap out of
 *      memory » (03:33:55), sans `NODE_OPTIONS`, laissant le dossier sans
 *      `BUILD_ID`.
 *   3. `Playwright` lançait `pnpm start` sur ce vide → « Could not find a
 *      production build in the '.next' directory » → 209 échecs, 17 skipped,
 *      11 non joués, ZÉRO passé.
 *   4. `Lighthouse` échouait derrière, en `CHROME_INTERSTITIAL_ERROR`.
 *
 * Aucun test fonctionnel ne pouvait voir ça : le défaut n'était pas dans le code
 * testé, il était dans l'ORDRE de son câblage — et les trois étapes concernées
 * portaient `continue-on-error: true`, c'est-à-dire « personne ne lit mon
 * résultat ». C'est le même vice que `gate-a11y-cablage.spec.ts`, sur un autre
 * job : un gate qui s'exécute sans rien atteindre.
 *
 * Ce fichier n'exécute rien. Il lit le workflow et vérifie que les branchements
 * sont bien ceux qu'on croit.
 *
 * ⚠️ RÈGLE DE RÉDACTION — comme pour `gate-a11y-cablage.spec.ts`, on raisonne sur
 * des lignes de CODE YAML, jamais sur du texte de commentaire : ce fichier-ci
 * cite `size-limit-action` et `.next/BUILD_ID` dans sa propre en-tête, et un
 * contrôle qui confond une explication avec le fait qu'elle explique est un
 * contrôle faux.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

/** Lignes YAML effectives : commentaires retirés, indices d'origine conservés. */
function lignesEffectives(chemin: string): string[] {
  return readFileSync(path.join(RACINE, ...chemin.split("/")), "utf8")
    .split(/\r?\n/)
    .map((l) => (/^\s*#/.test(l) ? "" : l));
}

/** Le bloc d'un job de premier niveau (indentation 2), commentaires retirés. */
function blocDuJob(lignes: string[], job: string): string[] {
  const debut = lignes.findIndex((l) => l === `  ${job}:`);
  expect(debut, `job \`${job}\` introuvable dans ci.yml`).toBeGreaterThanOrEqual(0);
  let fin = lignes.length;
  for (let i = debut + 1; i < lignes.length; i += 1) {
    if (/^ {2}\S/.test(lignes[i] ?? "")) {
      fin = i;
      break;
    }
  }
  return lignes.slice(debut, fin);
}

/** Index de la première ligne du bloc qui contient `motif`, ou -1. */
function indexDe(bloc: string[], motif: RegExp): number {
  return bloc.findIndex((l) => motif.test(l));
}

const CI = lignesEffectives(".github/workflows/ci.yml");
const GATE_B = blocDuJob(CI, "gate-b");

// Ancres SYNTAXIQUES — une clé `uses:` / `run:`, jamais une chaîne nue.
const ETAPE_BUILD = /^\s+run:\s+pnpm exec next build\b/;
const ETAPE_DESTRUCTRICE = /^\s+uses:\s+andresz1\/size-limit-action@/;
const ETAPE_PLAYWRIGHT = /^\s+run:\s+pnpm test:e2e\b/;
const ETAPE_LIGHTHOUSE = /^\s+run:\s+pnpm lhci:autorun\b/;
const ASSERTION_BUILD_ID = /^\s+if \[ ! -f \.next\/BUILD_ID \]/;

describe("harnais E2E de Gate B — il doit mesurer quelque chose", () => {
  it("place l'étape qui DÉTRUIT `.next` après Playwright et après Lighthouse", () => {
    const destructrice = indexDe(GATE_B, ETAPE_DESTRUCTRICE);
    const playwright = indexDe(GATE_B, ETAPE_PLAYWRIGHT);
    const lighthouse = indexDe(GATE_B, ETAPE_LIGHTHOUSE);

    expect(destructrice, "`size-limit-action` a disparu de gate-b").toBeGreaterThanOrEqual(0);
    expect(playwright, "l'étape Playwright a disparu de gate-b").toBeGreaterThanOrEqual(0);
    expect(lighthouse, "l'étape Lighthouse a disparu de gate-b").toBeGreaterThanOrEqual(0);

    expect(
      destructrice,
      "`size-limit-action` relance un build complet dans le répertoire de travail : elle " +
        "VIDE `.next`. Placée avant Playwright, elle fait démarrer `pnpm start` sur un " +
        "dossier sans `BUILD_ID` — les 237 tests partent en ERR_CONNECTION_REFUSED et le " +
        "gate rend un vert de complaisance. Elle doit rester la dernière étape utile du job.",
    ).toBeGreaterThan(playwright);

    expect(
      destructrice,
      "même raison pour Lighthouse : `next start` a besoin du build de l'étape `Build`. " +
        "Le `CHROME_INTERSTITIAL_ERROR` chronique attribué en 2026-07 à un défaut de bind " +
        "sur loopback n'était que cette destruction, vue depuis Chrome.",
    ).toBeGreaterThan(lighthouse);
  });

  it("assère l'existence de `.next/BUILD_ID` entre le build et Playwright", () => {
    const build = indexDe(GATE_B, ETAPE_BUILD);
    const assertion = indexDe(GATE_B, ASSERTION_BUILD_ID);
    const playwright = indexDe(GATE_B, ETAPE_PLAYWRIGHT);

    expect(build, "l'étape `Build` a disparu de gate-b").toBeGreaterThanOrEqual(0);
    expect(
      assertion,
      "Aucune étape ne vérifie que `.next/BUILD_ID` existe encore. Sans elle, la " +
        "disparition du build ne rougit nulle part : elle se manifeste trois étapes plus " +
        "loin, sous la forme de 209 tests rouges qu'on attribue alors à des bugs d'UI.",
    ).toBeGreaterThanOrEqual(0);

    expect(assertion, "la garde doit venir APRÈS le build").toBeGreaterThan(build);
    expect(assertion, "la garde doit venir AVANT la suite qu'elle protège").toBeLessThan(
      playwright,
    );
  });

  it("laisse cette garde BLOQUANTE — une garde qui ne peut pas rougir ne garde rien", () => {
    const assertion = indexDe(GATE_B, ASSERTION_BUILD_ID);
    expect(assertion).toBeGreaterThanOrEqual(0);

    // On remonte jusqu'au `- name:` de l'étape, puis on relit son corps.
    let debutEtape = assertion;
    while (debutEtape > 0 && !/^\s+- name:/.test(GATE_B[debutEtape] ?? "")) debutEtape -= 1;
    let finEtape = assertion;
    while (finEtape + 1 < GATE_B.length && !/^\s+- (name|uses):/.test(GATE_B[finEtape + 1] ?? "")) {
      finEtape += 1;
    }
    const corps = GATE_B.slice(debutEtape, finEtape + 1).join("\n");

    expect(
      /continue-on-error:\s*true/.test(corps),
      "L'étape qui prouve la survie du build porte `continue-on-error: true`. Elle " +
        "constaterait la destruction sans rien empêcher — exactement ce que faisaient " +
        "déjà les trois étapes en aval.",
    ).toBe(false);
  });
});
