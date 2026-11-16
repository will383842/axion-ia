/**
 * D8b (2026-11-16) — le worker n'est redéployé QU'APRÈS le site, dans un job à part.
 *
 * Verrouille :
 *   · le job `deploy` ne POST plus le worker et expose `site_fini` (écrit par l'attente du site
 *     dans la branche `finished`, avant son `exit 0`) ;
 *   · le job `deploy_worker` : `needs: deploy`, `if: ${{ !cancelled() && … site_fini == 'true' }}`
 *     (pas always(), pas success()), groupe propre sans annulation, étapes dans l'ordre
 *     repos < POST < attente ;
 *   · l'étape « repos » est celle du site (fermée en cas de doute, 20 min, aucun POST) ;
 *   · l'attente du worker ne lit jamais `.logs` ni `.output` (le journal Coolify recopie des secrets) ;
 *   · `notify` lit le résultat du worker ; warm / lhci / indexnow n'en dépendent pas.
 *
 * Mutations qui rougissent : remettre le POST du worker dans `deploy` ; retirer
 * `echo "site_fini=true"` ; `always()` à la place de `!cancelled()` ; inverser l'ordre des étapes.
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
  const fin = suite.slice(1).search(/\n {2}[a-z_-]+:\n|\n {2}# ─/);
  return fin < 0 ? suite : suite.slice(0, fin + 1);
}

function etape(nomJob: string, debutNom: string): string {
  const j = job(nomJob);
  const i = j.indexOf(`      - name: ${debutNom}`);
  if (i < 0) return "";
  const reste = j.slice(i + 1);
  // Fin d'étape : l'étape suivante, ou le bloc de commentaires (indenté de 2) du job suivant.
  const fin = reste.search(/\n {6}- (name|uses):|\n {2}# ─/);
  return fin < 0 ? reste : reste.slice(0, fin);
}

const REPOS = "Coolify au repos (avant le worker)";
const POST = "POST /api/v1/deploy (worker";
const ATTENTE = "Attendre la fin du déploiement du worker";

describe("D8b · job deploy : plus de POST worker, site_fini exposé", () => {
  it("ne contient pas le POST du worker et expose site_fini", () => {
    const d = job("deploy");
    expect(d).not.toContain("POST /api/v1/deploy (worker");
    expect(d).toContain("site_fini: ${{ steps.attente_site.outputs.site_fini }}");
  });

  it("l'étape d'attente a l'id attente_site et écrit site_fini avant le premier exit 0 de `finished`", () => {
    const e = etape("deploy", "Wait for Coolify deployment to finish");
    expect(e).toContain("id: attente_site");
    const ecrit = e.indexOf('echo "site_fini=true" >> "$GITHUB_OUTPUT"');
    const finished = e.indexOf("finished)");
    const sortie = e.indexOf("exit 0", finished);
    expect(ecrit).toBeGreaterThan(finished);
    expect(ecrit).toBeLessThan(sortie);
  });
});

describe("D8b · job deploy_worker : déclenchement et concurrence", () => {
  const w = job("deploy_worker");

  it("dépend de deploy, avec la condition exacte, sans always()", () => {
    expect(w).toContain("needs: deploy\n");
    expect(w).toContain("if: ${{ !cancelled() && needs.deploy.outputs.site_fini == 'true' }}");
    expect(w).not.toContain("always()");
    expect(w).not.toContain("success()");
  });

  it("a son groupe, jamais annulé, et un délai", () => {
    expect(w).toMatch(
      /concurrency:\s*\n\s+group: deploy-coolify-worker\n\s+cancel-in-progress: false\n/,
    );
    expect(w).toMatch(/timeout-minutes: \d+/);
  });

  it("enchaîne repos < POST < attente", () => {
    const a = w.indexOf(`- name: ${REPOS}`);
    const b = w.indexOf(`- name: ${POST}`);
    const c = w.indexOf(`- name: ${ATTENTE}`);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });
});

describe("D8b · étape « repos » du worker", () => {
  const e = etape("deploy_worker", REPOS);

  it("reprend le contrôle fermé-en-cas-de-doute du site", () => {
    expect(e).toContain("/api/v1/deployments");
    expect(e).toContain('select(.status=="in_progress" or .status=="queued")');
    expect(e).toContain('if type=="array"');
    expect(e).toContain('else "illisible" end');
    expect(e).toContain("SECONDS + 1200");
    expect(e).toContain("sleep 30");
    expect(e).toContain("cancel-stuck");
    expect(e).toContain('echo "actif=true" >> "$GITHUB_OUTPUT"');
  });

  it("ne masque pas une réponse muette et ne POST rien", () => {
    expect(e).not.toMatch(/\|\|\s*echo\s+0/);
    expect(e).not.toContain("-X POST");
  });
});

describe("D8b · étape POST du worker", () => {
  const e = etape("deploy_worker", POST);

  it("n'agit que si le repos est atteint, force=true, extrait deployment_uuid", () => {
    expect(e).toContain("if: steps.repos_worker.outputs.actif == 'true'");
    expect(e).toContain("uuid=${COOLIFY_WORKER_APP_UUID}");
    expect(e).toContain("force=true");
    expect(e).toContain("deployment_uuid=");
  });

  it("n'apparaît qu'une fois dans tout le workflow", () => {
    expect(WORKFLOW.split("uuid=${COOLIFY_WORKER_APP_UUID}").length - 1).toBe(1);
  });
});

describe("D8b · attente du worker", () => {
  const e = etape("deploy_worker", ATTENTE);

  it("suit le deployment_uuid et ne lit jamais le journal Coolify", () => {
    expect(e).toContain("if: steps.deploy_worker.outputs.deployment_uuid != ''");
    expect(e).toContain("/api/v1/deployments/${DEPLOYMENT_UUID}");
    expect(e).not.toMatch(/\.logs\b/);
    expect(e).not.toMatch(/\.output\b/);
    expect(e).not.toContain("ssh ");
  });
});

describe("D8b · notify et jobs aval", () => {
  it("notify lit le résultat du worker", () => {
    const n = job("notify");
    expect(n).toMatch(/needs: \[[^\]]*deploy_worker[^\]]*\]/);
    expect(n).toContain("WORKER_RESULT");
  });

  it("warm, lhci et indexnow ne dépendent pas de deploy_worker", () => {
    for (const nom of ["warm", "lhci", "indexnow"]) {
      expect(job(nom), nom).not.toBe("");
      expect(job(nom), nom).not.toContain("deploy_worker");
    }
  });
});
