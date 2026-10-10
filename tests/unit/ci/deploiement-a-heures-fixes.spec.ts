/**
 * 🕛 MISE EN LIGNE À HEURES FIXES (décision de Will, 2026-10-08).
 *
 * Avant : chaque fusion sur `main` lançait un build de ~50 min, et une fusion
 * pendant un build en vol l'annulait. Les fusions se faisaient au compte-gouttes.
 * Désormais : 12 h, 17 h et 22 h (heure de Paris), plus un lancement manuel.
 *
 * Ce test verrouille :
 *   · les SIX crons (été UTC+2 : 10/15/20 ; hiver UTC+1 : 11/16/21) ;
 *   · le job `precheck`, qui ne laisse passer que le jeu de la saison en cours
 *     et saute si la prod sert déjà le dernier commit ;
 *   · le refus d'un créneau rejoué plus de 90 min après son cron ;
 *   · le build, qui dépend de `precheck` ;
 *   · la notification, qui se tait quand le build est sauté (aucune fausse alarme).
 *
 * Mutation qui rougit : remettre `push:` → 1er cas ; retirer `needs: precheck`
 * du build → 3e cas ; retirer le filtre `skipped` de `notify` → 4e cas.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const WORKFLOW = readFileSync(
  join(process.cwd(), ".github", "workflows", "deploy-coolify.yml"),
  "utf8",
);

function job(nom: string): string {
  const debut = WORKFLOW.indexOf(`\n  ${nom}:\n`);
  if (debut < 0) return "";
  const suite = WORKFLOW.slice(debut + 1);
  const fin = suite.slice(1).search(/\n {2}[a-z_-]+:\n/);
  return fin < 0 ? suite : suite.slice(0, fin + 1);
}

describe("🕛 mise en ligne à heures fixes", () => {
  it("aucun déclencheur push ; créneaux et lancement manuel présents", () => {
    const on = /\non:\s*\n([\s\S]*?)\npermissions:/.exec(WORKFLOW)?.[1] ?? "";
    expect(on).not.toMatch(/^\s{2}push:/m);
    expect(on).toMatch(/^\s{2}workflow_dispatch:/m);
    const crons = [...on.matchAll(/cron:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(crons.sort()).toEqual(
      ["7 10 * * *", "7 11 * * *", "7 15 * * *", "7 16 * * *", "7 20 * * *", "7 21 * * *"].sort(),
    );
  });

  it("precheck : saison, créneau, et rien de nouveau = rien à faire", () => {
    const p = job("precheck");
    expect(p).toContain("TZ=Europe/Paris date +%z");
    expect(p).toContain("+0200:10|+0200:15|+0200:20|+0100:11|+0100:16|+0100:21");
    expect(p).toContain("x-axion-build-sha");
    // Un créneau rejoué plus de 90 min après l'heure de son cron est refusé
    // (cron « 7 20 » relancé par GitHub à 23:58 UTC le 2026-10-09).
    expect(p).toMatch(
      /if \[ "\$\{retard\}" -gt 90 \]; then\s*\n.*::notice::.*\n\s*echo "go=false"/,
    );
    // Un lancement manuel passe toujours.
    expect(p).toMatch(/if \[ "\$\{EVENT\}" != "schedule" \]; then\s*\n\s*echo "go=true"/);
  });

  it("le build attend le feu de precheck", () => {
    const b = job("build");
    expect(b).toMatch(/\n\s+needs: precheck\n/);
    expect(b).toContain("if: needs.precheck.outputs.go == 'true'");
  });

  it("le seed éditorial ne part qu'après un VRAI déploiement (créneau sauté = success)", () => {
    const seed = readFileSync(
      join(process.cwd(), ".github", "workflows", "content-gen-seed.yml"),
      "utf8",
    );
    expect(seed).toContain('select(.name == "Trigger Coolify deploy")');
    expect(seed).toContain("if: needs.porte.outputs.lancer == 'true'");
    expect(seed).not.toContain("github.event.workflow_run.conclusion == 'success'");
  });

  it("aucune notification quand le créneau n'a rien à mettre en ligne", () => {
    expect(job("notify")).toContain("if: always() && needs.build.result != 'skipped'");
  });
});
