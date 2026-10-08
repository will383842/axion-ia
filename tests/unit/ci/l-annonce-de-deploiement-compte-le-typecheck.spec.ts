/**
 * 2026-10-08 — la vérification des types tourne dans un job `typecheck` parallèle au build, et
 * `deploy` l'attend. S'il échoue, `deploy` est « skipped » : l'annonce Telegram (`notify`) ne
 * doit JAMAIS prendre ce skipped pour un succès (« déploiement réussi » alors que rien n'est en
 * ligne). Ce test exécute la VRAIE logique de décision du workflow, extraite du fichier.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const WORKFLOW = readFileSync(join(process.cwd(), ".github/workflows/deploy-coolify.yml"), "utf8");
const NOTIFY = WORKFLOW.slice(WORKFLOW.indexOf("\n  notify:"));

/** Le bloc de décision du script `notify` (de « success=… » jusqu'au libellé). */
function decision(): string {
  const debut = NOTIFY.indexOf('          if [ "${BUILD_RESULT}" = "success" ]');
  const fin =
    NOTIFY.indexOf("          fi\n", NOTIFY.indexOf('deployLabel="${DEPLOY_RESULT} (')) + 13;
  expect(debut).toBeGreaterThan(0);
  expect(fin).toBeGreaterThan(debut);
  return NOTIFY.slice(debut, fin);
}

function decider(build: string, typecheck: string, deploy: string) {
  const r = spawnSync("bash", ["-c", `${decision()}\necho "$success|$deployLabel"`], {
    env: {
      ...process.env,
      BUILD_RESULT: build,
      TYPECHECK_RESULT: typecheck,
      DEPLOY_RESULT: deploy,
    },
    encoding: "utf8",
  });
  const [success, label] = r.stdout.trim().split("|");
  return { success, label: label ?? "" };
}

describe("l'annonce de déploiement compte la vérification des types", () => {
  it("`notify` attend `typecheck` et lit son résultat", () => {
    expect(NOTIFY).toMatch(/needs: \[build, typecheck, deploy\]/);
    expect(NOTIFY).toMatch(/TYPECHECK_RESULT: \$\{\{ needs\.typecheck\.result \}\}/);
  });

  it("typecheck en ÉCHEC, deploy « skipped » : annoncé comme un ÉCHEC, avec la raison", () => {
    const d = decider("success", "failure", "skipped");
    expect(d.success).toBe("false");
    expect(d.label).toBe("skipped (types : failure)");
  });

  it("tout réussi : succès ; deploy volontairement sauté (skip_deploy) : succès", () => {
    expect(decider("success", "success", "success").success).toBe("true");
    expect(decider("success", "success", "skipped").success).toBe("true");
  });

  it("le libellé tient dans les 40 caractères qu'accepte le service", () => {
    for (const t of ["failure", "cancelled", "skipped"])
      for (const dep of ["skipped", "cancelled", "success"])
        expect(decider("success", t, dep).label.length).toBeLessThanOrEqual(40);
  });
});
