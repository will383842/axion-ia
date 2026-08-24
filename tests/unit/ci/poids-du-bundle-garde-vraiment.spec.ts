/**
 * Garde — l'étape « Poids du bundle » doit pouvoir ROUGIR, et le cliquet du
 * shell partagé doit rester calé sur une mesure.
 *
 * ## Le défaut
 *
 * `pnpm bundle:check` a porté `continue-on-error: true` pendant toute sa vie.
 * Une étape qui ne peut pas faire échouer son job dit « personne ne lit mon
 * résultat » — et personne ne l'a lu : le shell partagé pesait 135,75 kB pour
 * un budget affiché de 100 KB, dépassement resté invisible pendant des mois.
 * Ce dépôt a déjà payé ce motif exact sur le harnais E2E (0 test sur 237) et
 * sur les deux gates de budget retirées le 2026-08-24.
 *
 * Le raisonnement qui maintenait le `continue-on-error` était un faux dilemme :
 * « soit muette, soit bloquante à 100 KB et toutes les PR ferment ». La
 * troisième voie — aligner le seuil sur la mesure, PUIS bloquer — est la
 * doctrine déjà écrite dans AGENTS.md, jamais appliquée à ce bucket.
 *
 * ## Ce que cette garde vérifie, et ce qu'elle ne vérifie PAS
 *
 * Elle NE vérifie PAS que le shell est sous 100 KB : c'est une dette ouverte,
 * assumée, et la mesurer ici demanderait un build.
 *
 * Elle vérifie trois invariants d'ARCHITECTURE :
 *
 *   1. l'étape n'est pas neutralisée par `continue-on-error` ;
 *   2. le bucket du shell porte un cliquet CHIFFRÉ, ni absent ni revenu à la
 *      cible non tenue — un seuil sous la mesure rouvrirait le rouge permanent
 *      que cette PR supprime ;
 *   3. le nom du bucket continue de NOMMER la cible de 100 KB, pour qu'un
 *      cliquet de confort ne se fasse jamais passer pour un budget atteint.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

const CI = readFileSync(join(RACINE, ".github/workflows/ci.yml"), "utf8");
const PKG = JSON.parse(readFileSync(join(RACINE, "package.json"), "utf8")) as {
  "size-limit": Array<{ name: string; limit: string }>;
};

/** Le bloc YAML de l'étape, depuis son `- name:` jusqu'au `- name:` suivant. */
function etapePoidsDuBundle(): string {
  const depart = CI.indexOf("- name: Poids du bundle");
  expect(depart, "l'étape « Poids du bundle » a disparu de ci.yml").toBeGreaterThan(-1);
  const suite = CI.indexOf("\n      - name:", depart + 10);
  return CI.slice(depart, suite === -1 ? CI.length : suite);
}

describe("Étape « Poids du bundle » — elle doit pouvoir rougir", () => {
  it("existe et lance bien bundle:check", () => {
    // Témoin : sans lui, les deux assertions suivantes passeraient sur du vide.
    expect(etapePoidsDuBundle()).toContain("pnpm bundle:check");
  });

  it("ne porte PAS continue-on-error", () => {
    expect(
      etapePoidsDuBundle(),
      "`continue-on-error` sur l'étape de budget la rend incapable de rougir : " +
        "aucune PR qui alourdit le bundle ne sera jamais arrêtée. C'est " +
        "exactement l'état d'où l'on sort — ne pas y retourner.",
    ).not.toMatch(/continue-on-error:\s*true/);
  });
});

describe("Cliquet du shell partagé", () => {
  const shell = PKG["size-limit"].find((b) => b.name.startsWith("Shell partagé"));

  it("le bucket existe", () => {
    expect(shell, "bucket « Shell partagé » introuvable dans package.json").toBeDefined();
  });

  it("porte un cliquet AU-DESSUS de la mesure, sinon la gate rougit en permanence", () => {
    const kb = Number.parseFloat((shell as { limit: string }).limit);
    expect(Number.isFinite(kb), `limite illisible : ${(shell as { limit: string }).limit}`).toBe(
      true,
    );
    // Mesure du 2026-08-24 (run 32701301987) : 135,75 kB. Un seuil en dessous
    // rouvrirait un rouge que personne ne peut fermer dans la PR courante.
    expect(
      kb,
      "le cliquet est repassé sous la mesure du shell (135,75 kB) : la gate " +
        "deviendrait rouge sur toutes les PR sans que personne puisse la fermer. " +
        "Abaisser ce seuil se fait APRÈS le travail de réduction, pas avant.",
    ).toBeGreaterThanOrEqual(136);
  });

  it("nomme toujours la CIBLE de 100 KB — un cliquet n'est pas un budget atteint", () => {
    expect(
      (shell as { name: string }).name,
      "le nom du bucket ne cite plus la cible : un cliquet de confort finirait " +
        "par se lire comme un budget tenu, et la dette disparaîtrait des radars.",
    ).toMatch(/100 KB/);
  });
});
