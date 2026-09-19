/**
 * La suite Vitest tourne UNE fois par PR, dans « Gate A · couverture ».
 *
 * 🔴 2026-09-19 — Gate A frôlait son timeout de 25 min (24 min 32 s à
 * 24 min 40 s sur #1112, #1114, #1115). Premier essai : Vitest sans couverture
 * dans Gate A, couverture dans un job voisin. Mesuré sur #1116 : Gate A encore à
 * 20 min 51 s (Vitest nu 15 min 34 s), et la suite tournait DEUX fois par PR.
 * État retenu : Gate A ne lance plus Vitest, `gate-a-couverture` lance la suite
 * entière avec couverture, une seule fois.
 *
 * Ce que ce fichier empêche :
 *  - que la suite disparaisse de la CI (le job ou son étape retirés) ;
 *  - qu'elle revienne dans Gate A « par prudence » et rallonge le chemin
 *    critique, ou qu'elle tourne deux fois — sous N'IMPORTE QUELLE forme :
 *    `pnpm test`, `pnpm exec vitest`, `npx vitest`, et sur n'importe quelle
 *    ligne d'un bloc `run: |` multiligne (revue simplicité 5255101222 : la
 *    première version ne lisait que `run: pnpm test…` sur une seule ligne) ;
 *  - qu'elle ne lance qu'une partie de la suite (`pnpm test:coverage
 *    tests/unit/ci`, ou un script `test:coverage` restreint) ;
 *  - que l'étape ou le job qui la porte deviennent muets : `continue-on-error`,
 *    `if:` (dont `if: false`), `needs`, ou une commande qui avale l'échec
 *    (`|| true`, `|| :`, `; true`, `set +e`…) (revue sécurité, D2).
 *
 * ⚠️ Ce qu'il NE vérifie PAS : que « Gate A · couverture » soit un contexte
 * EXIGÉ de la protection de `main`. Cela se lit dans les réglages du dépôt, pas
 * dans ce fichier : `gh api repos/will383842/axion-ia/branches/main/protection/required_status_checks`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { codeYaml, corpsDuJob } from "./lire-un-workflow";

const CI = ".github/workflows/ci.yml";

/**
 * Une ligne de code qui lance Vitest, où qu'elle soit : après `run:`, dans un
 * bloc multiligne, après `&&`. `vitest` en minuscules est le binaire (le nom
 * d'étape « Vitest » porte une majuscule) ; `pnpm test` / `npm test` sont les
 * scripts qui l'appellent. `test:e2e` et `test:integration` (Playwright, suite
 * d'intégration) ne sont pas la suite unitaire.
 */
const LANCE_VITEST = /\bvitest\b|\b(?:pnpm|npm|yarn)\s+(?:run\s+)?test(?::coverage)?(?![\w:-])/;

/** Toute façon d'avaler l'échec de la commande. */
const AVALE_L_ECHEC = /\|\|\s*(?:true\b|:|exit\s+0\b)|;\s*(?:true|:)\s*$|\bset\s+\+e\b/m;

function lignesQuiLancentVitest(corps: string): string[] {
  return corps
    .split("\n")
    .filter((l) => LANCE_VITEST.test(l))
    .map((l) => l.trim());
}

/** L'étape (bloc qui commence par `      - `) contenant la ligne `ligne`. */
function etapeAutour(corps: string, ligne: string): string {
  const lignes = corps.split("\n");
  const i = lignes.findIndex((l) => l.trim() === ligne);
  let debut = i;
  while (debut > 0 && !/^ {6}- /.test(lignes[debut]!)) debut--;
  let fin = i + 1;
  while (fin < lignes.length && !/^ {6}- /.test(lignes[fin]!)) fin++;
  return lignes.slice(debut, fin).join("\n");
}

