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
// `ETAPE_LIGHTHOUSE` a été retirée avec le step qu'elle repérait
// (`pnpm lhci:autorun`, sorti de gate-b le 2026-08-24 — il mesurait le runner).
const ASSERTION_BUILD_ID = /^\s+if \[ ! -f \.next\/BUILD_ID \]/;

describe("harnais E2E de Gate B — il doit mesurer quelque chose", () => {
  it("n'admet AUCUNE étape qui détruise `.next` dans gate-b", () => {
    // 🔴 2026-08-24 — CE TEST GARDAIT UN ORDRE ; IL GARDE MAINTENANT UNE ABSENCE,
    // ET C'EST PLUS FORT.
    //
    // Il exigeait que `size-limit-action` vienne APRÈS Playwright et APRÈS
    // Lighthouse. Les deux étapes qu'il nommait ont été retirées de `ci.yml` le
    // 2026-08-24, sur mesure et non sur impression :
    //
    //   · `size-limit-action` relance un `pnpm run build` complet pour comparer
    //     à `main`. Le step `Build` de ce job prend 8 min ; l'action portait
    //     `timeout-minutes: 6`. Elle ne pouvait pas finir un seul de ses deux
    //     builds — l'OOM à ~4 Go la tuait de toute façon avant (run 32666732630).
    //   · `Lighthouse CI` échouait sur 11 URL sur 11 pendant que le lhci
    //     post-deploy passait propre sur la prod : il mesurait le runner.
    //
    // 🔑 Une étape qui ne peut pas aboutir ET qui détruit le build des autres
    // n'a pas besoin d'être bien placée : elle n'a pas à être là. On garde donc
    // l'invariant utile — RIEN dans gate-b ne doit vider `.next` — au lieu de
    // veiller sur la position d'une étape disparue. Ce test a rougi au retrait ;
    // c'est ce qu'on attend d'un cliquet, et c'est pourquoi il est réécrit
    // plutôt que supprimé.
    //
    // ⚠️ Si `size-limit-action` revient un jour, elle devra revenir avec un
    // budget de temps supérieur au `Build` du job, et EN DERNIER. Ce test la
    // refusera d'ici là — c'est délibéré : le retour se discute, il ne se
    // glisse pas.
    const destructrice = indexDe(GATE_B, ETAPE_DESTRUCTRICE);
    const playwright = indexDe(GATE_B, ETAPE_PLAYWRIGHT);

    expect(playwright, "l'étape Playwright a disparu de gate-b").toBeGreaterThanOrEqual(0);
    expect(
      destructrice,
      "`size-limit-action` est de retour dans gate-b. Elle relance un build complet " +
        "et VIDE `.next` : placée avant Playwright, elle fait démarrer `pnpm start` sur " +
        "un dossier sans `BUILD_ID` (run 32443013208 — 209 échecs, zéro passé). Et elle " +
        "n'aboutit pas : 8 min de build sous un cap de 6. Si son retour est voulu, il " +
        "faut le décider, pas le laisser passer sous ce cliquet.",
    ).toBe(-1);
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
