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
 *    critique, ou qu'elle tourne deux fois ;
 *  - que le job qui la porte devienne muet (`continue-on-error`) ou attende
 *    Gate A (`needs`).
 *
 * ⚠️ Ce qu'il NE vérifie PAS : que « Gate A · couverture » soit un contexte
 * EXIGÉ de la protection de `main`. Cela se lit dans les réglages du dépôt, pas
 * dans ce fichier : `gh api repos/will383842/axion-ia/branches/main/protection/required_status_checks`.
 */
import { describe, expect, it } from "vitest";

import { codeYaml, corpsDuJob } from "./lire-un-workflow";

const CI = ".github/workflows/ci.yml";

/** Une étape qui lance la suite Vitest, sous l'une de ses formes. */
const LANCE_VITEST =
  /^\s+(?:-\s+)?run:\s+(?:pnpm (?:test(?::coverage)?|vitest)|npx vitest|vitest)\b(?!:e2e|:integration)/gm;

describe("la suite Vitest tourne une fois, dans « Gate A · couverture »", () => {
  const ci = codeYaml(CI);
  const couverture = corpsDuJob(ci, "gate-a-couverture");
  const gateA = corpsDuJob(ci, "gate-a");

  it("le job gate-a-couverture existe, sous le nom exact attendu par la protection de main", () => {
    expect(couverture, `🔴 job « gate-a-couverture » introuvable dans ${CI}`).not.toBeNull();
    expect(couverture).toMatch(/^\s+name:\s+Gate A · couverture\s*$/m);
  });

  it("il lance pnpm test:coverage, et c'est le seul lancement de Vitest du workflow", () => {
    expect(couverture!.match(LANCE_VITEST)?.map((l) => l.trim())).toEqual([
      "run: pnpm test:coverage",
    ]);
    expect(
      ci.match(LANCE_VITEST)?.length,
      "🔴 La suite Vitest est lancée plus d'une fois dans ci.yml : elle ne doit tourner que dans gate-a-couverture.",
    ).toBe(1);
  });

  it("Gate A ne lance plus Vitest", () => {
    expect(gateA, `🔴 job « gate-a » introuvable dans ${CI}`).not.toBeNull();
    expect(gateA!.match(LANCE_VITEST) ?? []).toEqual([]);
  });

  it("le job n'est ni muet ni en file derrière Gate A", () => {
    expect(couverture).not.toMatch(/continue-on-error/);
    // Clés de niveau JOB (4 espaces) : l'`if: always()` de l'étape d'upload
    // est légitime et ne doit pas être visé.
    expect(couverture).not.toMatch(/^ {4}needs:/m);
    expect(couverture).not.toMatch(/^ {4}if:/m);
  });
});
