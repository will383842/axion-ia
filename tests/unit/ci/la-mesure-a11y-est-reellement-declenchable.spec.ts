/**
 * L'entrée de déclenchement de la mesure a11y atteint vraiment la suite.
 *
 * ## Le câblage gardé ici, et pourquoi il est fragile
 *
 * `tests/e2e/a11y-admin-mesure.spec.ts` débloque le lot a11y : la gate
 * `@a11y-admin` couvre 18 écrans sur 242, et sa doctrine interdit d'en inscrire
 * un sans l'avoir mesuré. Mesurer demande la pile complète — base semée,
 * application démarrée, connexion admin — que seule Gate B monte.
 *
 * Plutôt que de dupliquer Gate B, on lui passe une variable : `A11Y_ROUTES`,
 * alimentée par une entrée `workflow_dispatch`. Trois maillons, et **il suffit
 * qu'un seul saute pour que tout devienne muet** :
 *
 *   1. l'entrée `a11y_routes` du `workflow_dispatch` ;
 *   2. **le job `gate-b` doit s'EXÉCUTER sur cet événement** ;
 *   3. la variable `A11Y_ROUTES` passée à l'étape Playwright ;
 *   4. l'étape qui récupère le rapport en artefact.
 *
 * 🔴 LE MAILLON 2 A ÉTÉ AJOUTÉ APRÈS COUP, ET IL MANQUAIT POUR DE VRAI.
 * Ce fichier gardait d'abord les seuls maillons 1, 3 et 4 — les raccords — sans
 * vérifier que le moteur démarre. `gate-b` portait
 * `if: github.event_name == 'pull_request' || … 'merge_group'` : au premier
 * usage réel (run 34683555610), le dispatch a rendu `Gate B → skipped`,
 * **40 écrans demandés, zéro mesuré, aucune erreur**. Le câblage était correct
 * et entièrement inerte, et ce test était VERT.
 *
 * 🔑 CE QUI REND CE CÂBLAGE PARTICULIÈREMENT TRAÎTRE. Si le maillon 2 saute,
 * la suite de mesure se `skip` — exactement comme sur tous les runs normaux, où
 * le skip est le comportement VOULU. Le journal afficherait « skipped », le run
 * serait VERT, et l'opérateur conclurait que les écrans mesurés n'ont aucune
 * violation. C'est la famille de défauts que ce dépôt paie en boucle : un vert
 * qui ne regarde pas.
 *
 * Si le maillon 3 saute, la mesure tourne mais le rapport meurt avec le runner :
 * des minutes de CI pour rien, et personne ne s'en aperçoit.
 *
 * ⚠️ Ce test NOMME les trois maillons plutôt que de compter des lignes. Un
 * témoin exprimé en seuil (« au moins N occurrences ») verdirait sur un câblage
 * à moitié défait.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

const CI_YML = join(process.cwd(), ".github/workflows/ci.yml");
const SPEC_MESURE = join(process.cwd(), "tests/e2e/a11y-admin-mesure.spec.ts");

function workflow(): string {
  return readFileSync(CI_YML, "utf8");
}

describe("la mesure a11y est réellement déclenchable", () => {
  it("🔑 CONTRE-TÉMOIN : la suite de mesure existe et lit bien `A11Y_ROUTES`", () => {
    // Sans ça, les trois assertions suivantes garderaient un câblage qui
    // n'alimente plus rien — vertes, et sans objet.
    const spec = readFileSync(SPEC_MESURE, "utf8");
    expect(
      spec.includes('process.env["A11Y_ROUTES"]'),
      "`a11y-admin-mesure.spec.ts` ne lit plus `A11Y_ROUTES` : le câblage du workflow " +
        "ne mène plus nulle part, et ce fichier le garderait quand même",
    ).toBe(true);
  });

  it("maillon 1 — le workflow déclare l'entrée `a11y_routes`", () => {
    const y = workflow();
    expect(y).toContain("workflow_dispatch:");
    expect(
      /a11y_routes:/.test(y),
      "l'entrée de déclenchement a disparu : la mesure n'est plus lançable du tout",
    ).toBe(true);
  });

  it("maillon 2 — `gate-b` s'exécute sur un `workflow_dispatch` avec des routes", () => {
    const y = workflow();
    const bloc = /\n {2}gate-b:[\s\S]{0,2500}?runs-on:/.exec(y)?.[0] ?? "";
    expect(
      /workflow_dispatch/.test(bloc),
      "`gate-b` ne s'exécute pas sur un déclenchement manuel : la mesure vit DANS ce job, " +
        "donc le dispatch rendrait `Gate B → skipped` et RIEN ne serait mesuré — sans la " +
        "moindre erreur. C'est le défaut constaté au premier usage réel (run 34683555610).",
    ).toBe(true);
    expect(
      /a11y_routes\s*!=\s*''/.test(bloc),
      "`gate-b` tournerait sur TOUT dispatch, y compris sans routes : ~37 min de CI pour rien",
    ).toBe(true);
  });

  it("maillon 3 — l'étape Playwright reçoit `A11Y_ROUTES`", () => {
    const y = workflow();
    expect(
      /A11Y_ROUTES:\s*\$\{\{\s*github\.event\.inputs\.a11y_routes/.test(y),
      "L'entrée `a11y_routes` n'atteint plus l'étape Playwright.\n" +
        "C'est le maillon le PLUS dangereux : sans lui, la suite de mesure se `skip` " +
        "exactement comme sur un run normal — journal « skipped », run VERT — et " +
        "l'opérateur conclurait que les écrans demandés sont sans violation.",
    ).toBe(true);
  });

  it("maillon 4 — le rapport est récupéré en artefact, même si la suite tombe", () => {
    const y = workflow();
    expect(
      /name:\s*a11y-console-mesure/.test(y),
      "l'étape d'artefact a disparu : la mesure tournerait et le rapport mourrait avec " +
        "le runner — des minutes de CI pour rien",
    ).toBe(true);
    // ⚠️ La forme LITTÉRALE `if: always()` est exigée par
    // `gate-b-a-ses-services.spec.ts` pour toute étape aval. Une condition
    // composée (`${{ always() && … }}`) la ferait rougir — et desserrer ce
    // cliquet pour y faire entrer cette étape serait le mauvais échange.
    const etape = /- name: Rapport a11y[\s\S]{0,600}/.exec(y)?.[0] ?? "";
    expect(
      /if:\s*always\(\)/.test(etape),
      "l'artefact n'est plus conditionné à `always()` : un rapport PARTIEL est ce qu'on " +
        "veut le plus le jour où la suite tombe, et c'est ce jour-là qu'on le perdrait",
    ).toBe(true);
    expect(
      /if-no-files-found:\s*ignore/.test(etape),
      "sans `ignore`, cette étape avertirait sur CHAQUE run normal — où il n'y a " +
        "légitimement aucun rapport. Un avertissement permanent devient un bruit qu'on " +
        "cesse de lire, et c'est ainsi qu'on rate le jour où il dit quelque chose.",
    ).toBe(true);
  });

  it("le coût est NUL sur les runs normaux", () => {
    const y = workflow();
    // La valeur par défaut vide est ce qui garantit le `skip` hors dispatch.
    // Sans elle, chaque PR paierait une mesure que personne n'a demandée.
    const bloc = /a11y_routes:[\s\S]{0,400}?default:\s*""/.test(y);
    expect(
      bloc,
      "`a11y_routes` n'a plus de valeur par défaut vide : la mesure risque de tourner " +
        "sur des runs qui ne l'ont pas demandée",
    ).toBe(true);
  });
});
