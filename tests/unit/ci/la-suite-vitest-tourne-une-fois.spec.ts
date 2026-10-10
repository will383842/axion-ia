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
 * 2026-10-10 — la suite est découpée en 3 morceaux parallèles
 * (`gate-a-couverture-morceau`, `--shard=N/3`), fusionnés par
 * « Gate A · couverture » (`vitest run --merge-reports --coverage`), qui
 * applique les seuils de vitest.config.ts à la couverture FUSIONNÉE. Ce fichier
 * verrouille en plus :
 *  - que la matrice couvre EXACTEMENT 1/3, 2/3 et 3/3 (un morceau oublié =
 *    un tiers de la suite qui ne tourne plus, en vert) ;
 *  - que le job de fusion attende la matrice, tourne TOUJOURS (`always()`) et
 *    rougisse si elle n'est pas `success` (échec, annulation ou saut) ;
 *  - que les seuils ne soient surchargés QUE dans les morceaux, jamais à la
 *    fusion.
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

describe("la suite Vitest tourne une fois, en 3 morceaux fusionnés par « Gate A · couverture »", () => {
  const ci = codeYaml(CI);
  const morceaux = corpsDuJob(ci, "gate-a-couverture-morceau");
  const couverture = corpsDuJob(ci, "gate-a-couverture");
  const gateA = corpsDuJob(ci, "gate-a");

  const LANCE_UN_MORCEAU =
    "pnpm test:coverage --shard=${{ matrix.shard }}/3 --reporter=default --reporter=blob --outputFile.blob=rapports-blob/blob-${{ matrix.shard }}-3.json --coverage.thresholds.statements=0 --coverage.thresholds.branches=0 --coverage.thresholds.functions=0 --coverage.thresholds.lines=0 --coverage.reporter=text-summary";
  const FUSIONNE = "pnpm exec vitest run --merge-reports=rapports-blob --coverage";

  it("le job gate-a-couverture existe, sous le nom exact attendu par la protection de main", () => {
    expect(couverture, `🔴 job « gate-a-couverture » introuvable dans ${CI}`).not.toBeNull();
    expect(couverture).toMatch(/^\s+name:\s+Gate A · couverture\s*$/m);
  });

  it("la matrice lance pnpm test:coverage en morceaux 1/3, 2/3, 3/3, et c'est le seul lancement de la suite", () => {
    expect(morceaux, `🔴 job « gate-a-couverture-morceau » introuvable dans ${CI}`).not.toBeNull();
    expect(morceaux).toMatch(/^ {8}shard: \[1, 2, 3\]\s*$/m);
    expect(morceaux).toMatch(/^ {6}fail-fast: false\s*$/m);
    expect(
      lignesQuiLancentVitest(morceaux!).map((l) => l.replace(/^(?:-\s+)?run:\s*/, "")),
    ).toEqual([LANCE_UN_MORCEAU]);
    expect(
      lignesQuiLancentVitest(ci)
        .map((l) => l.replace(/^(?:-\s+)?run:\s*/, ""))
        .sort(),
      "🔴 La suite Vitest est lancée ailleurs que dans la matrice et sa fusion.",
    ).toEqual([FUSIONNE, LANCE_UN_MORCEAU].sort());
  });

  it("la fusion ne relance aucun test et applique les seuils de vitest.config.ts, non surchargés", () => {
    expect(
      lignesQuiLancentVitest(couverture!).map((l) => l.replace(/^(?:-\s+)?run:\s*/, "")),
    ).toEqual([FUSIONNE]);
    expect(couverture).not.toMatch(/thresholds/);
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

  it("la matrice n'est ni muette ni conditionnelle, ni en file derrière Gate A", () => {
    expect(morceaux).not.toMatch(/continue-on-error/);
    // Clés de niveau JOB (4 espaces) : le `if:` de l'étape d'upload est légitime.
    expect(morceaux).not.toMatch(/^ {4}needs:/m);
    expect(morceaux).not.toMatch(/^ {4}if:/m);
  });

  it("la fusion attend la matrice, tourne toujours, et rougit si elle n'est pas success", () => {
    expect(couverture).not.toMatch(/continue-on-error/);
    expect(couverture).toMatch(/^ {4}needs: gate-a-couverture-morceau\s*$/m);
    expect(couverture).toMatch(/^ {4}if: always\(\)\s*$/m);
    expect(couverture).toContain("RESULTAT: ${{ needs.gate-a-couverture-morceau.result }}");
    expect(couverture).toMatch(/if \[ "\$\{RESULTAT\}" != "success" \]; then[\s\S]*?exit 1/);
  });

  it("les étapes qui lancent la suite ne peuvent pas être neutralisées", () => {
    for (const corps of [morceaux!, couverture!]) {
      const [ligne] = lignesQuiLancentVitest(corps);
      expect(ligne, "aucune ligne ne lance Vitest").toBeDefined();
      const etape = etapeAutour(corps, ligne!);
      expect(etape).not.toMatch(/^\s+if:/m);
      expect(etape).not.toMatch(/continue-on-error/);
      expect(etape).not.toMatch(AVALE_L_ECHEC);
    }
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
