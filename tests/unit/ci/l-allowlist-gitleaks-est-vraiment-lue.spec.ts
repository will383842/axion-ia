/**
 * L'allowlist de `gitleaks` est vraiment LUE par le scan (2026-09-21).
 *
 * ── Le défaut réparé ──────────────────────────────────────────────────────
 * L'étape déclarait `with: config-path: axionia/.gitleaks.toml`. **Ce n'est pas
 * une entrée de `gitleaks-action@v3`** : l'action ne lit sa configuration que
 * par la variable d'environnement `GITLEAKS_CONFIG`. Et un `with:` inconnu ne
 * fait pas échouer un workflow — il est ignoré, en silence.
 *
 * Résultat : trois exceptions écrites et commentées, dont une avec sept lignes
 * de justification, n'ont **jamais** été lues. Le scan tournait sur les règles
 * par défaut.
 *
 * 🔑 LE DÉFAUT EST SÉVÈRE SANS JAMAIS ÊTRE DANGEREUX, et c'est ce qui le rend
 * intéressant : les règles par défaut sont PLUS strictes que les nôtres, donc
 * aucun secret n'est passé à travers. Ce qu'on perdait est l'inverse — des faux
 * positifs, et la confiance dans une garde dont personne ne savait qu'elle ne
 * s'appliquait pas.
 *
 * ── Pourquoi personne ne l'a vu pendant des mois ─────────────────────────
 * Une PR ne scanne que ses commits NEUFS. Tant qu'aucun d'eux ne touchait un
 * fichier exempté, l'exception inerte ne se manifestait pas. Elle s'est révélée
 * le 2026-09-21, sur une PR dont un jeton de TEST était voisin du mot-clé
 * `token:` — un faux positif que l'allowlist aurait dû absorber.
 *
 * ── Ce que ce test tient ─────────────────────────────────────────────────
 * Il refuse le RETOUR de `config-path`, et il exige que le fichier désigné
 * existe. Un chemin qui ne mène à rien remettrait la garde dans l'état qu'on
 * vient de quitter : configurée en apparence, muette en pratique.
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
    const chemin = (m?.[1] ?? "")
      .trim()
      .replace(/\$\{\{[^}]*\}\}\//, "")
      .replace(/^axionia\//, "");
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
