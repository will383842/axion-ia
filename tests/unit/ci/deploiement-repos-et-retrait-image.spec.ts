/**
 * D8 (2026-11-15) — « Coolify au repos » avant le POST, retrait de l'ancienne image après.
 *
 * Verrouille :
 *   · le job `deploy` garde `group: deploy-coolify` et `cancel-in-progress: false`, et `force=true` ;
 *   · l'étape « Coolify au repos » PRÉCÈDE le POST du site, lit /api/v1/deployments (GET), filtre
 *     site + worker sur in_progress/queued, renvoie à coolify-diagnose, et ne fait aucun POST ;
 *   · le retrait SUIT l'attente « Wait for Coolify », est best-effort (continue-on-error: true,
 *     12 min), n'agit que si l'attente a réussi, et appelle le script avec --appliquer ;
 *   · le script ne contient aucune commande forcée ni large, et contient liste noire et verrou.
 *
 * Mutations qui rougissent : passer cancel-in-progress à true ; déplacer « Coolify au repos »
 * après le POST ; retirer continue-on-error ; ajouter `rmi -f` ou `prune` au script ; retirer
 * `flock` ou un mot de la liste noire.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const WORKFLOW = readFileSync(
  join(process.cwd(), ".github", "workflows", "deploy-coolify.yml"),
  "utf8",
);
const SCRIPT = readFileSync(
  join(process.cwd(), "scripts", "vps", "retirer-anciennes-images-site.sh"),
  "utf8",
);

function job(nom: string): string {
  const debut = WORKFLOW.indexOf(`\n  ${nom}:\n`);
  if (debut < 0) return "";
  const suite = WORKFLOW.slice(debut + 1);
  const fin = suite.slice(1).search(/\n {2}[a-z_-]+:\n/);
  return fin < 0 ? suite : suite.slice(0, fin + 1);
}

/** Texte d'une étape du job `deploy`, de `- name: <début>` à l'étape suivante. */
function etape(debutNom: string): string {
  const d = job("deploy");
  const i = d.indexOf(`      - name: ${debutNom}`);
  if (i < 0) return "";
  const reste = d.slice(i + 1);
  const fin = reste.search(/\n {6}- (name|uses):/);
  return fin < 0 ? reste : reste.slice(0, fin);
}

const pos = (_t: string, motif: string) => job("deploy").indexOf(motif);

describe("D8 · job deploy : concurrence inchangée", () => {
  it("garde le groupe deploy-coolify sans annulation, et force=true", () => {
    const d = job("deploy");
    expect(d).toMatch(/concurrency:\s*\n\s+group: deploy-coolify\n\s+cancel-in-progress: false\n/);
    expect(d).toContain('--data-urlencode "force=true"');
  });
});

describe("D8 · « Coolify au repos » précède le POST", () => {
  it("est placé avant le POST du site", () => {
    const iRepos = pos("", "- name: Coolify au repos");
    const iPost = pos("", "- name: POST /api/v1/deploy\n");
    expect(iRepos).toBeGreaterThan(0);
    expect(iPost).toBeGreaterThan(iRepos);
  });

  it("lit les déploiements (GET), filtre site + worker, renvoie à cancel-stuck, ne POST pas", () => {
    const e = etape("Coolify au repos");
    expect(e).toContain("${COOLIFY_URL}/api/v1/deployments");
    expect(e).toContain(
      '(.application_uuid == $a or .application_uuid == $w) and (.status=="in_progress" or .status=="queued")',
    );
    expect(e).toContain("coolify-diagnose.yml -f action=cancel-stuck");
    expect(e).toContain("sleep 30");
    expect(e).toContain("SECONDS + 1200");
    expect(e).not.toMatch(/-X POST|--data/);
  });
});

describe("D8 · retrait de l'ancienne image", () => {
  it("suit « Wait for Coolify », best-effort, conditionné au succès, avec --appliquer", () => {
    const d = job("deploy");
    const iWait = d.indexOf("- name: Wait for Coolify");
    const iRetrait = d.indexOf("- name: Retirer l'ancienne image du site");
    expect(iWait).toBeGreaterThan(0);
    expect(iRetrait).toBeGreaterThan(iWait);
    const e = etape("Retirer l'ancienne image du site");
    expect(e).toContain("if: success() && steps.deploy.outputs.deployment_uuid != ''");
    expect(e).toMatch(/continue-on-error: true/);
    expect(e).toMatch(/timeout-minutes: 12/);
    expect(e).toContain("HETZNER_SSH_KEY");
    expect(e).toContain("::warning::");
    expect(e).toContain("--appliquer");
    expect(e).toContain("scripts/vps/retirer-anciennes-images-site.sh");
  });

  it("le checkout est réduit à scripts/vps", () => {
    const e = etape("Checkout (scripts/vps seulement)");
    expect(e).toContain("actions/checkout@v6");
    expect(e).toContain("sparse-checkout: scripts/vps");
  });
});

describe("D8 · le script de retrait", () => {
  it("n'a aucune commande forcée ou large", () => {
    expect(SCRIPT).not.toMatch(/rmi\s+-[a-z]*f/);
    expect(SCRIPT).not.toContain("--force");
    expect(SCRIPT).not.toMatch(/prune/);
    expect(SCRIPT).not.toMatch(/volume/i);
    expect(SCRIPT).not.toMatch(/rm\s+-[a-z]*r[a-z]*f|rm\s+-[a-z]*f[a-z]*r/);
    expect(SCRIPT).not.toMatch(/docker\s+(rm|stop|kill)\b/);
  });

  it("a le verrou, la garde de santé, la validation d'UUID et le mode essai par défaut", () => {
    expect(SCRIPT).toContain("set -euo pipefail");
    expect(SCRIPT).toContain("exec 9>");
    expect(SCRIPT).toContain("flock -n 9 || exit 0");
    expect(SCRIPT).toContain("^[a-z0-9]{20,40}$");
    expect(SCRIPT).toContain('MODE="essai"');
    expect(SCRIPT).toContain("healthy");
  });

  it("a la liste noire complète", () => {
    const LIGNE_NOIRE = /^LISTE_NOIRE='(.*)'$/m.exec(SCRIPT)?.[1] ?? "";
    for (const mot of [
      "studio",
      "cv-storage",
      "backup",
      "sauvegarde",
      "f0-facecam",
      "medias-reels",
      "contenu-reel",
      "avant-reconciliation",
      "coolify",
      "postgres",
    ]) {
      expect(LIGNE_NOIRE).toContain(mot);
    }
    expect(SCRIPT).toContain("ABANDON TOTAL");
  });
});
