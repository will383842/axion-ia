/**
 * CI-LOT1 (2026-11-08) — accélérer la CI SANS baisser la qualité.
 *
 * Audit du 08/11 (API GitHub) : le goulot est l'ATTENTE de machines (20 jobs
 * simultanés pour tout le compte), 56 % des runs de PR sont annulés, une PR
 * coûte ~78 min-machine. Trois changements, verrouillés ici :
 *
 * 1. **Brouillon = pas de CI lourde.** Couverture ×3 et Gate B ×2 sautent tant
 *    que la PR est en brouillon ; `ready_for_review` les relance. Les deux
 *    VERDICTS exigés (« Gate A · couverture », « Gate B · per-PR ») ne sautent
 *    PAS : un contexte exigé `skipped` compte comme réussi pour GitHub, d'où une
 *    fenêtre de contournement sur le même SHA. En brouillon, leur première étape
 *    « Refus en brouillon » les rend ROUGES. Gate A (dont gitleaks, anti-SIREN,
 *    admin-gardes) et Gate D tournent TOUJOURS.
 * 2. **Gate B ne refait plus `tsc` dans `next build`** (`SKIP_NEXT_TYPECHECK`) :
 *    « Gate A · per-commit », exigée, lance `pnpm typecheck` sur le même commit.
 * 3. **`push` limité à `main`** : Gate A et Gate D tournent après chaque fusion ;
 *    couverture, Gate B et verdicts n'y tournent pas (`!= 'push'`).
 *
 * ⛔ Ce que cette garde interdit aussi : `paths`/`paths-ignore` au niveau du
 * workflow (les contextes exigés resteraient « en attente » et bloqueraient
 * toutes les fusions), et tout renommage des 4 contextes exigés.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const CI = path.join(process.cwd(), ".github", "workflows", "ci.yml");
const yaml = readFileSync(CI, "utf8");

/** Le texte d'un job de premier niveau (`  <id>:` jusqu'au job suivant). */
function job(id: string): string {
  const debut = yaml.search(new RegExp(`^ {2}${id}:\\s*$`, "m"));
  expect(debut, `job « ${id} » introuvable dans ci.yml`).toBeGreaterThanOrEqual(0);
  const reste = yaml.slice(debut + 1);
  const fin = reste.search(/^ {2}[a-z0-9-]+:\s*$/m);
  return fin === -1 ? reste : reste.slice(0, fin);
}

/** La condition `if:` de niveau JOB (4 espaces), dépliée sur une ligne. */
function conditionDuJob(corps: string): string | null {
  const lignes = corps.split(/\r?\n/);
  const i = lignes.findIndex((l) => /^ {4}if:/.test(l));
  if (i === -1) return null;
  const tete = lignes[i]!.replace(/^ {4}if:\s*/, "");
  if (tete !== ">-") return tete.trim();
  const suite: string[] = [];
  for (const l of lignes.slice(i + 1)) {
    if (!/^ {6}/.test(l)) break;
    suite.push(l.trim());
  }
  return suite.join(" ");
}

/** Lignes de code (sans commentaires) d'un bloc YAML. */
function code(texte: string): string {
  return texte
    .split(/\r?\n/)
    .filter((l) => !l.trimStart().startsWith("#"))
    .join("\n");
}

const BROUILLON = "github.event.pull_request.draft == false";