describe("la suite Vitest tourne une fois, dans « Gate A · couverture »", () => {
  const ci = codeYaml(CI);
  const couverture = corpsDuJob(ci, "gate-a-couverture");
  const gateA = corpsDuJob(ci, "gate-a");

  it("le job gate-a-couverture existe, sous le nom exact attendu par la protection de main", () => {
    expect(couverture, `🔴 job « gate-a-couverture » introuvable dans ${CI}`).not.toBeNull();
    expect(couverture).toMatch(/^\s+name:\s+Gate A · couverture\s*$/m);
  });

  it("il lance pnpm test:coverage, et c'est le seul lancement de Vitest du workflow", () => {
    expect(
      lignesQuiLancentVitest(couverture!).map((l) => l.replace(/^(?:-\s+)?run:\s*/, "")),
    ).toEqual(["pnpm test:coverage"]);
    expect(
      lignesQuiLancentVitest(ci),
      "🔴 La suite Vitest est lancée plus d'une fois dans ci.yml : elle ne doit tourner que dans gate-a-couverture.",
    ).toHaveLength(1);
  });

  it("pnpm test:coverage lance la suite ENTIÈRE, sans chemin ni filtre", () => {
    // L'égalité stricte du test précédent refuse déjà `pnpm test:coverage
    // tests/unit/ci` dans le workflow ; le script lui-même ne doit pas non plus
    // se restreindre (revue exactitude 5255141619).
    const scripts = (
      JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as {
        scripts: Record<string, string>;
      }
    ).scripts;
    expect(scripts["test:coverage"]).toBe("vitest run --coverage");
  });

  it("Gate A ne lance plus Vitest, sous aucune forme", () => {
    expect(gateA, `🔴 job « gate-a » introuvable dans ${CI}`).not.toBeNull();
    expect(lignesQuiLancentVitest(gateA!)).toEqual([]);
  });

  it("le job n'est ni muet ni conditionnel, ni en file derrière Gate A", () => {
    expect(couverture).not.toMatch(/continue-on-error/);
    // Clés de niveau JOB (4 espaces) : l'`if: always()` de l'étape d'upload
    // est légitime et ne doit pas être visé.
    expect(couverture).not.toMatch(/^ {4}needs:/m);
    expect(couverture).not.toMatch(/^ {4}if:/m);
  });

  it("l'étape qui lance la suite ne peut pas être neutralisée", () => {
    const [ligne] = lignesQuiLancentVitest(couverture!);
    expect(ligne, "aucune ligne ne lance Vitest dans gate-a-couverture").toBeDefined();
    const etape = etapeAutour(couverture!, ligne!);
    expect(etape).not.toMatch(/^\s+if:/m);
    expect(etape).not.toMatch(/continue-on-error/);
    expect(etape).not.toMatch(AVALE_L_ECHEC);
  });

  it.each([
    ["run: pnpm exec vitest run", 1],
    ["run: npx vitest run", 1],
    ["run: pnpm vitest --coverage", 1],
    ["run: pnpm run test", 1],
    ["run: pnpm test:coverage tests/unit/ci", 1],
    ["  pnpm test", 1],
    ["run: pnpm test:e2e --project=chromium", 0],
    ["run: pnpm test:integration", 0],
    ["- name: Vitest (with coverage)", 0],
  ] as const)("LANCE_VITEST : « %s » → %i lancement", (ligne, attendu) => {
    expect(lignesQuiLancentVitest(ligne)).toHaveLength(attendu);
  });

  it.each([
    "run: pnpm test:coverage || true",
    "run: pnpm test:coverage || :",
    "run: pnpm test:coverage || exit 0",
    "run: pnpm test:coverage; true",
    "run: |\n  set +e\n  pnpm test:coverage",
  ])("AVALE_L_ECHEC reconnaît « %s »", (etape) => {
    expect(etape).toMatch(AVALE_L_ECHEC);
  });

  it("AVALE_L_ECHEC laisse passer la commande nue", () => {
    expect("run: pnpm test:coverage").not.toMatch(AVALE_L_ECHEC);
  });
});
