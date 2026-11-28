/**
 * Garde — le Verdict du robot « Claude (crédit API) » ne compte que les
 * branches poussées par CE run.
 *
 * Faille : le Verdict comparait `git ls-remote --heads origin` avant/après.
 * Plusieurs sessions poussent en parallèle sur le dépôt : le push d'une AUTRE
 * session suffisait à faire passer un robot qui n'avait rien poussé.
 *
 * Correctif : identité git propre à chaque run + heure de départ notée, et le
 * Verdict filtre sur le committer ET la date du commit de tête.
 * Le Bilan, lui, n'affiche que des nombres (dépôt public) : jamais `.result`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const YAML = readFileSync(join(process.cwd(), ".github/workflows/claude-credit-api.yml"), "utf8");

function etape(nom: string): string {
  const debut = YAML.indexOf(`- name: ${nom}`);
  expect(debut, `étape « ${nom} » introuvable`).toBeGreaterThan(-1);
  const suite = YAML.indexOf("\n      - ", debut + 1);
  return YAML.slice(debut, suite === -1 ? undefined : suite);
}

describe("Claude (crédit API) — Verdict par run", () => {
  const verdict = etape("Verdict");
  const bilan = etape("Bilan");
  const installation = etape("Installer Claude Code");

  it("fixe une identité git propre au robot et à ce run, et note l'heure de départ", () => {
    expect(installation).toMatch(/git config user\.name "robot-credit-api"/);
    expect(installation).toMatch(/git config user\.email "robot-credit-api-\$\{GITHUB_RUN_ID\}/);
    expect(installation).not.toMatch(/user\.email "41898282/);
    expect(installation).toMatch(/date -u \+%s > "\$RUNNER_TEMP\/robot-debut\.txt"/);
    expect(installation).toMatch(/robot-email\.txt/);
  });

  it("le Verdict filtre chaque branche par committer ET par date de commit", () => {
    expect(verdict).toMatch(/git fetch .*--depth=1 origin/);
    expect(verdict).toMatch(/git log -1 --format='%ce %ct' FETCH_HEAD/);
    expect(verdict).toMatch(/robot-email\.txt/);
    expect(verdict).toMatch(/robot-debut\.txt/);
    expect(verdict).toMatch(/"\$ce" = "\$robot_email"/);
    expect(verdict).toMatch(/"\$\{ct:-0\}"\s*-ge\s*"\$debut"/);
  });

  it("garde l'exception VERDICT et l'échec sans branche", () => {
    expect(verdict).toMatch(/test\("VERDICT"\)/);
    expect(verdict).toMatch(/aucune branche ni rendre de VERDICT/);
  });

  it("le Bilan n'affiche jamais le texte de .result", () => {
    expect(bilan).not.toMatch(/\.result/);
    expect(bilan).toMatch(/total_cost_usd/);
    expect(bilan).toMatch(/num_turns/);
  });
});