describe("CI-LOT1 — brouillon sans CI lourde, typecheck unique, pas de push", () => {
  it("le déclencheur `pull_request` porte `ready_for_review` (sinon rien ne relance à la sortie du brouillon)", () => {
    expect(code(yaml)).toMatch(
      /^ {2}pull_request:\s*\n {4}types: \[opened, synchronize, reopened, ready_for_review\]\s*$/m,
    );
  });

  it("`push` limité à `main` (Gate A et Gate D tournent après chaque fusion)", () => {
    expect(code(yaml)).toMatch(/^ {2}push:\s*\n {4}branches: \[main\]\s*$/m);
  });

  it("aucun `paths` / `paths-ignore` sur un déclencheur (les contextes exigés resteraient en attente)", () => {
    const declencheurs = code(yaml).split(/^concurrency:/m)[0]!;
    expect(declencheurs).not.toMatch(/paths(-ignore)?:/);
  });

  it("les 4 contextes exigés gardent leur nom exact, DANS le corps du job attendu", () => {
    const attendus: Array<[string, string]> = [
      ["gate-a", "Gate A · per-commit"],
      ["gate-a-couverture", "Gate A · couverture"],
      ["gate-b-verdict", "Gate B · per-PR"],
      ["gate-d-migration", "Gate D · Prisma migrate deploy (DB fresh)"],
    ];
    for (const [id, nom] of attendus) {
      const motif = new RegExp(`^ {4}name: ${nom.replace(/[()]/g, "\\$&")}\\s*$`, "m");
      expect(job(id), `le job « ${id} » doit porter le nom exigé « ${nom} »`).toMatch(motif);
    }
  });

  for (const id of ["gate-a-couverture-morceau", "gate-b"]) {
    it(`« ${id} » saute sur une PR en brouillon`, () => {
      const cond = conditionDuJob(job(id));
      expect(cond, `« ${id} » n'a plus de condition de job`).not.toBeNull();
      expect(cond).toContain(BROUILLON);
    });
  }

  for (const id of ["gate-a-couverture", "gate-b-verdict"]) {
    it(`le verdict « ${id} » ne saute JAMAIS en brouillon (skipped = réussi pour GitHub) et le refuse par une étape rouge`, () => {
      const corps = job(id);
      const cond = conditionDuJob(corps);
      expect(cond, `« ${id} » n'a plus de condition de job`).not.toBeNull();
      expect(cond).not.toContain(BROUILLON);
      const etapes = code(corps).split(/^ {6}- /m);
      // Première étape (après `steps:`) = le refus.
      const premiere = etapes[1] ?? "";
      expect(premiere).toMatch(/^name: Refus en brouillon\s*$/m);
      expect(premiere).toMatch(
        /^ {8}if: github\.event_name == 'pull_request' && github\.event\.pull_request\.draft\s*$/m,
      );
      expect(premiere).toContain('echo "::error::PR en brouillon : verdict non rendu" && exit 1');
    });
  }

  it("les verdicts gardent `always()` (une tranche rouge doit rendre un verdict ROUGE, pas `skipped`)", () => {
    expect(conditionDuJob(job("gate-a-couverture"))).toMatch(/^always\(\) && /);
    expect(conditionDuJob(job("gate-b-verdict"))).toMatch(/^always\(\) && /);
  });

  it("Gate A et Gate D ne dépendent PAS de l'état brouillon (gitleaks, anti-SIREN… tournent toujours)", () => {
    expect(job("gate-a")).not.toContain("draft");
    expect(job("gate-d-migration")).not.toContain("draft");
  });

  it("Gate B : l'étape Build pose SKIP_NEXT_TYPECHECK, et Gate A lance toujours `pnpm typecheck`", () => {
    const build = /- name: Build\n[\s\S]*?run: pnpm exec next build --webpack/.exec(job("gate-b"));
    expect(build, "étape Build de Gate B introuvable").not.toBeNull();
    expect(code(build![0])).toMatch(/^ {10}SKIP_NEXT_TYPECHECK: "true"\s*$/m);
    expect(code(job("gate-a"))).toMatch(/^\s+run: pnpm typecheck\s*$/m);
  });

  it("Gate A génère `.next/types` (next typegen) AVANT `pnpm typecheck` — sinon les contrats de routes ne sont plus vérifiés nulle part", () => {
    const a = code(job("gate-a"));
    const typegen = a.search(/^\s+run: pnpm exec next typegen\s*$/m);
    const tsc = a.search(/^\s+run: pnpm typecheck\s*$/m);
    expect(typegen, "étape `next typegen` absente de Gate A").toBeGreaterThanOrEqual(0);
    expect(typegen).toBeLessThan(tsc);
    expect(readFileSync(path.join(process.cwd(), "tsconfig.json"), "utf8")).toContain(
      ".next/types/**/*.ts",
    );
  });
});
