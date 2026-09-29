/**
 * ⛔ LES CHEMINS DE L'EXTENSION NE DÉCLENCHENT PAS DE MISE EN LIGNE (PR 5).
 *
 * L'extension Meet est chargée à la main sur le poste de Will ; une retouche
 * de `extensions/**` ne doit pas coûter un déploiement (≈ 80 min, file
 * partagée). Le workflow `deploy-coolify.yml` doit donc :
 *   · porter `extensions/**` dans `paths-ignore` ;
 *   · garder sa concurrence SCINDÉE intacte (build annulable, deploy
 *     sérialisé et jamais annulé : correctif P0-01) ;
 * et l'image Docker n'embarque pas le dossier (`.dockerignore`).
 *
 * Mutation qui rougit : retirer la ligne `- "extensions/**"` → 1er cas.
 * Contre-témoin : `src/**` n'est PAS ignoré (le site se déploie toujours).
 * Angle mort avoué : GitHub applique `paths-ignore` ; qu'une PR ne touchant
 * QUE `extensions/**` ne déclenche rien sera CONSTATÉ à la première retouche.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const WORKFLOW = readFileSync(join(RACINE, ".github", "workflows", "deploy-coolify.yml"), "utf8");

function pathsIgnore(): string[] {
  const bloc =
    /push:\s*\n\s*branches:[^\n]*\n\s*paths-ignore:\s*\n((?:\s*(?:#[^\n]*|- [^\n]+)\n)+)/.exec(
      WORKFLOW,
    );
  if (!bloc?.[1]) return [];
  return [...bloc[1].matchAll(/- "([^"]+)"/g)].map((m) => m[1] ?? "");
}

describe("⛔ les chemins de l'extension ne déclenchent pas de mise en ligne", () => {
  it("paths-ignore contient extensions/**", () => {
    expect(pathsIgnore()).toContain("extensions/**");
  });

  it("contre-témoin : le code du site n'est pas ignoré", () => {
    const ignores = pathsIgnore();
    expect(ignores.length).toBeGreaterThan(3);
    for (const p of ignores) expect(p.startsWith("src")).toBe(false);
  });

  it("la concurrence scindée du déploiement est inchangée", () => {
    // Build : annulable (un push plus récent le remplace). Deploy : sérialisé,
    // jamais annulé (correctif P0-01). Cette PR n'y touche pas.
    const blocs = [
      ...WORKFLOW.matchAll(
        /\n\s+concurrency:\s*\n\s+group:\s*([^\n]+)\n\s+cancel-in-progress:\s*(\w+)/g,
      ),
    ].map((m) => [m[1]?.trim(), m[2]]);
    expect(blocs).toContainEqual(["build-${{ github.workflow }}-${{ github.ref }}", "true"]);
    expect(blocs).toContainEqual(["deploy-coolify", "false"]);
    // Aucun groupe `deploy-coolify` annulable nulle part.
    expect(blocs.filter(([g, c]) => g === "deploy-coolify" && c === "true")).toEqual([]);
  });

  it("l'image Docker n'embarque pas l'extension", () => {
    const ignore = readFileSync(join(RACINE, ".dockerignore"), "utf8");
    expect(ignore.split(/\r?\n/)).toContain("extensions");
  });
});
