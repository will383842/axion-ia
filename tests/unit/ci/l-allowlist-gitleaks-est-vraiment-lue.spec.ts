/**
 * L'allowlist de `gitleaks` est vraiment LUE par le scan (2026-09-21).
 *
 * ── Ce que ce fichier a coûté à apprendre ────────────────────────────────
 * `config-path` n'est PAS une entrée de `gitleaks-action@v3` (son `action.yml`
 * ne déclare aucun `inputs:`). Un `with:` inconnu ne fait pas échouer un
 * workflow : il est ignoré, en silence.
 *
 * 🔑 MAIS L'ALLOWLIST ÉTAIT LUE QUAND MÊME. Une première version de ce fichier
 * affirmait le contraire, et c'était FAUX : l'action ne passe pas `--source`,
 * donc gitleaks charge `./.gitleaks.toml` par sa résolution automatique. Le
 * journal de `main` le dit mot pour mot :
 *   `DBG using existing gitleaks config .gitleaks.toml from `(--source)/.gitleaks.toml``
 *
 * 🔴 ET LA PREMIÈRE « RÉPARATION » A CASSÉ LE SCAN. `GITLEAKS_CONFIG` désignait
 * `.../axionia/.gitleaks.toml` — `axionia` est le dossier PARENT en local, pas
 * un répertoire du dépôt. gitleaks meurt au chargement et n'inspecte plus aucun
 * commit.
 *
 * 🔴 CE TEST ÉTAIT VERT PENDANT CE TEMPS, et c'est la leçon qui compte. Il
 * NORMALISAIT le chemin — `.replace(/^axionia\//, "")` — avant d'en vérifier
 * l'existence : il effaçait exactement le segment qui cassait tout, puis
 * validait un chemin qui n'était pas celui configuré.
 *
 * ⚠️ **Une garde qui nettoie son entrée avant de la vérifier ne vérifie plus
 * l'entrée.** Ici elle a été écrite, non pas pour mesurer, mais pour passer.
 *
 * ── Ce que ce test tient maintenant ──────────────────────────────────────
 * Le chemin est résolu comme le fait GitHub — `${{ github.workspace }}` est la
 * RACINE du dépôt — et rien d'autre n'est retiré. Un segment de trop rougit.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

const RACINE = process.cwd();
const CI = readFileSync(join(RACINE, ".github/workflows/ci.yml"), "utf8");

/** Le bloc de l'étape gitleaks, du `- name:` jusqu'au suivant. */
function etapeGitleaks(): string {
  const lignes = CI.split("\n");
  const debut = lignes.findIndex((l) => /^\s*- name:\s*gitleaks\s*$/.test(l));
  expect(debut, "l'étape « gitleaks » a disparu du workflow").toBeGreaterThanOrEqual(0);
  const suite = lignes.slice(debut + 1);
  const fin = suite.findIndex((l) => /^\s*- name:/.test(l) || /^\s{0,4}\w[\w-]*:/.test(l));
  return lignes.slice(debut, debut + 1 + (fin === -1 ? suite.length : fin)).join("\n");
}

describe("le scan de secrets lit bien notre configuration", () => {
  const etape = etapeGitleaks();

  it("passe par `GITLEAKS_CONFIG`, la SEULE entrée que l'action lit", () => {
    expect(etape).toMatch(/GITLEAKS_CONFIG:\s*\S+/);
  });

  it("🔴 ne revient JAMAIS à `config-path`, qui est ignoré en silence", () => {
    // C'est la moitié du test qui compte. Sans elle, quelqu'un peut remettre
    // `config-path` « pour faire propre » et la garde redevient muette, sans
    // qu'aucun workflow ne rougisse.
    expect(etape).not.toContain("config-path");
  });

  it("le fichier désigné EXISTE — un chemin mort vaut une configuration absente", () => {
    // ⚠️ Toute la fin de ligne, pas `\S+` : la valeur porte une expression
    // `${{ github.workspace }}`, et les espaces qu'elle contient coupaient la
    // capture au premier mot.
    const m = etape.match(/GITLEAKS_CONFIG:[ 	]*(.+)/);
    expect(m, "GITLEAKS_CONFIG sans valeur").not.toBeNull();
    // Le chemin est exprimé depuis la racine du dépôt (`github.workspace`) ;
    // les tests, eux, tournent depuis `axionia/`.
    // 🔴 SEULE l'expression `${{ github.workspace }}` est résolue — elle vaut la
    // RACINE du dépôt, c'est-à-dire l'endroit d'où tournent ces tests. Tout le
    // reste du chemin est vérifié TEL QUEL. Retirer un segment ici, c'est
    // s'interdire de voir celui qui est en trop.
    const chemin = (m?.[1] ?? "").trim().replace(/^\$\{\{[^}]*\}\}\//, "");
    expect(existsSync(join(RACINE, chemin)), `${chemin} est introuvable`).toBe(true);
  });

  it("TÉMOIN — l'allowlist a bien quelque chose à dire", () => {
    // 🔑 Sans lui, vider `.gitleaks.toml` laisserait les trois tests ci-dessus
    // verts : le chemin serait juste, le fichier présent, et la configuration
    // ne changerait plus rien. C'est la forme la plus discrète du même défaut.
    const toml = readFileSync(join(RACINE, ".gitleaks.toml"), "utf8");
    expect(toml).toContain("[allowlist]");
    const exceptions = (toml.match(/^\s*'''/gm) ?? []).length;
    expect(exceptions, "l'allowlist ne porte plus aucune exception").toBeGreaterThan(3);
  });
});
